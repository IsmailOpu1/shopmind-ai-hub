export type CartMode = "off" | "event" | "url";

export const CART_PLACEHOLDERS = ["{id}", "{sku}", "{product_url}"] as const;

/** A web link, or a path on the store's own site ("//other-site" is not one). */
const CART_LINK = /^(https?:\/\/|\/(?![/\\]))/i;

/** Returns an error message, or null when the template can be saved. */
export function validateCartTemplate(template: string): string | null {
  const t = template.trim();
  if (!t) return "Enter your store's add-to-cart link.";
  if (t.length > 500) return "The link must be 500 characters or fewer.";
  if (!CART_LINK.test(t)) return "The link must start with https://, http:// or a single /.";
  if (!CART_PLACEHOLDERS.some((p) => t.includes(p))) {
    return "Include {id}, {sku} or {product_url} so the link points at the right product.";
  }
  return null;
}

/**
 * Fills the template for one product, same rules as the embed widget:
 * values are URL-encoded and a missing value means no link (null).
 */
export function buildCartUrl(
  template: string,
  product: { id: string; sku?: string | null; product_url?: string | null },
): string | null {
  const values: Record<string, string | null | undefined> = {
    id: product.id,
    sku: product.sku,
    product_url: product.product_url,
  };
  let missing = false;
  const url = template.replace(/\{(id|sku|product_url)\}/g, (_, key: string) => {
    const v = values[key];
    if (v == null || v === "") missing = true;
    return encodeURIComponent(v ?? "");
  });
  if (missing || !CART_LINK.test(url)) return null;
  return url;
}
