import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { readChatStream } from "@/lib/chat-stream";
import { buildCartUrl, type CartMode } from "@/lib/cart";
import { DASHBOARD_SESSION_PREFIX } from "@/lib/onboarding";
import { markOnboarding } from "@/lib/onboarding-data";
import { toast } from "sonner";
import ProductCard from "./ProductCard";

interface ChatProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  image_url: string | null;
  stock_status: string;
  promo: string | null;
  product_url: string | null;
  sku?: string | null;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  products?: ChatProduct[];
  isError?: boolean;
}

const DEFAULT_GREETING = "Hi! I'm your shopping assistant. What are you looking for today?";

// The draggable chat bubble stays this far inside the visible window
// (clientWidth excludes the scrollbar, unlike innerWidth).
const BUBBLE_SIZE = 56;
const BUBBLE_EDGE = 24;
const viewportWidth = () => document.documentElement.clientWidth || window.innerWidth;
const viewportHeight = () => document.documentElement.clientHeight || window.innerHeight;
function clampBubble(x: number, y: number) {
  // A hidden or not-yet-laid-out window reports 0x0; clamp once it has a size.
  if (viewportWidth() === 0 || viewportHeight() === 0) return { x, y };
  const maxX = Math.max(BUBBLE_EDGE, viewportWidth() - BUBBLE_SIZE - BUBBLE_EDGE);
  const maxY = Math.max(BUBBLE_EDGE, viewportHeight() - BUBBLE_SIZE - BUBBLE_EDGE);
  return {
    x: Math.min(Math.max(x, BUBBLE_EDGE), maxX),
    y: Math.min(Math.max(y, BUBBLE_EDGE), maxY),
  };
}

const ChatWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [primaryColor, setPrimaryColor] = useState("#1E40AF");
  const [greeting, setGreeting] = useState(DEFAULT_GREETING);
  const [currency, setCurrency] = useState("BDT");
  const [cartMode, setCartMode] = useState<CartMode>("off");
  const [cartUrlTemplate, setCartUrlTemplate] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  // Prefixed so previews don't count as shopper chats in stats and onboarding.
  const sessionIdRef = useRef(`${DASHBOARD_SESSION_PREFIX}${crypto.randomUUID()}`);
  const testedMarkedRef = useRef(false);
  const isMobile = useIsMobile();
  
  // Draggable bubble state
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [bubbleStart, setBubbleStart] = useState({ x: 0, y: 0 });
  const [dragDistance, setDragDistance] = useState(0);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Load the saved bubble position, kept inside the visible window.
  useEffect(() => {
    const fallback = { x: viewportWidth() - BUBBLE_SIZE - BUBBLE_EDGE, y: viewportHeight() - BUBBLE_SIZE - 72 };
    try {
      const saved = JSON.parse(localStorage.getItem('chatBubblePosition') ?? 'null');
      const ok = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y);
      setBubblePosition(clampBubble(ok ? saved.x : fallback.x, ok ? saved.y : fallback.y));
    } catch {
      setBubblePosition(clampBubble(fallback.x, fallback.y));
    }
  }, []);

  // Save bubble position to localStorage
  useEffect(() => {
    if (bubblePosition.x !== 0 || bubblePosition.y !== 0) {
      localStorage.setItem('chatBubblePosition', JSON.stringify(bubblePosition));
    }
  }, [bubblePosition]);

  useEffect(() => {
    if (!user) {
      setBusinessId(null);
      setBusinessName("");
      return;
    }
    const loadBusiness = async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, bot_name, greeting, primary_color, currency, cart_mode, cart_url_template")
        .eq("owner_id", user.id)
        .maybeSingle();
      setBusinessId(data?.id ?? null);
      setBusinessName(data?.bot_name ?? "ShopMind AI");
      setPrimaryColor(data?.primary_color ?? "#1E40AF");
      setGreeting(data?.greeting || DEFAULT_GREETING);
      setCurrency(data?.currency ?? "BDT");
      setCartMode((data?.cart_mode as CartMode) ?? "off");
      setCartUrlTemplate(data?.cart_url_template ?? null);
    };
    void loadBusiness();
  }, [user]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: ++idRef.current,
          role: "assistant",
          content: greeting,
        },
      ]);
    }
  }, [open, messages.length, greeting]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

    const userMsg: Message = { id: ++idRef.current, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    if (!supabaseUrl || !anonKey) {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: ++idRef.current,
          role: "assistant",
          content: "Chat is not configured (missing Supabase URL or anon key).",
          isError: true,
        },
      ]);
      return;
    }

    if (!businessId) {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: ++idRef.current,
          role: "assistant",
          content:
            user == null
              ? "Please sign in to use the shopping assistant."
              : "We couldn't find your store. Try refreshing the page.",
          isError: true,
        },
      ]);
      return;
    }

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({
          message: text,
          business_id: businessId,
          session_id: sessionIdRef.current,
          stream: true,
        }),
      });

      if (res.ok && !testedMarkedRef.current) {
        testedMarkedRef.current = true;
        void markOnboarding(businessId, "tested_at");
      }

      const isStream = (res.headers.get("content-type") ?? "").includes("text/event-stream");
      if (res.ok && isStream && res.body) {
        const replyId = ++idRef.current;
        let started = false;
        let finished = false;
        const update = (patch: Partial<Message>) =>
          setMessages((prev) => prev.map((m) => (m.id === replyId ? { ...m, ...patch } : m)));

        await readChatStream(res.body, (event) => {
          if (event.type === "delta") {
            if (!started) {
              started = true;
              setTyping(false);
              setMessages((prev) => [...prev, { id: replyId, role: "assistant", content: event.text }]);
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === replyId ? { ...m, content: m.content + event.text } : m)),
              );
            }
            return;
          }
          finished = true;
          const final: Message =
            event.type === "done"
              ? {
                  id: replyId,
                  role: "assistant",
                  content: event.reply?.trim() || "I didn't get a reply. Please try again.",
                  products: event.products?.length ? (event.products as ChatProduct[]) : undefined,
                }
              : { id: replyId, role: "assistant", content: event.error, isError: true };
          if (started) update(final);
          else {
            started = true;
            setMessages((prev) => [...prev, final]);
          }
        });
        if (!finished && !started) {
          setMessages((prev) => [
            ...prev,
            { id: replyId, role: "assistant", content: "The reply was cut off. Please try again.", isError: true },
          ]);
        }
        return;
      }

      let data: { reply?: string; products?: ChatProduct[]; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        const errText =
          typeof data.error === "string" && data.error
            ? data.error
            : `Something went wrong (${res.status}). Please try again.`;
        setMessages((prev) => [
          ...prev,
          {
            id: ++idRef.current,
            role: "assistant",
            content: errText,
            isError: true,
          },
        ]);
        return;
      }

      const reply =
        typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "I didn't get a reply. Please try again.";

      const products = Array.isArray(data.products) ? data.products : [];

      setMessages((prev) => [
        ...prev,
        {
          id: ++idRef.current,
          role: "assistant",
          content: reply,
          products: products.length > 0 ? products : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: ++idRef.current,
          role: "assistant",
          content: "Network error. Check your connection and try again.",
          isError: true,
        },
      ]);
    } finally {
      setTyping(false);
    }
  }, [input, businessId, user]);

  // The dashboard is a preview: show what "Add to cart" would do on the store.
  const cartPreview = (p: ChatProduct): (() => void) | undefined => {
    if (cartMode === "event") {
      return () => toast.info(`On your store this sends shopmind:add-to-cart for "${p.name}".`);
    }
    if (cartMode === "url" && cartUrlTemplate) {
      const url = buildCartUrl(cartUrlTemplate, p);
      if (!url) return undefined;
      return () => toast.info(`On your store this opens ${url}`);
    }
    return undefined;
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
    setBubbleStart({ x: bubblePosition.x, y: bubblePosition.y });
    setDragDistance(0);
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    setDragDistance(distance);

    const newX = bubbleStart.x + deltaX;
    const newY = bubbleStart.y + deltaY;

    setBubblePosition(clampBubble(newX, newY));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    
    // Snap to the nearest side, clear of the edge and the scrollbar.
    const isRight = bubblePosition.x > viewportWidth() / 2;
    const snappedX = isRight ? viewportWidth() - BUBBLE_SIZE - BUBBLE_EDGE : BUBBLE_EDGE;
    setBubblePosition(clampBubble(snappedX, bubblePosition.y));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    handleDragEnd();
    if (dragDistance < 5) {
      setOpen(true);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
    if (dragDistance < 5) {
      setOpen(true);
    }
  };

  // Window listeners call the latest handlers through a ref, so they see
  // current drag state without re-subscribing on every move.
  const dragHandlersRef = useRef({
    move: handleMouseMove,
    up: handleMouseUp,
    touchMove: handleTouchMove,
    touchEnd: handleTouchEnd,
  });
  dragHandlersRef.current = {
    move: handleMouseMove,
    up: handleMouseUp,
    touchMove: handleTouchMove,
    touchEnd: handleTouchEnd,
  };

  useEffect(() => {
    if (!isDragging) return;
    const move = (e: MouseEvent) => dragHandlersRef.current.move(e);
    const up = () => dragHandlersRef.current.up();
    const touchMove = (e: TouchEvent) => dragHandlersRef.current.touchMove(e);
    const touchEnd = () => dragHandlersRef.current.touchEnd();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", touchMove);
    window.addEventListener("touchend", touchEnd);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
    };
  }, [isDragging]);

  // Calculate panel position based on bubble position with boundary checking
  const getPanelPosition = () => {
    const PANEL_WIDTH = 560;
    const PANEL_HEIGHT = 780;
    const FAB_SIZE = 56;
    const MARGIN = 16;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isRight = bubblePosition.x > screenWidth / 2;
    
    let panelLeft: number;
    let panelTop: number;
    
    if (isRight) {
      // Panel opens to the left of the bubble
      panelLeft = bubblePosition.x - PANEL_WIDTH - MARGIN;
    } else {
      // Panel opens to the right of the bubble
      panelLeft = bubblePosition.x + FAB_SIZE + MARGIN;
    }
    
    // Vertical: panel top = fabY - PANEL_HEIGHT + FAB_SIZE (bottom-aligned with bubble)
    panelTop = bubblePosition.y - PANEL_HEIGHT + FAB_SIZE;
    
    // Apply boundary corrections
    if (panelTop < MARGIN) {
      panelTop = MARGIN;
    }
    if (panelTop + PANEL_HEIGHT > screenHeight - MARGIN) {
      panelTop = screenHeight - PANEL_HEIGHT - MARGIN;
    }
    if (panelLeft < MARGIN) {
      panelLeft = MARGIN;
    }
    if (panelLeft + PANEL_WIDTH > screenWidth - MARGIN) {
      panelLeft = screenWidth - PANEL_WIDTH - MARGIN;
    }
    
    const transformOrigin = isRight ? 'right bottom' : 'left bottom';
    
    return {
      left: panelLeft,
      right: 'auto',
      top: panelTop,
      bottom: 'auto',
      transformOrigin,
    };
  };

  const panelPosition = getPanelPosition();

  // Recalculate panel position on window resize
  useEffect(() => {
    const handleResize = () => {
      // Keep the bubble on screen and recalculate the panel position.
      setBubblePosition(prev => clampBubble(prev.x, prev.y));
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const panelClasses = isMobile
    ? "flex flex-col bg-card rounded-t-3xl"
    : "flex flex-col chat-panel-premium";

  return (
    <>
      {!open && (
        <div
          ref={bubbleRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="fixed cursor-pointer z-50 touch-none"
          style={{
            left: bubblePosition.x,
            top: bubblePosition.y,
            width: '56px',
            height: '56px',
          }}
        >
          <button
            className="w-full h-full rounded-full text-white shadow-lg flex items-center justify-center transition-transform active:scale-95"
            style={{ 
              backgroundColor: primaryColor,
              boxShadow: `0 0 30px ${primaryColor}80, 0 0 60px ${primaryColor}40`
            }}
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        </div>
      )}

      {open && (
        <>
          <div 
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(4px)',
              zIndex: 40,
            }}
          />
          <div 
            className={panelClasses}
            style={{
              position: 'fixed',
              ...panelPosition,
              width: isMobile ? '100%' : '560px',
              height: isMobile ? '100%' : '780px',
              zIndex: 50,
              borderRadius: isMobile ? '24px 24px 0 0' : '24px',
              backgroundColor: '#0d1117',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              transform: open ? 'scale(1)' : 'scale(0)',
              opacity: open ? 1 : 0,
              transformOrigin: panelPosition.transformOrigin,
              transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              '--chat-primary-color': primaryColor,
            } as React.CSSProperties}
          >
            <div className="chat-panel-gradient-mesh" />
            
            <div className="relative z-10 flex items-center justify-between px-6 py-5 chat-panel-header-gradient rounded-t-3xl flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none text-white">{businessName}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-xs text-white/80">Online</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-9 w-9 text-white hover:bg-white/20">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto p-6 space-y-4 min-h-0 chat-scrollbar">
              {messages.map((msg) => (
                <div key={msg.id} className="chat-message-fade-in">
                  <div
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-5 py-3 text-sm ${
                        msg.role === "user"
                          ? "user-message-bubble text-white rounded-br-md"
                          : msg.isError
                            ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-md"
                            : "assistant-message-bubble text-gray-100 rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                  {msg.role === "assistant" &&
                    msg.products &&
                    msg.products.length > 0 && (
                      <div className="flex flex-col gap-4 mt-4">
                        {msg.products.map((p) => (
                          <ProductCard
                            key={p.id}
                            name={p.name}
                            category={p.category}
                            price={p.price}
                            description={p.description}
                            image_url={p.image_url}
                            stock_status={p.stock_status}
                            promo={p.promo}
                            product_url={p.product_url}
                            currency={currency}
                            onAddToCart={cartPreview(p)}
                          />
                        ))}
                      </div>
                    )}
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="assistant-message-bubble rounded-2xl rounded-bl-md px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="typing-dot rounded-full bg-blue-400 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative z-10 border-t border-gray-800 p-4 flex gap-3 flex-shrink-0">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 h-11 text-sm chat-input-glow"
                disabled={typing}
              />
              <Button
                size="icon"
                className="h-11 w-11 shrink-0 chat-send-button"
                onClick={() => void sendMessage()}
                disabled={typing}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ChatWidget;
