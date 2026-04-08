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
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const ChatbotSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [botName, setBotName] = useState("ShopMind AI");
  const [greeting, setGreeting] = useState("Hi! How can I help you today?");
  const [fabPosition, setFabPosition] = useState("bottom-right");
  const [primaryColor, setPrimaryColor] = useState("#1E40AF");

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, bot_name, greeting")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setBusinessId(data.id);
        setBotName(data.bot_name ?? "ShopMind AI");
        setGreeting(data.greeting ?? "Hi! How can I help you today?");
      }
      setLoading(false);
    };
    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({ bot_name: botName, greeting })
      .eq("id", businessId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Chatbot settings updated." });
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Chatbot Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Appearance & Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="botName">Bot Name</Label>
            <Input
              id="botName"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="ShopMind AI"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="greeting">Greeting Message</Label>
            <Textarea
              id="greeting"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Hi! How can I help you today?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fabPosition">FAB Position</Label>
            <Select value={fabPosition} onValueChange={setFabPosition}>
              <SelectTrigger id="fabPosition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="primaryColor"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
              />
              <span className="text-sm text-muted-foreground">{primaryColor}</span>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="mt-2">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatbotSettings;
