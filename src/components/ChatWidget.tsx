import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  products?: ChatProduct[];
  isError?: boolean;
}

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-3 py-2">
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  </div>
);

const ChatWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!user) {
      setBusinessId(null);
      return;
    }
    const loadBusiness = async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      setBusinessId(data?.id ?? null);
    };
    void loadBusiness();
  }, [user]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: ++idRef.current,
          role: "assistant",
          content: "Hi! I'm your shopping assistant. What are you looking for today?",
        },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

    const previousMessages = messages
      .filter((m) => !m.isError)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

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
          conversation_history: previousMessages,
        }),
      });

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
  }, [input, messages, businessId, user]);

  const panelClasses = isMobile
    ? "fixed inset-0 z-50 flex flex-col bg-card animate-scale-in"
    : "fixed bottom-6 right-6 z-50 w-[380px] max-h-[600px] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-scale-in overflow-hidden";

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-lg transition-transform hover:scale-105 animate-pulse"
          style={{ animationDuration: "2s" }}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="font-semibold text-sm">Go AI</span>
        </button>
      )}

      {open && (
        <div className={panelClasses}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">ShopMind AI</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs text-muted-foreground">Online</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.map((msg) => (
              <div key={msg.id}>
                <div
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : msg.isError
                          ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-md"
                          : "bg-secondary text-secondary-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
                {msg.role === "assistant" &&
                  msg.products &&
                  msg.products.length > 0 && (
                    <div className="flex flex-col gap-3 mt-3">
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
                        />
                      ))}
                    </div>
                  )}
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl rounded-bl-md">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3 flex gap-2">
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
              className="flex-1 h-9 text-sm"
              disabled={typing}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => void sendMessage()}
              disabled={typing}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
