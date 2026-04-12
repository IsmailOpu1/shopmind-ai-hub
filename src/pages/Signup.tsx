import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Brain, Zap, Globe, MessageSquare, TrendingUp } from "lucide-react";
import { useEffect } from "react";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [featuresVisible, setFeaturesVisible] = useState(false);

  useEffect(() => {
    setFeaturesVisible(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password, businessName);
      toast({ title: "Account created!", description: "Please check your email to verify your account." });
      navigate("/login");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Zap, text: "RAG-powered product recommendations" },
    { icon: Globe, text: "Embeddable on any website" },
    { icon: MessageSquare, text: "Real-time customer conversations" },
    { icon: TrendingUp, text: "Boost conversions automatically" },
  ];

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      {/* Left Side - 60% width */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden" style={{ backgroundColor: "#0A0F1E" }}>
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 grid-pattern opacity-50" />

        {/* Animated gradient mesh - more visible */}
        <div className="absolute inset-0 opacity-50">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-purple-900/70 to-blue-900/70 animate-gradient-shift" />
        </div>

        {/* Floating dot particles drifting upward */}
        <div className="absolute inset-0">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-blue-400/30 animate-float-up"
              style={{
                width: Math.random() * 6 + 2 + "px",
                height: Math.random() * 6 + 2 + "px",
                left: Math.random() * 100 + "%",
                animationDelay: Math.random() * 10 + "s",
                animationDuration: Math.random() * 15 + 20 + "s",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between px-16 py-20 h-full">
          {/* Bottom glowing orb */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bottom-glow-orb" />

          <div className="mb-8 relative">
            <div className="flex items-center gap-4 mb-4">
              <Brain className="h-12 w-12 text-blue-400" />
              <h1 className="text-7xl font-bold text-gradient-blue-purple text-gradient-glow">ShopMind AI</h1>
            </div>
            <p className="text-2xl text-gray-300">The AI shopkeeper for your store</p>
          </div>

          <div className="space-y-4 my-12">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-4 text-white/90 animate-fade-in feature-pill"
                style={{
                  animationDelay: `${index * 0.15}s`,
                  opacity: featuresVisible ? 1 : 0,
                  transform: featuresVisible ? "translateX(0)" : "translateX(-20px)",
                }}
              >
                <feature.icon className="h-6 w-6" />
                <span className="text-lg">{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="pt-12">
            <p className="text-sm text-gray-400">Trusted by smart store owners</p>
          </div>
        </div>

        {/* Glowing vertical divider */}
        <div className="absolute right-0 top-0 bottom-0 w-px divider-gradient" />
      </div>

      {/* Right Side - 40% width */}
      <div className="w-full lg:w-[40%] flex items-center justify-center px-6 py-12 overflow-x-hidden" style={{ backgroundColor: "#111827" }}>
        <div className="w-full max-w-md animate-fade-in rounded-2xl form-card-enhanced overflow-hidden">
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-white mb-2">Get started</h2>
            <p className="text-gray-400">Create your ShopMind AI account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-gray-300">Business Name</Label>
              <Input
                id="businessName"
                placeholder="Your business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="input-enhanced text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-enhanced text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-enhanced text-white placeholder:text-gray-500"
              />
            </div>

            <Button
              type="submit"
              className="w-full button-shimmer text-white font-medium"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Sign Up"}
            </Button>

            <p className="text-sm text-gray-400 text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 hover:underline transition-colors">
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
