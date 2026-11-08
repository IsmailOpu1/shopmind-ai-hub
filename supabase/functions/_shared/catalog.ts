// Live catalog: read a store's products from its public Shopify or
// WooCommerce product feed (no passwords or API keys needed) and turn them
// into ShopMind product rows.

export type Platform = "shopify" | "woocommerce";
export const PLATFORMS: Platform[] = ["shopify", "woocommerce"];

export type CatalogVariant = { size?: string; colour?: string; stock_status: "in_stock" | "out_of_stock" };

export type CatalogProduct = {
  external_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  image_url: string | null;
  product_url: string | null;
  sku: string | null;
  stock_status: "in_stock" | "out_of_stock";
  promo: string | null;
  variants: CatalogVariant[];
};

/** Most products one store syncs (keeps AI indexing cost and time bounded). */
export const MAX_SYNC_PRODUCTS = 2000;
const MAX_VARIANTS = 50;
const MAX_DESCRIPTION = 2000;

// --- Store address -----------------------------------------------------------

const BLOCKED_HOSTS = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|metadata\.google\.internal)$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * The store's base URL ("https://shop.com"), or null when it isn't a public
 * https website. Raw IP addresses and internal names are refused so the
 * server can't be pointed at private networks.
 */
export function normalizeStoreUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > 200) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || BLOCKED_HOSTS.test(host) || IPV4.test(host) || host.startsWith("[")) return null;
  return `https://${host}`;
}

/** True for addresses in private, loopback, link-local or reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19));
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") ||
    v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") ||
    v6.startsWith("::ffff:");
}

// --- Fetching ----------------------------------------------------------------

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export type Resolver = (host: string) => Promise<string[]>;

/** DNS lookup (Deno) used to refuse stores that resolve to private addresses. */
export const resolveHost: Resolver = async (host) => {
  const out: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      out.push(...(await Deno.resolveDns(host, type)));
    } catch {
      /* no records of this type, or lookups unavailable */
    }
  }
  return out;
};

export class CatalogError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const FETCH_TIMEOUT_MS = 15_000;

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(new DOMException("timed out", "TimeoutError")), ms);
  return c.signal;
}
const MAX_BODY_BYTES = 6 * 1024 * 1024;

/**
 * GETs JSON from the store, following at most 3 redirects and re-checking
 * every hop (https, public host, public IP), with a timeout and size cap.
 */
export async function fetchStoreJson(
  url: string,
  fetcher: Fetcher,
  resolve: Resolver | null,
): Promise<{ status: number; data: unknown }> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const parsed = new URL(current);
    if (parsed.protocol !== "https:" || !normalizeStoreUrl(parsed.origin)) {
      throw new CatalogError("The store redirected to an address we can't read.");
    }
    if (resolve) {
      const ips = await resolve(parsed.hostname).catch(() => [] as string[]);
      if (ips.some(isPrivateAddress)) throw new CatalogError("That address isn't a public website.");
    }
    let res: Response;
    try {
      res = await fetcher(current, {
        redirect: "manual",
        headers: { Accept: "application/json", "User-Agent": "ShopMindCatalogSync/1.0" },
        signal: timeoutSignal(FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      const timedOut = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new CatalogError(
        timedOut
          ? "Your store took too long to answer. Try again in a minute."
          : "We couldn't reach that website. Check the address and try again.",
      );
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) throw new CatalogError("The store sent a redirect without an address.");
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      return { status: res.status, data: null };
    }
    const text = await readCapped(res);
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, data: null };
    }
  }
  throw new CatalogError("The store redirected too many times.");
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new CatalogError("The store's product list is too large to read.");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

// --- Text helpers --------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** Product descriptions arrive as HTML; the assistant needs plain text. */
export function htmlToText(html: unknown, max = MAX_DESCRIPTION): string | null {
  if (typeof html !== "string") return null;
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      const k = e.toLowerCase();
      if (k in ENTITIES) return ENTITIES[k];
      if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16) || 32);
      if (k.startsWith("#")) return String.fromCodePoint(Number(k.slice(1)) || 32);
      return m;
    })
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, max) : null;
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const money = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

