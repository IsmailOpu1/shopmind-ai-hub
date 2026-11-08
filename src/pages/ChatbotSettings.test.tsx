import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// A stand-in for the Supabase client: the saved business row, the update the
// page sends, and the bot-avatars storage calls.
const BUSINESS_ID = "491b3c9c-41cd-4bc8-8a16-1e4965a85667";
const PUBLIC_BASE = "https://x.supabase.co/storage/v1/object/public/bot-avatars/";
const db = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  updates: [] as Array<Record<string, unknown>>,
  uploads: [] as Array<{ path: string; type: string }>,
  removed: [] as string[][],
}));

vi.mock("@/integrations/supabase/client", () => {
  const bucket = {
    upload: (path: string, file: File) => {
      db.uploads.push({ path, type: file.type });
      return Promise.resolve({ data: { path }, error: null });
    },
    getPublicUrl: (path: string) => ({ data: { publicUrl: PUBLIC_BASE + path } }),
    remove: (paths: string[]) => {
      db.removed.push(paths);
      return Promise.resolve({ data: [], error: null });
    },
  };
  return {
    supabase: {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: db.row, error: null }) }) }),
        update: (values: Record<string, unknown>) => {
          db.updates.push(values);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
      storage: { from: () => bucket },
    },
  };
});
// Stable like the real hook's value, so the settings load once.
const auth = vi.hoisted(() => ({ user: { id: "owner-1" }, loading: false }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/onboarding-data", () => ({ markOnboarding: () => Promise.resolve() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ChatbotSettings from "./ChatbotSettings";
import { toast } from "sonner";

// Radix Select needs these browser APIs, which jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  db.row = {
    id: BUSINESS_ID,
    bot_name: "ShopMind AI",
    greeting: "Hi!",
    primary_color: "#1E40AF",
    fab_position: "bottom-right",
    currency: "BDT",
    cart_mode: "off",
    cart_url_template: null,
    tone: "professional",
    avatar_url: null,
  };
  db.updates = [];
  db.uploads = [];
  db.removed = [];
  vi.mocked(toast.error).mockClear();
});

const png = (name = "logo.png", size = 1000) => {
  const f = new File([new Uint8Array(size)], name, { type: "image/png" });
  return f;
};

const upload = (file: File) => fireEvent.change(screen.getByLabelText("Upload logo"), { target: { files: [file] } });
const save = () => fireEvent.click(screen.getByRole("button", { name: /Save Settings/ }));

describe("ChatbotSettings: tone and logo", () => {
  it("loads the saved tone and saves a new one", async () => {
    render(<ChatbotSettings />);
    const trigger = await screen.findByRole("combobox", { name: "Tone" });
    expect(trigger).toHaveTextContent("Professional");

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Luxury" }));
    expect(screen.getByRole("combobox", { name: "Tone" })).toHaveTextContent("Luxury");
    expect(screen.getByText(/beautifully complemented/)).toBeInTheDocument();

    save();
    await waitFor(() => expect(db.updates).toHaveLength(1));
    expect(db.updates[0]).toMatchObject({ tone: "luxury", avatar_url: null });
  });

  it("uploads a logo into the store's folder and saves its public URL", async () => {
    render(<ChatbotSettings />);
    await screen.findByLabelText("Upload logo");
    upload(png());
    const img = await screen.findByAltText("Chatbot logo");
    expect(db.uploads).toHaveLength(1);
    expect(db.uploads[0].path).toMatch(new RegExp(`^${BUSINESS_ID}/avatar-\\d+\\.png$`));
    expect(img).toHaveAttribute("src", PUBLIC_BASE + db.uploads[0].path);

    save();
    await waitFor(() => expect(db.updates).toHaveLength(1));
    expect(db.updates[0].avatar_url).toBe(PUBLIC_BASE + db.uploads[0].path);
    expect(db.removed).toEqual([]); // nothing old to clean up
  });

  it("rejects SVG and oversized files without uploading", async () => {
    render(<ChatbotSettings />);
    await screen.findByLabelText("Upload logo");
    upload(new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));
    upload(png("big.png", 600 * 1024));
    expect(db.uploads).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith("Use a PNG, JPG or WebP image.");
    expect(toast.error).toHaveBeenCalledWith("The image must be 512 KB or smaller.");
  });

  it("deletes the old logo only after the replacement is saved", async () => {
    db.row.avatar_url = PUBLIC_BASE + `${BUSINESS_ID}/avatar-1.png`;
    render(<ChatbotSettings />);
    expect(await screen.findByAltText("Chatbot logo")).toHaveAttribute("src", db.row.avatar_url as string);

    upload(png());
    await waitFor(() => expect(db.uploads).toHaveLength(1));
    expect(db.removed).toEqual([]); // still the saved logo until Save

    save();
    await waitFor(() => expect(db.removed).toEqual([[`${BUSINESS_ID}/avatar-1.png`]]));
  });

  it("discards an unsaved upload when it's replaced or removed", async () => {
    render(<ChatbotSettings />);
    await screen.findByLabelText("Upload logo");
    upload(png("a.png"));
    await screen.findByAltText("Chatbot logo");
    const first = db.uploads[0].path;

    // Uploads in the same millisecond would share a name; wait a tick.
    await new Promise((r) => setTimeout(r, 5));
    upload(png("b.png"));
    await waitFor(() => expect(db.removed).toEqual([[first]]));

    fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
    expect(db.removed).toEqual([[first], [db.uploads[1].path]]);
    expect(screen.queryByAltText("Chatbot logo")).not.toBeInTheDocument();

    save();
    await waitFor(() => expect(db.updates).toHaveLength(1));
    expect(db.updates[0].avatar_url).toBeNull();
  });
});

describe("ChatbotSettings: shopper memory", () => {
  it("is on by default and can be turned off", async () => {
    render(<ChatbotSettings />);
    const toggle = await screen.findByRole("switch", { name: "Remember returning shoppers" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    save();
    await waitFor(() => expect(db.updates).toHaveLength(1));
    expect(db.updates[0]).toMatchObject({ shopper_memory: false });
  });

  it("loads a store's saved choice", async () => {
    db.row = { ...db.row, shopper_memory: false };
    render(<ChatbotSettings />);
    const toggle = await screen.findByRole("switch", { name: "Remember returning shoppers" });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
  });
});
