import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProductCard from "./ProductCard";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  showProducts?: boolean;
}

const SAMPLE_PRODUCTS = [
  {
    name: "Wireless Headphones",
    category: "Electronics",
    price: 79.99,
    description: "Premium noise-cancelling wireless headphones with 30-hour battery life.",
    image_url: null,
    stock_status: "in_stock",
    promo: "20% OFF",
  },
  {
    name: "Cotton T-Shirt",
    category: "Apparel",
    price: 24.99,
    description: "Soft, breathable 100% organic cotton t-shirt available in multiple colors.",
    image_url: null,
    stock_status: "in_stock",
    promo: null,
  },
];

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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

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
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: ++idRef.current, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    setTimeout(() => {
      const isShowProducts = text.toLowerCase().includes("show products");
      const reply: Message = {
        id: ++idRef.current,
        role: "assistant",
        content: isShowProducts
          ? "Here are some products you might like:"
          : "I'm still being set up! Check back soon.",
        showProducts: isShowProducts,
      };
      setTyping(false);
      setMessages((prev) => [...prev, reply]);
    }, 1200);
  };

  return (
    <>
      {/* FAB */}
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

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[600px] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-scale-in overflow-hidden">
          {/* Header */}
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

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
            {messages.map((msg) => (
              <div key={msg.id}>
                <div
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-secondary-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
                {msg.showProducts && (
                  <div className="flex flex-col gap-3 mt-3">
                    {SAMPLE_PRODUCTS.map((p, i) => (
                      <ProductCard key={i} {...p} />
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

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 h-9 text-sm"
            />
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendMessage}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
