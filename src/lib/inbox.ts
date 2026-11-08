// Human handoff inbox: chats a shopper handed to the store's team.
// Pure helpers (tested) plus the Supabase calls the Inbox page uses.
import { supabase } from "@/integrations/supabase/client";

export type HandoffStatus = "open" | "closed";
export type InboxMessage = { id: string; role: "user" | "assistant" | "agent"; content: string; created_at: string };
export type InboxConversation = {
  id: string;
  session_id: string;
  handoff_status: HandoffStatus;
  handoff_at: string | null;
  handoff_reason: string | null;
  last: InboxMessage | null;
};

export const MAX_REPLY_CHARS = 2000;
const LIST_LIMIT = 50;

/** A chat is waiting when it's with the team and the shopper spoke last. */
export function isWaiting(c: Pick<InboxConversation, "handoff_status" | "last">): boolean {
  return c.handoff_status === "open" && (c.last === null || c.last.role === "user");
}

/** Waiting chats first (oldest wait first), then other open ones, then closed (newest first). */
export function sortInbox(list: InboxConversation[]): InboxConversation[] {
  const rank = (c: InboxConversation) => (isWaiting(c) ? 0 : c.handoff_status === "open" ? 1 : 2);
  const time = (c: InboxConversation) => Date.parse(c.last?.created_at ?? c.handoff_at ?? "") || 0;
  return [...list].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    return rank(a) === 0 ? time(a) - time(b) : time(b) - time(a);
  });
}

export function validateReply(text: string): string | null {
  const t = text.trim();
  if (!t) return "Write a reply first.";
  if (t.length > MAX_REPLY_CHARS) return `Keep replies under ${MAX_REPLY_CHARS} characters.`;
  return null;
}

/** "Shopper 3f9a…" — sessions are anonymous; the tail tells chats apart. */
export function shopperLabel(sessionId: string): string {
  return `Shopper ${sessionId.slice(-4)}`;
}

export async function loadInbox(businessId: string): Promise<InboxConversation[]> {
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, session_id, handoff_status, handoff_at, handoff_reason")
    .eq("business_id", businessId)
    .neq("handoff_status", "none")
    .order("handoff_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(error.message);
  const list = (conversations ?? []) as Array<Omit<InboxConversation, "last">>;
  if (!list.length) return [];
  // The latest message of each chat (newest first, first one per chat wins).
  const { data: recent, error: msgError } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .in("conversation_id", list.map((c) => c.id))
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT * 10);
  if (msgError) throw new Error(msgError.message);
  const last = new Map<string, InboxMessage>();
  for (const m of (recent ?? []) as Array<InboxMessage & { conversation_id: string }>) {
    if (!last.has(m.conversation_id)) last.set(m.conversation_id, m);
  }
  return sortInbox(list.map((c) => ({ ...c, last: last.get(c.id) ?? null })));
}

export async function loadThread(conversationId: string): Promise<InboxMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    // A turn's question and reply share a timestamp; "user" sorts after
    // "assistant", so put questions first.
    .order("role", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as InboxMessage[];
}

export async function sendReply(conversationId: string, content: string): Promise<void> {
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, role: "agent", content: content.trim() });
  if (error) throw new Error(error.message);
}

export async function setHandoff(conversationId: string, status: HandoffStatus): Promise<void> {
  const { error } = await supabase.from("conversations").update({ handoff_status: status }).eq("id", conversationId);
  if (error) throw new Error(error.message);
}

/** How many chats are waiting for the team (for the sidebar badge). */
export async function countWaiting(businessId: string): Promise<number> {
  return (await loadInbox(businessId)).filter(isWaiting).length;
}
