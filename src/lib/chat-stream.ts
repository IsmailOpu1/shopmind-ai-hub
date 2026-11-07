export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; reply: string; products?: unknown[]; currency?: string }
  | { type: "error"; error: string };

/**
 * Reads the chat function's server-sent events. Calls onEvent for each one
 * and resolves once the stream ends. Malformed events are skipped.
 */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  const flush = (block: string) => {
    const line = block.trim();
    if (!line.startsWith("data:")) return;
    try {
      onEvent(JSON.parse(line.slice(5)) as ChatStreamEvent);
    } catch {
      // skip a malformed event
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const blocks = pending.split("\n\n");
    pending = blocks.pop() ?? "";
    blocks.forEach(flush);
  }
  flush(pending + decoder.decode());
}
