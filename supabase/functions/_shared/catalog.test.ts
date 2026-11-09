import { describe, expect, it } from "vitest";
import {
  CatalogError,
  type Fetcher,
  fetchStoreJson,
  htmlToText,
  isPrivateAddress,
  mapShopifyProduct,
  mapWooProduct,
  normalizeStoreUrl,
  readCatalog,
} from "./catalog";
import { needsAutoSync, planSync } from "./catalog-sync";

describe("normalizeStoreUrl", () => {
  it("accepts store addresses and keeps only the https origin", () => {
    expect(normalizeStoreUrl("myshop.com")).toBe("https://myshop.com");
    expect(normalizeStoreUrl("https://MyShop.myshopify.com/collections/all")).toBe("https://myshop.myshopify.com");
    expect(normalizeStoreUrl("http://shop.example.co.uk")).toBe("https://shop.example.co.uk");
  });

  it("refuses private, local and odd addresses", () => {
    for (const bad of [
      "localhost",
      "http://127.0.0.1",
      "https://10.0.0.5",
      "https://[::1]",
      "https://169.254.169.254/latest/meta-data",
      "https://printer.local",
      "https://db.internal",
      "https://user:pass@shop.com",
      "https://shop.com:8443",
      "ftp://shop.com",
      "",
      42,
    ]) {
      expect(normalizeStoreUrl(bad), String(bad)).toBeNull();
    }
  });
});

