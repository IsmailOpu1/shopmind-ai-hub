import { useCallback, useEffect, useRef, useState } from "react";
import { Inbox as InboxIcon, Send, Undo2, UserRound, Bot, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import {
  type InboxConversation,
  type InboxMessage,
  MAX_REPLY_CHARS,
  isWaiting,
  loadInbox,
  loadThread,
  sendReply,
  setHandoff,
  shopperLabel,
  validateReply,
} from "@/lib/inbox";

// While the page is open, new shopper messages show up within a few seconds.
const POLL_MS = 5000;

const timeLabel = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

type ViewProps = {
  conversations: InboxConversation[];
  selectedId: string | null;
  thread: InboxMessage[];
  error: string | null;
  onSelect: (id: string) => void;
  onReply: (text: string) => Promise<boolean>;
  onSetStatus: (status: "open" | "closed") => Promise<void>;
};

export function InboxView({ conversations, selectedId, thread, error, onSelect, onReply, onSetStatus }: ViewProps) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const threadEnd = useRef<HTMLLIElement>(null);

  useEffect(() => {
    setDraft("");
    setProblem(null);
  }, [selectedId]);
  useEffect(() => {
    threadEnd.current?.scrollIntoView?.({ block: "end" });
  }, [thread.length, selectedId]);

  const submit = async () => {
    const issue = validateReply(draft);
    if (issue) {
      setProblem(issue);
      return;
    }
    setBusy(true);
    const ok = await onReply(draft);
    setBusy(false);
    if (ok) setDraft("");
  };

  const toggle = async () => {
    if (!selected) return;
    setBusy(true);
    await onSetStatus(selected.handoff_status === "open" ? "closed" : "open");
    setBusy(false);
  };

  const waiting = conversations.filter(isWaiting).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Inbox
        </h1>
        <p className="text-muted-foreground mt-1">
          Chats where a shopper asked for a person. While a chat is open here, the assistant stays quiet and your
          replies appear in the shopper&rsquo;s chat window.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {conversations.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="No chats yet"
          description='When a shopper taps "Talk to a person" or asks for one, the chat shows up here.'
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardContent className="p-2">
              <p className="px-2 py-2 text-xs text-muted-foreground">
                {waiting ? `${waiting} waiting for a reply` : "Nobody is waiting"}
              </p>
              <ul className="space-y-1" aria-label="Chats">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      aria-current={c.id === selectedId ? "true" : undefined}
                      className={`w-full text-left rounded-md px-3 py-2 border ${
                        c.id === selectedId ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-800"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{shopperLabel(c.session_id)}</span>
                        {isWaiting(c) ? (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Waiting</Badge>
                        ) : c.handoff_status === "open" ? (
                          <Badge variant="outline">With you</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Back with bot
                          </Badge>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate mt-1">
                        {c.last?.content ?? c.handoff_reason ?? ""}
                      </span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">
                        {timeLabel(c.last?.created_at ?? c.handoff_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="p-4 flex flex-col gap-3 min-h-[420px]">
              {!selected ? (
                <p className="text-sm text-muted-foreground m-auto">Pick a chat to read it and reply.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-3">
                    <div>
                      <p className="font-semibold">{shopperLabel(selected.session_id)}</p>
                      {selected.handoff_reason && (
                        <p className="text-xs text-muted-foreground">Asked: &ldquo;{selected.handoff_reason}&rdquo;</p>
                      )}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={toggle} disabled={busy}>
                      {selected.handoff_status === "open" ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Done: hand back to bot
                        </>
                      ) : (
                        <>
                          <Undo2 className="mr-2 h-4 w-4" />
                          Take over again
                        </>
                      )}
                    </Button>
                  </div>

                  <ol className="flex-1 overflow-y-auto max-h-[480px] space-y-2" aria-label="Messages">
                    {thread.map((m) => (
                      <li key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            m.role === "user"
                              ? "bg-gray-800"
                              : m.role === "agent"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-900 border border-gray-700 text-gray-300"
                          }`}
                        >
                          <span className="flex items-center gap-1 text-[11px] opacity-70 mb-0.5">
                            {m.role === "user" ? (
                              <UserRound className="h-3 w-3" />
                            ) : m.role === "agent" ? (
                              <UserRound className="h-3 w-3" />
                            ) : (
                              <Bot className="h-3 w-3" />
                            )}
                            {m.role === "user" ? "Shopper" : m.role === "agent" ? "You" : "Assistant"} ·{" "}
                            {timeLabel(m.created_at)}
                          </span>
                          <span className="whitespace-pre-wrap break-words">{m.content}</span>
                        </div>
                      </li>
                    ))}
                    <li ref={threadEnd} aria-hidden="true" />
                  </ol>

                  <div className="space-y-2 border-t border-gray-800 pt-3">
                    <Textarea
                      aria-label="Reply"
                      value={draft}
                      maxLength={MAX_REPLY_CHARS}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setProblem(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
                      }}
                      placeholder={
                        selected.handoff_status === "open"
                          ? "Write to the shopper..."
                          : "Replying takes the chat over from the assistant again."
                      }
                      rows={3}
                      className="chatbot-input-dark resize-none"
                    />
                    {problem && (
                      <p role="alert" className="text-xs text-red-400">
                        {problem}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        The shopper sees your reply while their chat window is open in that browser tab.
                      </p>
                      <Button type="button" onClick={submit} disabled={busy}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Send
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const Inbox = () => {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (bizId: string, conversationId: string | null) => {
    try {
      const [list, messages] = await Promise.all([
        loadInbox(bizId),
        conversationId ? loadThread(conversationId) : Promise.resolve([] as InboxMessage[]),
      ]);
      setConversations(list);
      setThread(messages);
      setError(null);
    } catch {
      setError("Couldn't load the inbox. Retrying...");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
      if (data) {
        setBusinessId(data.id);
        await refresh(data.id, null);
      }
      setLoading(false);
    })();
  }, [user, refresh]);

  useEffect(() => {
    if (!businessId) return;
    void refresh(businessId, selectedId);
    const timer = setInterval(() => void refresh(businessId, selectedId), POLL_MS);
    return () => clearInterval(timer);
  }, [businessId, selectedId, refresh]);

  const reply = async (text: string) => {
    if (!businessId || !selectedId) return false;
    try {
      await sendReply(selectedId, text);
      await refresh(businessId, selectedId);
      return true;
    } catch (e) {
      toast.error(`Couldn't send: ${e instanceof Error ? e.message : "unknown error"}`);
      return false;
    }
  };

  const setStatus = async (status: "open" | "closed") => {
    if (!businessId || !selectedId) return;
    try {
      await setHandoff(selectedId, status);
      toast.success(status === "closed" ? "Handed back to the assistant." : "You have the chat again.");
      await refresh(businessId, selectedId);
    } catch (e) {
      toast.error(`Couldn't update the chat: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };

  if (loading) return <LoadingSpinner message="Loading inbox..." />;

  return (
    <InboxView
      conversations={conversations}
      selectedId={selectedId}
      thread={thread}
      error={error}
      onSelect={setSelectedId}
      onReply={reply}
      onSetStatus={setStatus}
    />
  );
};

export default Inbox;
