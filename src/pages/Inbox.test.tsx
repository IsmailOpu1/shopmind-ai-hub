import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
import { InboxView } from "./Inbox";
import type { InboxConversation, InboxMessage } from "@/lib/inbox";

const waitingChat: InboxConversation = {
  id: "c1",
  session_id: "session-aaaa",
  handoff_status: "open",
  handoff_at: "2026-11-08T04:00:00Z",
  handoff_reason: "my order hasn't arrived, can I talk to a person?",
  last: { id: "m2", role: "user", content: "order number is 1042", created_at: "2026-11-08T04:01:00Z" },
};
const closedChat: InboxConversation = {
  id: "c2",
  session_id: "session-bbbb",
  handoff_status: "closed",
  handoff_at: "2026-11-07T10:00:00Z",
  handoff_reason: "customer service",
  last: { id: "m9", role: "assistant", content: "Happy to help!", created_at: "2026-11-07T10:05:00Z" },
};
const thread: InboxMessage[] = [
  { id: "m1", role: "user", content: "my order hasn't arrived, can I talk to a person?", created_at: "2026-11-08T04:00:00Z" },
  { id: "m1b", role: "assistant", content: "I've asked the team to join this chat.", created_at: "2026-11-08T04:00:00Z" },
  { id: "m2", role: "user", content: "order number is 1042", created_at: "2026-11-08T04:01:00Z" },
];

const setup = (selectedId: string | null = "c1") => {
  const props = {
    onSelect: vi.fn(),
    onReply: vi.fn(() => Promise.resolve(true)),
    onSetStatus: vi.fn(() => Promise.resolve()),
  };
  render(
    <InboxView
      conversations={[waitingChat, closedChat]}
      selectedId={selectedId}
      thread={selectedId ? thread : []}
      error={null}
      {...props}
    />,
  );
  return props;
};

describe("InboxView", () => {
  it("shows waiting and handed-back chats", () => {
    setup(null);
    expect(screen.getByText("1 waiting for a reply")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Back with bot")).toBeInTheDocument();
    expect(screen.getByText("Pick a chat to read it and reply.")).toBeInTheDocument();
  });

  it("opens a chat when picked", () => {
    const { onSelect } = setup(null);
    fireEvent.click(screen.getByText("Shopper bbbb"));
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("shows the thread and the shopper's request", () => {
    setup();
    expect(screen.getByText(/Asked: .my order hasn't arrived/)).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Messages" });
    expect(list).toHaveTextContent("I've asked the team to join this chat.");
    expect(list).toHaveTextContent("order number is 1042");
  });

  it("won't send an empty reply, then sends a real one", async () => {
    const { onReply } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Write a reply first.");
    expect(onReply).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "It ships tomorrow!" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onReply).toHaveBeenCalledWith("It ships tomorrow!"));
    await waitFor(() => expect(screen.getByLabelText("Reply")).toHaveValue(""));
  });

  it("hands an open chat back to the bot, and takes a closed one over", async () => {
    const { onSetStatus } = setup();
    fireEvent.click(screen.getByRole("button", { name: /hand back to bot/ }));
    await waitFor(() => expect(onSetStatus).toHaveBeenCalledWith("closed"));
  });

  it("offers to take over a chat that went back to the bot", async () => {
    const { onSetStatus } = setup("c2");
    fireEvent.click(screen.getByRole("button", { name: /Take over again/ }));
    await waitFor(() => expect(onSetStatus).toHaveBeenCalledWith("open"));
  });
});
