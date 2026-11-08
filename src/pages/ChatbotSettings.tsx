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
import { Save, Bot, MessageCircle, Palette, Copy, CheckCircle2, Loader2, Code, Coins, PanelRight, ShoppingCart, Sparkles, ImageIcon, Upload, Trash2 } from "lucide-react";
import { CURRENCIES } from "@/lib/utils";
import { type CartMode, validateCartTemplate } from "@/lib/cart";
import { markOnboarding } from "@/lib/onboarding-data";
import { AVATAR_TYPES, TONE_OPTIONS, type ToneValue, avatarPathFromUrl, validateAvatar } from "@/lib/tone";
import LoadingSpinner from "@/components/LoadingSpinner";

const ChatbotSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [botName, setBotName] = useState("ShopMind AI");
  const [greeting, setGreeting] = useState("Hi! How can I help you today?");
  const [primaryColor, setPrimaryColor] = useState("#1E40AF");
  const [fabPosition, setFabPosition] = useState("bottom-right");
  const [currency, setCurrency] = useState("BDT");
  const [cartMode, setCartMode] = useState<CartMode>("off");
  const [cartUrlTemplate, setCartUrlTemplate] = useState("");
  const [tone, setTone] = useState<ToneValue>("friendly");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // The logo saved in the database, so a replaced one can be deleted after saving.
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
        .select("id, bot_name, greeting, primary_color, fab_position, currency, cart_mode, cart_url_template, tone, avatar_url")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setBotName(data.bot_name ?? "ShopMind AI");
        setGreeting(data.greeting ?? "Hi! How can I help you today?");
        setPrimaryColor(data.primary_color && data.primary_color.trim() !== "" ? data.primary_color : "#1E40AF");
        setFabPosition(data.fab_position ?? "bottom-right");
        setCurrency(data.currency ?? "BDT");
        setCartMode((data.cart_mode as CartMode) ?? "off");
        setCartUrlTemplate(data.cart_url_template ?? "");
        setTone(TONE_OPTIONS.some((t) => t.value === data.tone) ? (data.tone as ToneValue) : "friendly");
        setAvatarUrl(data.avatar_url ?? null);
        setSavedAvatarUrl(data.avatar_url ?? null);
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
    if (!botName.trim() || botName.trim().length > 40) {
      toast.error("Bot name must be 1-40 characters.");
      return;
    }
    if (greeting.length > 300) {
      toast.error("Greeting must be 300 characters or fewer.");
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      toast.error("Primary color must be a hex value like #1E40AF.");
      return;
    }
    if (cartMode === "url") {
      const cartError = validateCartTemplate(cartUrlTemplate);
      if (cartError) {
        toast.error(cartError);
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        bot_name: botName.trim(),
        greeting,
        primary_color: primaryColor,
        fab_position: fabPosition,
        currency,
        cart_mode: cartMode,
        cart_url_template: cartMode === "url" ? cartUrlTemplate.trim() : cartUrlTemplate.trim() || null,
        tone,
        avatar_url: avatarUrl,
      })
      .eq("owner_id", user.id);

    if (error) {
      toast.error(error.message);
    } else {
      // The old logo is no longer used anywhere once the new one is saved.
      const oldPath = avatarPathFromUrl(savedAvatarUrl);
      if (oldPath && savedAvatarUrl !== avatarUrl) {
        void supabase.storage.from("bot-avatars").remove([oldPath]);
      }
      setSavedAvatarUrl(avatarUrl);
      toast.success("Chatbot settings updated.");
      if (businessId) void markOnboarding(businessId, "customized_at");
    }
    setSaving(false);
  };

  // Drops an uploaded logo that was never saved (it isn't used anywhere).
  const discardUnsaved = () => {
    const unsaved = avatarPathFromUrl(avatarUrl);
    if (unsaved && avatarUrl !== savedAvatarUrl) void supabase.storage.from("bot-avatars").remove([unsaved]);
  };

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file || !businessId) return;
    const problem = validateAvatar(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${businessId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("bot-avatars")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    discardUnsaved();
    setAvatarUrl(supabase.storage.from("bot-avatars").getPublicUrl(path).data.publicUrl);
    toast.success("Logo uploaded. Save settings to use it.");
  };

  const handleAvatarRemove = () => {
    discardUnsaved();
    setAvatarUrl(null);
  };

  if (loading) return <LoadingSpinner message="Loading settings..." />;

  // Name, greeting, colour, position and currency are loaded from these settings at runtime.
  const embedCode = `<script
  src="${window.location.origin}/embed.js"
  data-business-id="${businessId || "YOUR_BUSINESS_ID"}"
  defer>
</script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    if (businessId) void markOnboarding(businessId, "embed_copied_at");
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


              {/* Tone */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  Tone
                </Label>
                <Select value={tone} onValueChange={(v) => setTone(v as ToneValue)}>
                  <SelectTrigger className="chatbot-input-dark" aria-label="Tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  For example: &ldquo;{TONE_OPTIONS.find((t) => t.value === tone)?.example}&rdquo; The tone only changes
                  how replies sound; the assistant still answers only from your products and store info.
                </p>
              </div>

              {/* Logo */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <ImageIcon className="h-4 w-4 text-blue-400" />
                  Logo
                </Label>
                <div className="flex items-center gap-3">
                  <div
                    className="h-12 w-12 rounded-full border border-gray-600 overflow-hidden flex items-center justify-center shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Chatbot logo" className="h-full w-full object-cover" />
                    ) : (
                      <Bot className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept={AVATAR_TYPES.join(",")}
                      className="sr-only"
                      aria-label="Upload logo"
                      disabled={uploading || !businessId}
                      onChange={(e) => {
                        void handleAvatarFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center rounded-md border border-gray-600 px-3 h-9 text-sm cursor-pointer hover:bg-gray-800">
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {avatarUrl ? "Replace" : "Upload"}
                    </span>
                  </label>
                  {avatarUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleAvatarRemove} aria-label="Remove logo">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Shown in the chat header and next to the assistant&rsquo;s replies. PNG, JPG or WebP, up to 512 KB; a
                  square image works best.
                </p>
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

              {/* Position + Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <PanelRight className="h-4 w-4 text-blue-400" />
                    Button Position
                  </Label>
                  <Select value={fabPosition} onValueChange={setFabPosition}>
                    <SelectTrigger className="chatbot-input-dark">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-right">Bottom right</SelectItem>
                      <SelectItem value="bottom-left">Bottom left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Coins className="h-4 w-4 text-blue-400" />
                    Currency
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="chatbot-input-dark">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Add to cart */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <ShoppingCart className="h-4 w-4 text-blue-400" />
                  "Add to cart" button on product cards
                </Label>
                <Select value={cartMode} onValueChange={(v) => setCartMode(v as CartMode)}>
                  <SelectTrigger className="chatbot-input-dark" aria-label="Add to cart mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off (only "View product")</SelectItem>
                    <SelectItem value="url">Open my store's add-to-cart link</SelectItem>
                    <SelectItem value="event">Send a browser event (for developers)</SelectItem>
                  </SelectContent>
                </Select>
                {cartMode === "url" && (
                  <div className="space-y-1.5">
                    <Input
                      id="cartUrlTemplate"
                      aria-label="Add-to-cart link"
                      value={cartUrlTemplate}
                      onChange={(e) => setCartUrlTemplate(e.target.value)}
                      placeholder="/cart/add?id={sku}&quantity=1"
                      className="chatbot-input-dark font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use <code>{"{sku}"}</code>, <code>{"{id}"}</code> or <code>{"{product_url}"}</code>. On
                      Shopify, put each variant ID in the <code>sku</code> column of your catalog and use{" "}
                      <code>{"/cart/add?id={sku}&quantity=1"}</code>.
                    </p>
                  </div>
                )}
                {cartMode === "event" && (
                  <p className="text-xs text-muted-foreground">
                    The widget fires <code>shopmind:add-to-cart</code> on <code>window</code> with{" "}
                    <code>{"{ id, sku, name, price, product_url }"}</code>; your site's code adds the item.
                  </p>
                )}
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
                Changes you save here apply to the widget automatically. Optional attributes:{" "}
                <code className="bg-gray-800 px-1 py-0.5 rounded">data-proactive-delay="off"</code> turns off the
                30-second help prompt, and{" "}
                <code className="bg-gray-800 px-1 py-0.5 rounded">data-enable-cart="true"</code> shows an Add to cart
                button that fires a <code className="bg-gray-800 px-1 py-0.5 rounded">shopmind:add-to-cart</code> event.
              </p>

              <div className="space-y-2 pt-2 border-t border-gray-800">
                <p className="text-sm font-medium">Connect your cart (optional)</p>
                <p className="text-xs text-muted-foreground">
                  Tell the assistant what's in the shopper's cart so it can answer about it and suggest items that go
                  with it. Call this whenever the cart changes, using the SKUs from your product list:
                </p>
                <pre className="bg-[#0d1117] rounded-lg p-3 overflow-x-auto text-xs font-mono text-gray-300 border border-gray-700">
                  <code>{`ShopMind.setCart([
  { sku: "SHT-OXF-01", quantity: 1 },
]);`}</code>
                </pre>
                <p className="text-xs text-muted-foreground">
                  Only SKUs and quantities are sent; names and prices come from your catalog. Items added with the
                  widget's own Add to cart button are remembered automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChatbotSettings;
