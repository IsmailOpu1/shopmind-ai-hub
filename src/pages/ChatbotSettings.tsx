import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, Bot, MessageCircle, Palette, Copy, CheckCircle2, Loader2, Code } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";

const ChatbotSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [botName, setBotName] = useState("ShopMind AI");
  const [greeting, setGreeting] = useState("Hi! How can I help you today?");
  const [primaryColor, setPrimaryColor] = useState("#1E40AF");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, bot_name, greeting, primary_color")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setBotName(data.bot_name ?? "ShopMind AI");
        setGreeting(data.greeting ?? "Hi! How can I help you today?");
        setPrimaryColor(data.primary_color && data.primary_color.trim() !== "" ? data.primary_color : "#1E40AF");
        setBusinessId(data.id);
      }
      setLoading(false);
    };
    fetchSettings();
  }, [user, authLoading]);

  const handleSave = async () => {
    if (!user) {
      toast.error("You must be logged in.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({ bot_name: botName, greeting, primary_color: primaryColor })
      .eq("owner_id", user.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Chatbot settings updated.");
    }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner message="Loading settings..." />;

  const embedCode = `<script
  src="https://yourdomain.com/embed.js"
  data-business-id="${businessId || 'YOUR_BUSINESS_ID'}"
  data-bot-name="${botName}"
  data-primary-color="${primaryColor}">
</script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Chatbot Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure your AI shopping assistant</p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Settings Form (60%) */}
        <div className="lg:col-span-3">
          <Card className="chatbot-settings-form-card">
            <CardContent className="p-6 space-y-6">
              {/* Bot Name */}
              <div className="space-y-2">
                <Label htmlFor="botName" className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="h-4 w-4 text-blue-400" />
                  Bot Name
                </Label>
                <Input
                  id="botName"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="ShopMind AI"
                  className="chatbot-input-dark"
                />
              </div>

              {/* Greeting Message */}
              <div className="space-y-2">
                <Label htmlFor="greeting" className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircle className="h-4 w-4 text-blue-400" />
                  Greeting Message
                </Label>
                <Textarea
                  id="greeting"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Hi! How can I help you today?"
                  rows={3}
                  className="chatbot-input-dark resize-none"
                />
              </div>


              {/* Primary Color */}
              <div className="space-y-2">
                <Label htmlFor="primaryColor" className="flex items-center gap-2 text-sm font-medium">
                  <Palette className="h-4 w-4 text-blue-400" />
                  Primary Color
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="primaryColor"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-gray-600 bg-transparent p-0.5"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="chatbot-input-dark w-24 font-mono text-sm"
                    placeholder="#1E40AF"
                  />
                  <div 
                    className="w-10 h-10 rounded-lg border border-gray-600"
                    style={{ backgroundColor: primaryColor }}
                  />
                </div>
              </div>

              {/* Save Button */}
              <Button 
                onClick={handleSave} 
                disabled={saving} 
                className="chatbot-save-btn w-full h-11 text-white font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Embed Code (40%) */}
        <div className="lg:col-span-2">
          <Card className="chatbot-preview-card">
            <CardHeader className="border-b border-gray-800">
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="h-5 w-5 text-blue-400" />
                Embed on your website
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Copy this code and paste it before the closing &lt;/body&gt; tag on your website
              </p>
              
              <div className="relative">
                <pre className="bg-[#0d1117] rounded-lg p-4 overflow-x-auto text-xs font-mono text-gray-300 border border-gray-700">
                  <code>{embedCode}</code>
                </pre>
                <Button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 h-8 px-3 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Replace <code className="bg-gray-800 px-1 py-0.5 rounded">yourdomain.com</code> with your actual deployed URL
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChatbotSettings;
