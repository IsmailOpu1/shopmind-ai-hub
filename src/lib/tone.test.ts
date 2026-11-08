import { describe, expect, it } from "vitest";
import { TONES, normalizeTone, toneStyle } from "../../supabase/functions/_shared/tone";
import { TONE_OPTIONS, avatarPathFromUrl, validateAvatar } from "./tone";

describe("tones", () => {
  it("the dashboard offers exactly the tones the chat function knows", () => {
    expect(TONE_OPTIONS.map((t) => t.value)).toEqual([...TONES]);
  });

  it("falls back to friendly for anything unknown", () => {
    expect(normalizeTone("rude")).toBe("friendly");
    expect(normalizeTone(null)).toBe("friendly");
    expect(toneStyle("luxury").persona).toMatch(/stylist/);
  });

  it("only professional and luxury forbid emojis", () => {
    expect(toneStyle("professional").style).toMatch(/no emojis/);
    expect(toneStyle("luxury").style).toMatch(/no emojis/);
    expect(toneStyle("playful").style).not.toMatch(/no emojis/);
  });
});

describe("avatar uploads", () => {
  it("accepts small raster images only", () => {
    expect(validateAvatar({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateAvatar({ type: "image/svg+xml", size: 1000 })).toMatch(/PNG/);
    expect(validateAvatar({ type: "image/jpeg", size: 600 * 1024 })).toMatch(/512 KB/);
  });

  it("finds the storage path of our own avatar URLs only", () => {
    expect(
      avatarPathFromUrl("https://x.supabase.co/storage/v1/object/public/bot-avatars/abc/avatar-1.png"),
    ).toBe("abc/avatar-1.png");
    expect(avatarPathFromUrl("https://example.com/logo.png")).toBeNull();
    expect(avatarPathFromUrl(null)).toBeNull();
  });
});
