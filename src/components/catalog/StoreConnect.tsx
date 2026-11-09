import { useState } from "react";
import { CheckCircle2, Link2, Loader2, RefreshCw, Store, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type CatalogPreview, PLATFORM_NAMES, type Platform, type SyncResult, catalogRequest, describeSync } from "@/lib/catalog";
import { timeAgo } from "@/lib/install";
import { formatPrice } from "@/lib/utils";

export type CatalogConnection = {
  platform: Platform | null;
  url: string | null;
  syncedAt: string | null;
  error: string | null;
  count: number | null;
};

type Props = {
  connection: CatalogConnection;
  currency: string;
  /** Called after products changed (connect, sync, disconnect). */
  onChanged: () => void;
};

const HINTS: Record<Platform, string> = {
  shopify: "Your store's address, like myshop.com or myshop.myshopify.com",
  woocommerce: "Your WordPress site's address, like myshop.com",
};

/** "Connect your store": imports and keeps Shopify / WooCommerce products in sync. */
export default function StoreConnect({ connection, currency, onChanged }: Props) {
  const [platform, setPlatform] = useState<Platform>("shopify");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<CatalogPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "connect" | "sync" | "disconnect" | null>(null);
  const [error, setError] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const run = async <T,>(kind: NonNullable<typeof busy>, fn: () => Promise<T>): Promise<T | null> => {
    setBusy(kind);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const findProducts = async () => {
    if (!url.trim()) {
      setError("Enter your store's address.");
      return;
    }
    setPreview(await run("preview", () => catalogRequest<CatalogPreview>({ action: "preview", platform, url })));
  };

  const connect = async () => {
    const r = await run("connect", () => catalogRequest<SyncResult>({ action: "connect", platform, url }));
    if (!r) return;
    toast.success(`Connected! ${describeSync(r)}`);
    setPreview(null);
    setUrl("");
    onChanged();
  };

  const syncNow = async () => {
    const r = await run("sync", () => catalogRequest<SyncResult>({ action: "sync" }));
    if (!r) return;
    toast.success(describeSync(r));
    onChanged();
  };

  const disconnect = async (removeProducts: boolean) => {
    setConfirmDisconnect(false);
    const r = await run("disconnect", () => catalogRequest({ action: "disconnect", remove_products: removeProducts }));
    if (!r) return;
    toast.success(removeProducts ? "Disconnected and removed the store's products." : "Disconnected. The products stay as they are.");
    onChanged();
  };

  // --- Connected -----------------------------------------------------------
  if (connection.platform && connection.url) {
    const name = PLATFORM_NAMES[connection.platform];
    return (
      <section className="ui-card rounded-2xl border p-4 sm:p-5" aria-label="Connected store">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-white">
                Connected to {name}: <span className="break-all font-normal text-slate-300">{connection.url.replace(/^https:\/\//, "")}</span>
              </p>
              <p className="text-xs text-slate-400">
                {connection.count ?? 0} products
                {connection.syncedAt ? ` · synced ${timeAgo(connection.syncedAt)}` : ""} · updates automatically every few hours
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={syncNow} disabled={busy !== null}>
              {busy === "sync" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {busy === "sync" ? "Syncing..." : "Sync now"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDisconnect(true)} disabled={busy !== null}>
              <Unplug className="mr-2 h-4 w-4" /> Disconnect
            </Button>
          </div>
        </div>
        {(error || connection.error) && (
          <p role="alert" className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/5 p-2.5 text-xs text-amber-100">
            {error || `Last sync failed: ${connection.error}`}
          </p>
        )}

        <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect {name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Products will stop updating from your store. You can keep the products you have now, or remove them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button variant="outline" onClick={() => void disconnect(true)}>
                Disconnect and remove products
              </Button>
              <AlertDialogAction onClick={() => void disconnect(false)}>Disconnect, keep products</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    );
  }

  // --- Not connected -------------------------------------------------------
  return (
    <section className="ui-card rounded-2xl border p-4 sm:p-5" aria-labelledby="connect-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
          <Store className="h-5 w-5" />
        </span>
        <div>
          <h2 id="connect-title" className="font-semibold text-white">Connect your store</h2>
          <p className="text-xs text-slate-400">
            Import your products and keep prices and stock up to date automatically. No passwords or codes needed.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div role="group" aria-label="Store platform" className="flex flex-wrap gap-2">
          {(Object.keys(PLATFORM_NAMES) as Platform[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={platform === p}
              onClick={() => {
                setPlatform(p);
                setPreview(null);
                setError("");
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                platform === p
                  ? "border-blue-400/60 bg-blue-500/20 text-blue-200"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              {PLATFORM_NAMES[p]}
            </button>
          ))}
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void findProducts();
          }}
        >
          <Input
            aria-label="Store address"
            inputMode="url"
            placeholder={platform === "shopify" ? "myshop.com" : "myshop.com"}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreview(null);
            }}
            className="chatbot-input-dark"
          />
          <Button type="submit" variant="outline" disabled={busy !== null} className="shrink-0">
            {busy === "preview" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            {busy === "preview" ? "Looking..." : "Find my products"}
          </Button>
        </form>
        <p className="text-xs text-slate-500">{HINTS[platform]}</p>

        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}

        {preview && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm text-white">
              Found {preview.truncated ? `${preview.total}+` : preview.total} product{preview.total === 1 ? "" : "s"} at{" "}
              {preview.url.replace(/^https:\/\//, "")}
            </p>
            {preview.sample.length > 0 && (
              <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {preview.sample.map((p) => (
                  <li key={p.name} className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="aspect-square w-full bg-white/[0.04]" />
                    )}
                    <p className="truncate px-2 pt-1.5 text-xs text-slate-200">{p.name}</p>
                    <p className="px-2 pb-1.5 text-xs text-slate-400">{p.price != null ? formatPrice(p.price, currency) : "—"}</p>
                  </li>
                ))}
              </ul>
            )}
            <Button className="mt-3" onClick={() => void connect()} disabled={busy !== null || preview.total === 0}>
              {busy === "connect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {busy === "connect" ? "Importing... this can take a minute" : "Connect and import"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
