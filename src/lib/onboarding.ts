/** Owner actions recorded in businesses.onboarding. */
export type OnboardingFlags = {
  customized_at?: string;
  tested_at?: string;
  embed_copied_at?: string;
};

export type OnboardingFlag = keyof OnboardingFlags;

export type OnboardingState = {
  productCount: number;
  /** Products still waiting for an AI search embedding. */
  unindexedCount: number;
  /** Chats from real shoppers (not dashboard previews or test runs). */
  shopperChats: number;
  flags: OnboardingFlags;
};

export type StepId = "upload" | "index" | "customize" | "test" | "embed" | "live";

export type OnboardingStep = {
  id: StepId;
  title: string;
  description: string;
  done: boolean;
  /** Where the owner goes to complete it. */
  href?: string;
};

/** Session ids used by the dashboard's own chat preview. */
export const DASHBOARD_SESSION_PREFIX = "dash-";
/** Session ids used by automated end-to-end tests. */
export const TEST_SESSION_PREFIX = "e2e-test-";

export function isShopperSession(sessionId: string): boolean {
  return !sessionId.startsWith(DASHBOARD_SESSION_PREFIX) && !sessionId.startsWith(TEST_SESSION_PREFIX);
}

export function onboardingSteps(state: OnboardingState): OnboardingStep[] {
  const { productCount, unindexedCount, shopperChats, flags } = state;
  return [
    {
      id: "upload",
      title: "Upload your catalog",
      description: "Add products from a CSV or Excel file. Download the sample to see the columns.",
      done: productCount > 0,
      href: "/dashboard/products",
    },
    {
      id: "index",
      title: "Get products ready for AI search",
      description:
        unindexedCount > 0
          ? `${unindexedCount} product${unindexedCount === 1 ? " is" : "s are"} waiting to be indexed.`
          : "Every product is indexed so the assistant can find it.",
      done: productCount > 0 && unindexedCount === 0,
    },
    {
      id: "customize",
      title: "Make the assistant yours",
      description: "Set its name, greeting, colour and currency.",
      done: Boolean(flags.customized_at),
      href: "/dashboard/chatbot",
    },
    {
      id: "test",
      title: "Try a conversation",
      description: "Open the chat bubble on this dashboard and ask about one of your products.",
      done: Boolean(flags.tested_at),
    },
    {
      id: "embed",
      title: "Add it to your website",
      description: "Copy the embed code and paste it before </body> on your store.",
      done: Boolean(flags.embed_copied_at),
      href: "/dashboard/chatbot",
    },
    {
      id: "live",
      title: "First shopper chat",
      description: "Done automatically when a shopper chats on your store.",
      done: shopperChats > 0,
    },
  ];
}

export function nextStep(steps: OnboardingStep[]): OnboardingStep | undefined {
  return steps.find((s) => !s.done);
}

export function progress(steps: OnboardingStep[]): number {
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}