const httpsUrl = (v: unknown): string | null => {
  const s = str(v, 1000);
  if (!s) return null;
  const full = s.startsWith("//") ? `https:${s}` : s;
  return /^https?:\/\//i.test(full) ? full : null;
};

const isSize = (name: string) => /\b(size|sizes|taille|größe|talla)\b/i.test(name);
const isColour = (name: string) => /\b(colou?rs?|shade|farbe)\b/i.test(name);

function dedupeVariants(list: CatalogVariant[]): CatalogVariant[] {
  const seen = new Map<string, CatalogVariant>();
  for (const v of list) {
    const key = `${v.colour ?? ""}|${v.size ?? ""}`.toLowerCase();
    const prev = seen.get(key);
    // A size/colour is in stock if any matching variant is.
    if (!prev) seen.set(key, v);
    else if (v.stock_status === "in_stock") prev.stock_status = "in_stock";
  }
  return [...seen.values()].slice(0, MAX_VARIANTS);
}

// --- Shopify (public /products.json) ----------------------------------------------

type ShopifyVariant = {
  sku?: unknown;
  price?: unknown;
  compare_at_price?: unknown;
  available?: unknown;
  option1?: unknown;
  option2?: unknown;
  option3?: unknown;
};

export function mapShopifyProduct(raw: unknown, base: string): CatalogProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = str(p.id, 100);
  const name = str(p.title, 300);
  if (!id || !name) return null;

  const variants = (Array.isArray(p.variants) ? p.variants : []) as ShopifyVariant[];
  const options = (Array.isArray(p.options) ? p.options : []) as Array<{ name?: unknown; position?: unknown }>;
  const optionKey = (test: (n: string) => boolean): "option1" | "option2" | "option3" | null => {
    const o = options.find((x) => typeof x?.name === "string" && test(x.name));
    const pos = Number(o?.position);
    return pos >= 1 && pos <= 3 ? (`option${pos}` as "option1") : null;
  };
  const sizeKey = optionKey(isSize);
  const colourKey = optionKey(isColour);

  const prices = variants.map((v) => money(v.price)).filter((n): n is number => n !== null);
  const price = prices.length ? Math.min(...prices) : null;
  const inStock = variants.length === 0 || variants.some((v) => v.available !== false);
  const cheapest = variants.find((v) => money(v.price) === price);
  const wasPrice = cheapest ? money(cheapest.compare_at_price) : null;

  const mapped: CatalogVariant[] = [];
  if (sizeKey || colourKey) {
    for (const v of variants) {
      const size = sizeKey ? str(v[sizeKey], 20) ?? undefined : undefined;
      const colour = colourKey ? str(v[colourKey], 30) ?? undefined : undefined;
      if (size || colour) mapped.push({ size, colour, stock_status: v.available === false ? "out_of_stock" : "in_stock" });
    }
  }

  const images = Array.isArray(p.images) ? p.images as Array<{ src?: unknown }> : [];
  const handle = str(p.handle, 300);
  return {
    external_id: id,
    name,
    description: htmlToText(p.body_html),
    category: str(p.product_type, 100),
    price,
    image_url: httpsUrl(images[0]?.src),
    product_url: handle ? `${base}/products/${encodeURIComponent(handle)}` : null,
    sku: str(variants[0]?.sku, 100),
    stock_status: inStock ? "in_stock" : "out_of_stock",
    promo: price !== null && wasPrice !== null && wasPrice > price ? `On sale (was ${wasPrice})` : null,
    variants: dedupeVariants(mapped),
  };
}

// --- WooCommerce (public Store API) -----------------------------------------------

