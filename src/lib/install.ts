// Install help for store owners who don't code: where to paste the snippet
// in each website builder, and how to tell that it worked.

export type BuilderId = "shopify" | "wix" | "wordpress" | "squarespace" | "webflow" | "other";

export type InstallGuide = {
  id: BuilderId;
  name: string;
  steps: string[];
  /** Plan or account requirement the owner should know before starting. */
  note?: string;
};

export const INSTALL_GUIDES: InstallGuide[] = [
  {
    id: "shopify",
    name: "Shopify",
    steps: [
      "In your Shopify admin, go to Online Store → Themes.",
      "Next to your current theme, click the ⋯ button, then Edit code.",
      "In the Layout folder, open theme.liquid.",
      "Press Ctrl+F (Cmd+F on Mac) and search for </body>.",
      "Paste the code on the line just above </body>, then click Save.",
    ],
  },
  {
    id: "wix",
    name: "Wix",
    steps: [
      "In your Wix dashboard, go to Settings, then Custom code (under Development & integrations, or Advanced on some sites).",
      "Click + Add Custom Code and paste the code into the box.",
      "Name it ShopMind and choose All pages, Load code once.",
      "Under Place code in, choose Body - end, then click Apply.",
    ],
    note: "Wix only allows custom code on a paid (Premium) plan with a connected domain.",
  },
  {
    id: "wordpress",
    name: "WordPress / WooCommerce",
    steps: [
      "In WordPress, go to Plugins → Add New and search for WPCode.",
      "Install and activate \"WPCode – Insert Headers and Footers\".",
      "Go to Code Snippets → Header & Footer.",
      "Paste the code into the Footer box, then click Save Changes.",
    ],
  },
  {
    id: "squarespace",
    name: "Squarespace",
    steps: [
      "In Squarespace, go to Settings → Developer Tools → Code Injection (on older sites: Settings → Advanced → Code Injection).",
      "Paste the code into the Footer box.",
      "Click Save.",
    ],
    note: "Squarespace only allows code injection on its Core plan or higher.",
  },
  {
    id: "webflow",
    name: "Webflow",
    steps: [
      "Open your site's Site settings and go to the Custom code tab.",
      "Paste the code into Footer code, then click Save.",
      "Publish your site so the change goes live.",
    ],
    note: "Webflow needs a paid site plan for custom code.",
  },
  {
    id: "other",
    name: "Other / my developer",
    steps: [
      "Open the template that every page of your site uses.",
      "Paste the code just before the closing </body> tag.",
      "Save and publish. Or send the code to whoever built your site using the button below.",
    ],
  },
];

/** Turns what an owner types ("myshop.com", "https://www.myshop.com/") into an https URL, or null. */
export function normalizeSiteUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.toString();
  } catch {
    return null;
  }
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");

/** True when a recorded widget origin belongs to the site the owner typed (www. or not). */
export function siteMatches(origin: string | null, siteUrl: string | null): boolean {
  if (!origin || !siteUrl) return false;
  try {
    return bareHost(new URL(origin).hostname) === bareHost(new URL(siteUrl).hostname);
  } catch {
    return false;
  }
}

/**
 * The chat function re-records the same website at most every 10 minutes and
 * browsers cache the widget's settings for 5, so a sighting this recent means
 * the code is on the site right now.
 */
export const RECENT_SIGHTING_MS = 15 * 60 * 1000;

export function isRecentSighting(seenAt: string | null, now = Date.now()): boolean {
  if (!seenAt) return false;
  const t = Date.parse(seenAt);
  return !Number.isNaN(t) && now - t <= RECENT_SIGHTING_MS;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function developerEmail(snippet: string): string {
  const subject = "Please add our ShopMind chat assistant to the website";
  const body =
    "Hi,\n\nPlease paste this code just before the closing </body> tag on every page of our website:\n\n" +
    snippet +
    "\n\nThat's all it needs. Thank you!";
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
