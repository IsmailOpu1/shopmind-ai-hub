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
import { Save } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";

const ChatbotSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [botName, setBotName] = useState("ShopMind AI");
  const [greeting, setGreeting] = useState("Hi! How can I help you today?");
  const [fabPosition, setFabPosition] = useState("bottom-right");
  const [primaryColor, setPrimaryColor] = useState("#1E40AF");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, bot_name, greeting, fab_position, primary_color")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setBotName(data.bot_name ?? "ShopMind AI");
        setGreeting(data.greeting ?? "Hi! How can I help you today?");
        setFabPosition(data.fab_position ?? "bottom-right");
        setPrimaryColor(data.primary_color ?? "#1E40AF");
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
      .update({ bot_name: botName, greeting, fab_position: fabPosition, primary_color: primaryColor })
      .eq("owner_id", user.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Chatbot settings updated.");
    }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner message="Loading settings..." />;

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