export function mapWooProduct(raw: unknown): CatalogProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = str(p.id, 100);
  const name = htmlToText(p.name, 300);
  if (!id || !name) return null;

  const prices = (p.prices && typeof p.prices === "object" ? p.prices : {}) as Record<string, unknown>;
  const unit = Number(prices.currency_minor_unit);
  const scale = Number.isInteger(unit) && unit >= 0 && unit <= 4 ? 10 ** unit : 100;
  const toMoney = (v: unknown) => {
    const n = money(v);
    return n === null ? null : Math.round((n / scale) * 100) / 100;
  };
  const price = toMoney(prices.price);
  const regular = toMoney(prices.regular_price);
  const inStock = p.is_in_stock !== false;

  const mapped: CatalogVariant[] = [];
  const attributes = (Array.isArray(p.attributes) ? p.attributes : []) as Array<{ name?: unknown; terms?: unknown }>;
  // The list API gives the sizes/colours on offer, not per-combination stock.
  const status = inStock ? "in_stock" : "out_of_stock";
  for (const a of attributes) {
    const label = typeof a?.name === "string" ? a.name : "";
    const kind = isSize(label) ? "size" : isColour(label) ? "colour" : null;
    if (!kind || !Array.isArray(a.terms)) continue;
    for (const t of a.terms as Array<{ name?: unknown }>) {
      const value = str(t?.name, kind === "size" ? 20 : 30);
      if (value) mapped.push(kind === "size" ? { size: value, stock_status: status } : { colour: value, stock_status: status });
    }
  }

  const images = Array.isArray(p.images) ? p.images as Array<{ src?: unknown }> : [];
  const categories = Array.isArray(p.categories) ? p.categories as Array<{ name?: unknown }> : [];
  return {
    external_id: id,
    name,
    description: htmlToText(p.short_description) ?? htmlToText(p.description),
    category: htmlToText(categories[0]?.name, 100),
    price,
    image_url: httpsUrl(images[0]?.src),
    product_url: httpsUrl(p.permalink),
    sku: str(p.sku, 100),
    stock_status: status,
    promo: price !== null && regular !== null && regular > price ? `On sale (was ${regular})` : null,
    variants: dedupeVariants(mapped),
  };
}

// --- Reading a whole catalog -----------------------------------------------------------

const SHOPIFY_PAGE = 250;
const WOO_PAGE = 100;

export function pageUrl(platform: Platform, base: string, page: number, plainPermalinks = false): string {
  if (platform === "shopify") return `${base}/products.json?limit=${SHOPIFY_PAGE}&page=${page}`;
  return plainPermalinks
    ? `${base}/?rest_route=/wc/store/v1/products&per_page=${WOO_PAGE}&page=${page}`
    : `${base}/wp-json/wc/store/v1/products?per_page=${WOO_PAGE}&page=${page}`;
}

/**
 * Reads the store's products page by page. `limit` stops early (used for
 * the quick preview); errors explain in plain words what to check.
 */
export async function readCatalog(
  platform: Platform,
  base: string,
  fetcher: Fetcher,
  resolve: Resolver | null,
  limit = MAX_SYNC_PRODUCTS,
): Promise<{ products: CatalogProduct[]; truncated: boolean }> {
  const products: CatalogProduct[] = [];
  const seen = new Set<string>();
  const pageSize = platform === "shopify" ? SHOPIFY_PAGE : WOO_PAGE;
  let plain = false;

  for (let page = 1; products.length < limit; page++) {
    let res = await fetchStoreJson(pageUrl(platform, base, page, plain), fetcher, resolve);
    if (platform === "woocommerce" && page === 1 && !Array.isArray(res.data)) {
      // Stores with "plain" permalinks don't serve /wp-json/.
      plain = true;
      res = await fetchStoreJson(pageUrl(platform, base, page, plain), fetcher, resolve);
    }
    const list = platform === "shopify"
      ? (res.data as { products?: unknown } | null)?.products
      : res.data;
    if (!Array.isArray(list)) {
      if (page === 1) {
        throw new CatalogError(
          platform === "shopify"
            ? "We couldn't read products from that address. Check it's your Shopify store's address and the store is open (not password-protected)."
            : "We couldn't read products from that address. Check it's your WordPress site's address and WooCommerce is active.",
        );
      }
      break;
    }
    for (const raw of list) {
      const mapped = platform === "shopify" ? mapShopifyProduct(raw, base) : mapWooProduct(raw);
      if (!mapped || seen.has(mapped.external_id)) continue;
      seen.add(mapped.external_id);
      products.push(mapped);
      if (products.length >= limit) break;
    }
    if (list.length < pageSize) return { products, truncated: false };
  }
  return { products, truncated: products.length >= limit };
}
