// Tones the store can pick in Chatbot Settings. The values must match
// supabase/functions/_shared/tone.ts and the businesses_tone_check constraint.
export const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly", example: "Great pick! The Oxford shirt goes really well with chinos." },
  { value: "professional", label: "Professional", example: "The Oxford shirt pairs well with our slim chinos." },
  { value: "playful", label: "Playful", example: "Ooh, the Oxford shirt + chinos? Instant weekend win 😎" },
  { value: "luxury", label: "Luxury", example: "The Oxford shirt, in fine cotton, is beautifully complemented by our tailored chinos." },
] as const;

export type ToneValue = (typeof TONE_OPTIONS)[number]["value"];

// Logos the widget shows: small raster images (SVG can carry scripts).
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const AVATAR_MAX_BYTES = 512 * 1024;

export function validateAvatar(file: { type: string; size: number }): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return "Use a PNG, JPG or WebP image.";
  if (file.size > AVATAR_MAX_BYTES) return "The image must be 512 KB or smaller.";
  return null;
}

/** Storage path inside the bot-avatars bucket for a public URL of it, or null. */
export function avatarPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/bot-avatars/";
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}
