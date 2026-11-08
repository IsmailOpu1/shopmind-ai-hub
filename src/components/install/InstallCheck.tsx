import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, Radar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isRecentSighting, normalizeSiteUrl, siteMatches, timeAgo } from "@/lib/install";

type Sighting = { seenAt: string | null; origin: string | null };
type Status = "idle" | "checking" | "found" | "elsewhere" | "missing";

const POLL_MS = 3000;
const POLL_FOR_MS = 45_000;
const siteKey = (businessId: string) => `shopmind_site_${businessId}`;

/**
 * "Check my site": opens the owner's website (which loads the widget if the
 * code is there) and watches for the chat function to report it.
 */
export default function InstallCheck({ businessId, initial }: { businessId: string; initial: Sighting }) {
  const [site, setSite] = useState(() => {
    try {
      return localStorage.getItem(siteKey(businessId)) ?? "";
    } catch {
      return "";
    }
  });
  const [sighting, setSighting] = useState<Sighting>(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const load = async (): Promise<Sighting> => {
    const { data } = await supabase
      .from("businesses")
      .select("widget_seen_at, widget_seen_origin")
      .eq("id", businessId)
      .maybeSingle();
    const next = { seenAt: data?.widget_seen_at ?? null, origin: data?.widget_seen_origin ?? null };
    setSighting(next);
    return next;
  };

  const check = () => {
    const url = normalizeSiteUrl(site);
    if (!url) {
      setError("Enter your website address, like myshop.com");
      return;
    }
    setError("");
    try {
      localStorage.setItem(siteKey(businessId), site.trim());
    } catch {
      /* storage blocked */
    }
    // Opening the site loads the widget there, if the code is installed.
    window.open(url, "_blank", "noopener");
    window.clearTimeout(timer.current);
    setStatus("checking");
    const until = Date.now() + POLL_FOR_MS;

    const poll = async () => {
      const s = await load().catch(() => null);
      if (s && isRecentSighting(s.seenAt) && siteMatches(s.origin, url)) {
        setStatus("found");
        return;
      }
      if (Date.now() < until) {
        timer.current = window.setTimeout(poll, POLL_MS);
        return;
      }
      setStatus(s && isRecentSighting(s.seenAt) && s.origin ? "elsewhere" : "missing");
    };
    timer.current = window.setTimeout(poll, POLL_MS);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Check my site</p>
        <p className="text-xs text-muted-foreground">
          After pasting the code and saving, enter your website address. We'll open it and confirm the chat is there.
        </p>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <Input
          aria-label="Your website address"
          inputMode="url"
          autoComplete="url"
          placeholder="myshop.com"
          value={site}
          onChange={(e) => setSite(e.target.value)}
          className="chatbot-input-dark"
        />
        <Button type="submit" disabled={status === "checking"} className="shrink-0">
          {status === "checking" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Radar className="mr-2 h-4 w-4" />
          )}
          {status === "checking" ? "Checking..." : "Check my site"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}

      <div aria-live="polite">
        {status === "checking" && (
          <p className="text-xs text-slate-400">
            Your site opened in a new tab. Keep it open for a few seconds while we look for the chat...
          </p>
        )}
        {status === "found" && sighting.origin && (
          <Result ok title="It works! The chat is on your website.">
            Seen on {sighting.origin}. Shoppers can start chatting now.
          </Result>
        )}
        {status === "elsewhere" && sighting.origin && (
          <Result ok={false} title="The chat is installed, but on a different address.">
            We saw it on {sighting.origin}, not on the address you entered. Check that you added the code to the right
            site, or enter that address instead.
          </Result>
        )}
        {status === "missing" && (
          <Result ok={false} title="We couldn't find the chat on your website yet.">
            Make sure you pasted the code, saved, and published your site. Some builders take a minute to update.
            Then try again.
          </Result>
        )}
        {status === "idle" && sighting.seenAt && sighting.origin && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-300/90">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Last seen on {sighting.origin}, {timeAgo(sighting.seenAt)}.
          </p>
        )}
      </div>
    </div>
  );
}

function Result({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : CircleAlert;
  return (
    <div
      className={`flex gap-2.5 rounded-lg border p-3 text-xs ${
        ok ? "border-emerald-400/25 bg-emerald-400/5 text-emerald-100" : "border-amber-400/25 bg-amber-400/5 text-amber-100"
      }`}
    >
      <Icon className={`mt-px h-4 w-4 shrink-0 ${ok ? "text-emerald-300" : "text-amber-300"}`} />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 opacity-80">{children}</p>
      </div>
    </div>
  );
}
