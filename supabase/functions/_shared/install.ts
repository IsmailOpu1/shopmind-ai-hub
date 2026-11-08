// Install detection: when the embed widget on a store's website loads its
// settings, the chat function notes that website so the dashboard can show
// the owner "installed on https://their-shop.com".

/** The page's web origin ("https://shop.com"), or null if it isn't a usable http(s) one. */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value || value === "null") return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const origin = u.origin.toLowerCase();
    return origin.length <= 200 ? origin : null;
  } catch {
    return null;
  }
}

/** How often the same website is re-recorded (keeps writes rare on busy stores). */
export const SIGHTING_REFRESH_MS = 10 * 60 * 1000;

export function shouldRecordSighting(
  previous: { origin: string | null; seenAt: string | null },
  origin: string,
  now: number,
): boolean {
  if (previous.origin !== origin || !previous.seenAt) return true;
  const last = Date.parse(previous.seenAt);
  return Number.isNaN(last) || now - last >= SIGHTING_REFRESH_MS;
}
