import { supabase } from "@/integrations/supabase/client";
import {
  DASHBOARD_SESSION_PREFIX,
  TEST_SESSION_PREFIX,
  type OnboardingFlag,
  type OnboardingFlags,
  type OnboardingState,
} from "./onboarding";

/** Chats from real shoppers only: dashboard previews and test runs excluded. */
export function shopperConversations(businessId: string) {
  return supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .not("session_id", "like", `${DASHBOARD_SESSION_PREFIX}%`)
    .not("session_id", "like", `${TEST_SESSION_PREFIX}%`);
}

export async function loadOnboarding(businessId: string): Promise<OnboardingState> {
  const [business, products, unindexed, chats] = await Promise.all([
    supabase.from("businesses").select("onboarding").eq("id", businessId).maybeSingle(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("business_id", businessId),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("embedding", null),
    shopperConversations(businessId),
  ]);
  const error = business.error ?? products.error ?? unindexed.error ?? chats.error;
  if (error) throw new Error(error.message);
  return {
    productCount: products.count ?? 0,
    unindexedCount: unindexed.count ?? 0,
    shopperChats: chats.count ?? 0,
    flags: (business.data?.onboarding ?? {}) as OnboardingFlags,
  };
}

/** Records an owner action once; later calls keep the first timestamp. */
export async function markOnboarding(businessId: string, flag: OnboardingFlag): Promise<void> {
  const { data, error } = await supabase
    .from("businesses")
    .select("onboarding")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !data) return;
  const flags = (data.onboarding ?? {}) as OnboardingFlags;
  if (flags[flag]) return;
  await supabase
    .from("businesses")
    .update({ onboarding: { ...flags, [flag]: new Date().toISOString() } })
    .eq("id", businessId);
}
