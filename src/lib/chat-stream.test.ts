import { describe, expect, it } from "vitest";
import { readChatStream, type ChatStreamEvent } from "./chat-stream";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

describe("readChatStream", () => {
  it("reassembles events split across chunks", async () => {
    const events: ChatStreamEvent[] = [];
    await readChatStream(
      streamOf([
        'data: {"type":"delta","text":"Hel',
        'lo"}\n\ndata: {"type":"delta","text":" there"}\n\n',
        'data: {"type":"done","reply":"Hello there","products":[]}',
      ]),
      (e) => events.push(e),
    );
    expect(events).toEqual([
      { type: "delta", text: "Hello" },
      { type: "delta", text: " there" },
      { type: "done", reply: "Hello there", products: [] },
    ]);
  });

  it("skips malformed events and keeps going", async () => {
    const events: ChatStreamEvent[] = [];
    await readChatStream(
      streamOf(['data: {oops\n\n', ': comment\n\n', 'data: {"type":"error","error":"x"}\n\n']),
      (e) => events.push(e),
    );
    expect(events).toEqual([{ type: "error", error: "x" }]);
  });

  it("decodes multi-byte characters split between chunks", async () => {
    const bytes = new TextEncoder().encode('data: {"type":"delta","text":"৳"}\n\n');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 31));
        controller.enqueue(bytes.slice(31));
        controller.close();
      },
    });
    const events: ChatStreamEvent[] = [];
    await readChatStream(body, (e) => events.push(e));
    expect(events).toEqual([{ type: "delta", text: "৳" }]);
  });
});
