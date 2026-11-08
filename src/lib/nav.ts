import { BarChart3, BookOpen, Home, Inbox, LayoutGrid, type LucideIcon, Settings2 } from "lucide-react";

export type NavItem = { title: string; url: string; icon: LucideIcon; description: string };
export type NavGroup = { label: string; items: NavItem[] };

// The dashboard's navigation, grouped the way owners think about the work.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Home", url: "/dashboard", icon: Home, description: "Setup progress and today at a glance" },
      { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3, description: "Chats, clicks and what shoppers ask for" },
    ],
  },
  {
    label: "Customers",
    items: [
      { title: "Inbox", url: "/dashboard/inbox", icon: Inbox, description: "Chats handed to your team" },
    ],
  },
  {
    label: "Store",
    items: [
      { title: "Products", url: "/dashboard/products", icon: LayoutGrid, description: "Your catalog, as the assistant sees it" },
      { title: "Store knowledge", url: "/dashboard/knowledge", icon: BookOpen, description: "Policies and info the assistant can quote" },
    ],
  },
  {
    label: "Assistant",
    items: [
      { title: "Chatbot settings", url: "/dashboard/chatbot", icon: Settings2, description: "Look, tone, memory and install code" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The nav item for a dashboard path (exact match, then the longest prefix). */
export function navItemFor(pathname: string): NavItem | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const exact = NAV_ITEMS.find((i) => i.url === path);
  if (exact) return exact;
  return (
    [...NAV_ITEMS]
      .filter((i) => i.url !== "/dashboard" && path.startsWith(i.url + "/"))
      .sort((a, b) => b.url.length - a.url.length)[0] ?? null
  );
}