describe("isPrivateAddress", () => {
  it("flags private and reserved ranges", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["23.227.38.65", "104.16.0.1", "2606:4700::1"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

const jsonResponse = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(data === undefined ? null : JSON.stringify(data), { status, headers });

describe("fetchStoreJson", () => {
  it("follows a safe redirect but refuses one to a private address", async () => {
    const calls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      calls.push(url);
      if (url === "https://a.com/x") return jsonResponse(undefined, 301, { location: "https://www.a.com/x" });
      if (url === "https://www.a.com/x") return jsonResponse({ ok: 1 });
      return jsonResponse(undefined, 302, { location: "http://169.254.169.254/" });
    };
    expect((await fetchStoreJson("https://a.com/x", fetcher, null)).data).toEqual({ ok: 1 });
    await expect(fetchStoreJson("https://b.com/x", fetcher, null)).rejects.toBeInstanceOf(CatalogError);
  });

  it("refuses hosts that resolve to private IPs", async () => {
    const fetcher: Fetcher = async () => jsonResponse({});
    await expect(fetchStoreJson("https://evil.com/x", fetcher, async () => ["10.0.0.1"])).rejects.toThrow(
      "isn't a public website",
    );
  });

  it("explains network failures in plain words", async () => {
    const fetcher: Fetcher = async () => {
      throw new TypeError("dns error");
    };
    await expect(fetchStoreJson("https://nowhere.com/x", fetcher, null)).rejects.toThrow("couldn't reach");
  });
});

describe("htmlToText", () => {
  it("strips tags, scripts and entities", () => {
    expect(htmlToText("<p>Soft &amp; warm<br>cotton</p><script>alert(1)</script>")).toBe("Soft & warm\ncotton");
    expect(htmlToText("&#39;Hi&#x27;")).toBe("'Hi'");
    expect(htmlToText("<p> </p>")).toBeNull();
    expect(htmlToText(null)).toBeNull();
  });
});

const shopifyProduct = {
  id: 7001,
  title: "Linen Shirt",
  handle: "linen-shirt",
  body_html: "<p>Breathable <strong>linen</strong>.</p>",
  product_type: "Shirts",
  options: [{ name: "Color", position: 1 }, { name: "Size", position: 2 }],
  images: [{ src: "//cdn.shopify.com/a.jpg" }],
  variants: [
    { sku: "LS-W-M", price: "45.00", compare_at_price: "60.00", available: true, option1: "White", option2: "M" },
    { sku: "LS-W-L", price: "45.00", compare_at_price: "60.00", available: false, option1: "White", option2: "L" },
    { sku: "LS-B-M", price: "49.00", available: true, option1: "Blue", option2: "M" },
  ],
};

describe("mapShopifyProduct", () => {
  it("maps price, stock, sale, image, link and sizes/colours", () => {
    const p = mapShopifyProduct(shopifyProduct, "https://shop.com")!;
    expect(p).toMatchObject({
      external_id: "7001",
      name: "Linen Shirt",
      description: "Breathable linen .",
      category: "Shirts",
      price: 45,
      sku: "LS-W-M",
      stock_status: "in_stock",
      promo: "On sale (was 60)",
      image_url: "https://cdn.shopify.com/a.jpg",
      product_url: "https://shop.com/products/linen-shirt",
    });
    expect(p.variants).toEqual([
      { colour: "White", size: "M", stock_status: "in_stock" },
      { colour: "White", size: "L", stock_status: "out_of_stock" },
      { colour: "Blue", size: "M", stock_status: "in_stock" },
    ]);
  });

  it("drops links too long for the database instead of cutting them", () => {
    const long = `https://cdn.shop.com/${"a".repeat(1100)}.jpg`;
    const p = mapShopifyProduct({ ...shopifyProduct, images: [{ src: long }] }, "https://shop.com")!;
    expect(p.image_url).toBeNull();
  });

  it("marks a product out of stock when no variant is available, and skips junk", () => {
    const sold = mapShopifyProduct({ ...shopifyProduct, variants: [{ price: "5", available: false }] }, "https://s.com")!;
    expect(sold.stock_status).toBe("out_of_stock");
    expect(sold.variants).toEqual([]);
    expect(mapShopifyProduct({ id: 1 }, "https://s.com")).toBeNull();
    expect(mapShopifyProduct("nope", "https://s.com")).toBeNull();
  });
});

describe("mapWooProduct", () => {
  it("converts minor-unit prices and lists sizes and colours", () => {
    const p = mapWooProduct({
      id: 55,
      name: "Cotton Tee &amp; Cap",
      permalink: "https://wp.shop.com/product/tee/",
      sku: "TEE-1",
      short_description: "<p>Everyday tee</p>",
      prices: { price: "1500", regular_price: "2000", currency_minor_unit: 2 },
      is_in_stock: true,
      images: [{ src: "https://wp.shop.com/tee.jpg" }],
      categories: [{ name: "T-shirts" }],
      attributes: [
        { name: "Size", terms: [{ name: "S" }, { name: "M" }] },
        { name: "Colour", terms: [{ name: "Black" }] },
        { name: "Material", terms: [{ name: "Cotton" }] },
      ],
    })!;
    expect(p).toMatchObject({
      external_id: "55",
      name: "Cotton Tee & Cap",
      price: 15,
      promo: "On sale (was 20)",
      category: "T-shirts",
      description: "Everyday tee",
      product_url: "https://wp.shop.com/product/tee/",
    });
    expect(p.variants).toEqual([
      { size: "S", stock_status: "in_stock" },
      { size: "M", stock_status: "in_stock" },
      { colour: "Black", stock_status: "in_stock" },
    ]);
  });
});

describe("readCatalog", () => {
  it("pages through Shopify until a short page", async () => {
    const pages: Record<number, unknown[]> = {
      1: Array.from({ length: 250 }, (_, i) => ({ ...shopifyProduct, id: i + 1 })),
      2: [{ ...shopifyProduct, id: 999 }],
    };
    const fetcher: Fetcher = async (url) => jsonResponse({ products: pages[Number(new URL(url).searchParams.get("page"))] ?? [] });
    const { products, truncated } = await readCatalog("shopify", "https://shop.com", fetcher, null);
    expect(products).toHaveLength(251);
    expect(truncated).toBe(false);
  });

  it("stops at the limit and says so", async () => {
    const fetcher: Fetcher = async () => jsonResponse({ products: Array.from({ length: 250 }, (_, i) => ({ ...shopifyProduct, id: Math.random() + i })) });
    const { products, truncated } = await readCatalog("shopify", "https://shop.com", fetcher, null, 300);
    expect(products).toHaveLength(300);
    expect(truncated).toBe(true);
  });

  it("falls back to plain permalinks for WooCommerce", async () => {
    const fetcher: Fetcher = async (url) =>
      url.includes("/wp-json/")
        ? jsonResponse({ code: "rest_no_route" }, 404)
        : jsonResponse([{ id: 1, name: "Mug", prices: { price: "900", currency_minor_unit: 2 } }]);
    const { products } = await readCatalog("woocommerce", "https://wp.com", fetcher, null);
    expect(products.map((p) => [p.name, p.price])).toEqual([["Mug", 9]]);
  });

  it("explains when the address isn't a store of that kind", async () => {
    const fetcher: Fetcher = async () => new Response("<html></html>", { status: 200 });
    await expect(readCatalog("shopify", "https://blog.com", fetcher, null)).rejects.toThrow("Shopify store");
  });
});

describe("planSync", () => {
  const base = mapShopifyProduct(shopifyProduct, "https://shop.com")!;
  const row = (id: string, p = base) => ({ id, ...p }) as never;

  it("adds new, updates changed, leaves unchanged and removes gone products", () => {
    const changed = { ...base, external_id: "2", price: 39 };
    const unchanged = { ...base, external_id: "3" };
    const plan = planSync(
      [row("r2", { ...base, external_id: "2" }), row("r3", unchanged), row("r4", { ...base, external_id: "4" })],
      [{ ...base, external_id: "1" }, changed, unchanged],
    );
    expect(plan.inserts.map((p) => p.external_id)).toEqual(["1"]);
    expect(plan.updates.map((u) => [u.id, u.price])).toEqual([["r2", 39]]);
    expect(plan.deletes).toEqual(["r4"]);
  });

  it("treats a numeric price from the database as equal", () => {
    const plan = planSync([row("r1", { ...base, price: "45.00" as never })], [base]);
    expect(plan.updates).toEqual([]);
  });
});

describe("needsAutoSync", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const b = { catalog_platform: "shopify", catalog_synced_at: ago(7 * 3600_000), catalog_sync_started_at: null, catalog_sync_error: null };

  it("syncs a connected store every 6 hours", () => {
    expect(needsAutoSync(b, now)).toBe(true);
    expect(needsAutoSync({ ...b, catalog_synced_at: ago(3600_000) }, now)).toBe(false);
    expect(needsAutoSync({ ...b, catalog_platform: null }, now)).toBe(false);
  });

  it("waits while a sync runs and backs off after a failure", () => {
    expect(needsAutoSync({ ...b, catalog_sync_started_at: ago(60_000) }, now)).toBe(false);
    expect(needsAutoSync({ ...b, catalog_sync_started_at: ago(20 * 60_000), catalog_sync_error: "x" }, now)).toBe(false);
    expect(needsAutoSync({ ...b, catalog_sync_started_at: ago(2 * 3600_000), catalog_sync_error: "x" }, now)).toBe(true);
  });
});
