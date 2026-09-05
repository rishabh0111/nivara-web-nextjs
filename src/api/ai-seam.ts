/**
 * The seam for `nivara-ai`.
 *
 * The one place in the client where an AI chat call is made. `nivara-ai` is a
 * different backend from the one `NEXT_PUBLIC_API_URL` points at — its own
 * name, its own base URL (`@/config/ai`), its own credential-forwarding rule.
 * It answers with Server-Sent Events rather than a typed JSON response, so
 * this is hand-written rather than generated from its OpenAPI document the
 * way `@/api/generated/openapi.ts` is from this API's: there is no document
 * generator for an event stream's frame shapes to come from.
 *
 * The event names and payloads below are `nivara-ai`'s wire contract
 * (`src/nivara_ai/turn/stream.py`'s `SseEvent`), not this client's invention.
 */

export type TurnHandlers = {
  /** A heartbeat while the Turn runs — "connecting" once, then "working". */
  onStatus?: (state: "connecting" | "working") => void;
  /** One chunk of a streaming Answer. Concatenate in order for the full text. */
  onToken?: (text: string) => void;
  /** The one clarifying question, framed for a person rather than an answer. */
  onClarify?: (question: string) => void;
  /** Escalated or deferred: a plain sentence that a person now has it. */
  onEscalated?: (message: string) => void;
  /** The Turn is over. `trace` is this service's own record, for the trace toggle. */
  onDone?: (outcome: string, trace: unknown) => void;
  /** A named failure, whether from the initial response or mid-stream. */
  onError?: (code: string, message: string) => void;
};

/**
 * Runs one Turn against `nivara-ai` and reports it through `handlers` as it
 * streams.
 *
 * `accessToken` is the Widget's own `nvw_` session credential, forwarded
 * exactly as `nivara-ai`'s `turn/router.py` expects it — a bearer token, not
 * a cookie, which is also why `nivara-ai`'s CORS never needs credentials.
 *
 * A plain `fetch` rather than `EventSource`: `EventSource` cannot send a
 * request body or a custom header, and this needs both (`conversationId` in
 * the body, the bearer token in `Authorization`). So the frame parsing below
 * is this client's to do, not the browser's.
 */
export async function runTurn(
  aiBaseUrl: string,
  accessToken: string,
  conversationId: string,
  handlers: TurnHandlers,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${aiBaseUrl}/widget/turns/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ conversationId }),
    });
  } catch {
    handlers.onError?.("unreachable", "Could not reach the support assistant.");
    return;
  }

  // Auth and readiness are checked before the stream opens (turn/router.py),
  // so a 401/503 arrives as a plain JSON error rather than as an SSE frame.
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    handlers.onError?.(
      error?.code ?? "unavailable",
      error?.message ?? "The support assistant is not available right now.",
    );
    return;
  }

  await consumeEventStream(response.body, handlers);
}

/** Parses `text/event-stream` frames off `body` and dispatches each to `handlers`. */
async function consumeEventStream(
  body: ReadableStream<Uint8Array>,
  handlers: TurnHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;

      buffer += decoder.decode(value, { stream: true });

      // A frame is terminated by a blank line; the tail may be a frame still
      // arriving, so it is kept rather than parsed early.
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        dispatchFrame(buffer.slice(0, boundary), handlers);
        buffer = buffer.slice(boundary + 2);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function dispatchFrame(frame: string, handlers: TurnHandlers): void {
  let event = "";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice("event: ".length);
    else if (line.startsWith("data: ")) data = line.slice("data: ".length);
  }
  if (!event || !data) return;

  const payload: unknown = JSON.parse(data);

  switch (event) {
    case "status":
      handlers.onStatus?.((payload as { state: "connecting" | "working" }).state);
      return;
    case "token":
      handlers.onToken?.((payload as { text: string }).text);
      return;
    case "clarify":
      handlers.onClarify?.((payload as { question: string }).question);
      return;
    case "escalated":
      handlers.onEscalated?.((payload as { message: string }).message);
      return;
    case "done": {
      const done = payload as { outcome: string; trace: unknown };
      handlers.onDone?.(done.outcome, done.trace);
      return;
    }
    case "error": {
      const err = payload as { code: string; message: string };
      handlers.onError?.(err.code, err.message);
      return;
    }
    default:
      return;
  }
}

/** The pre-chat notice (`GET /widget/disclosure`), shown before the first message. */
export async function fetchDisclosure(aiBaseUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${aiBaseUrl}/widget/disclosure`);
    if (!response.ok) return undefined;
    const body = (await response.json()) as { text?: string };
    return body.text;
  } catch {
    // The disclosure is a courtesy notice, not a gate — a Visitor can still
    // start a conversation if nivara-ai is briefly unreachable for this one,
    // unauthenticated GET.
    return undefined;
  }
}
