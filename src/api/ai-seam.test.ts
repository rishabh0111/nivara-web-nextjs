/**
 * The SSE frame parsing `runTurn` does over `nivara-ai`'s wire contract
 * (`src/nivara_ai/turn/stream.py`'s `SseEvent`). Exercised against a real
 * `Response` whose body is a real `ReadableStream` — the shape `fetch`
 * actually hands back — rather than against a fetch mock reduced to
 * returning canned JSON, since the frame boundaries and the incremental
 * decode are exactly what would go unexercised by that shortcut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDisclosure, runTurn, type TurnHandlers } from "./ai-seam";

const AI_BASE_URL = "https://ai.test";

function sseResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    ...init,
    headers: { "Content-Type": "text/event-stream", ...init?.headers },
  });
}

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function handlers(): TurnHandlers & {
  calls: { name: string; args: unknown[] }[];
} {
  const calls: { name: string; args: unknown[] }[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push({ name, args });

  return {
    calls,
    onStatus: record("status"),
    onToken: record("token"),
    onClarify: record("clarify"),
    onEscalated: record("escalated"),
    onDone: record("done"),
    onError: record("error"),
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("an answered Turn", () => {
  it("reports status, every token in order, then done", async () => {
    const body =
      frame("status", { state: "connecting" }) +
      frame("status", { state: "working" }) +
      frame("token", { text: "Open " }) +
      frame("token", { text: "Settings." }) +
      frame("done", { outcome: "answered", trace: { turnId: "t1" } });
    fetchMock.mockResolvedValue(sseResponse(body));

    const h = handlers();
    await runTurn(AI_BASE_URL, "nvw_1", "tkt_1", h);

    expect(h.calls).toEqual([
      { name: "status", args: ["connecting"] },
      { name: "status", args: ["working"] },
      { name: "token", args: ["Open "] },
      { name: "token", args: ["Settings."] },
      { name: "done", args: ["answered", { turnId: "t1" }] },
    ]);
  });

  it("forwards the bearer token and the conversation id, never a cookie", async () => {
    fetchMock.mockResolvedValue(sseResponse(frame("done", { outcome: "answered", trace: {} })));

    await runTurn(AI_BASE_URL, "nvw_1", "tkt_1", handlers());

    expect(fetchMock).toHaveBeenCalledWith(
      `${AI_BASE_URL}/widget/turns/stream`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer nvw_1" }),
        body: JSON.stringify({ conversationId: "tkt_1" }),
      }),
    );
  });

  it("copes with a frame split across two chunks of the stream", async () => {
    // Same bytes as a single-chunk frame, just handed to the reader in two
    // reads — the incremental buffer is what this actually proves works.
    const whole = frame("token", { text: "Hello" });
    const split = Math.floor(whole.length / 2);
    const chunks = [whole.slice(0, split), whole.slice(split)];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    });
    fetchMock.mockResolvedValue(
      new Response(stream, { headers: { "Content-Type": "text/event-stream" } }),
    );

    const h = handlers();
    await runTurn(AI_BASE_URL, "nvw_1", "tkt_1", h);

    expect(h.calls).toEqual([{ name: "token", args: ["Hello"] }]);
  });
});

describe("a clarified Turn", () => {
  it("reports the one question, framed apart from a token stream", async () => {
    const body =
      frame("status", { state: "connecting" }) +
      frame("clarify", { question: "Which order do you mean?" }) +
      frame("done", { outcome: "clarified", trace: {} });
    fetchMock.mockResolvedValue(sseResponse(body));

    const h = handlers();
    await runTurn(AI_BASE_URL, "nvw_1", "tkt_1", h);

    expect(h.calls).toContainEqual({ name: "clarify", args: ["Which order do you mean?"] });
    expect(h.calls.some((call) => call.name === "token")).toBe(false);
  });
});

describe("an escalated Turn", () => {
  it("reports the notice and nothing that looks like an Answer", async () => {
    const body =
      frame("escalated", { message: "A person now has this and will reply here." }) +
      frame("done", { outcome: "escalated", trace: {} });
    fetchMock.mockResolvedValue(sseResponse(body));

    const h = handlers();
    await runTurn(AI_BASE_URL, "nvw_1", "tkt_1", h);

    expect(h.calls).toContainEqual({
      name: "escalated",
      args: ["A person now has this and will reply here."],
    });
    expect(h.calls.some((call) => call.name === "token" || call.name === "clarify")).toBe(false);
  });
});

describe("a Turn that fails before the stream opens", () => {
  it("reports a 401 as a named error, not a thrown exception", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "unauthenticated", message: "The session has ended." } }),
        { status: 401 },
      ),
    );

    const h = handlers();
    await runTurn(AI_BASE_URL, "nvw_1", "tkt_1", h);

    expect(h.calls).toEqual([{ name: "error", args: ["unauthenticated", "The session has ended."] }]);
  });

  it("reports a 503 the same way", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "unavailable", message: "Not ready." } }),
        { status: 503 },
      ),
    );

    const h = handlers();
    await runTurn(AI_BASE_URL, "nvw_1", "tkt_1", h);

    expect(h.calls).toEqual([{ name: "error", args: ["unavailable", "Not ready."] }]);
  });

  it("reports network failure the same way, rather than throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const h = handlers();
    await expect(runTurn(AI_BASE_URL, "nvw_1", "tkt_1", h)).resolves.toBeUndefined();

    expect(h.calls).toEqual([
      { name: "error", args: ["unreachable", "Could not reach the support assistant."] },
    ]);
  });
});

describe("an error frame arriving mid-stream", () => {
  it("is reported the same way a pre-stream failure is", async () => {
    const body =
      frame("status", { state: "working" }) +
      frame("error", { code: "not_found", message: "No such conversation." });
    fetchMock.mockResolvedValue(sseResponse(body));

    const h = handlers();
    await runTurn(AI_BASE_URL, "nvw_1", "tkt_1", h);

    expect(h.calls).toContainEqual({ name: "error", args: ["not_found", "No such conversation."] });
  });
});

describe("the pre-chat disclosure", () => {
  it("returns the notice text", async () => {
    fetchMock.mockResolvedValue(
      HttpJson({ model_providers: ["Groq"], trace_vendor: "Langfuse Cloud", text: "Be careful." }),
    );

    await expect(fetchDisclosure(AI_BASE_URL)).resolves.toBe("Be careful.");
  });

  it("is undefined rather than thrown where nivara-ai cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchDisclosure(AI_BASE_URL)).resolves.toBeUndefined();
  });
});

function HttpJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}
