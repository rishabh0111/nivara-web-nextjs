/**
 * What every Widget test needs to stand a Widget up against a fake wire.
 *
 * Shared rather than retyped per file for the same reason the other Surfaces'
 * fixtures are: a fixture that drifts from the OpenAPI document is a test that
 * passes against a shape the server stopped serving.
 */
import { HttpResponse } from "msw";

import { createApiClient } from "@/api/client";
import type { SessionStore } from "@/session/store";

import { createWidgetSession } from "./widget-session";

export const baseUrl = "https://api.test";

/** `nivara-ai`'s origin — a different backend, a different fixture base. */
export const aiBaseUrl = "https://ai.test";

export const tenantId = "ten_1";

/**
 * One SSE frame, in `nivara-ai`'s own wire shape (`SseEvent.render()` in
 * `src/nivara_ai/turn/stream.py`) — kept here rather than inlined per test so
 * a test building a specific transcript still matches the real frame shape.
 */
function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * A `POST /widget/turns/stream` response, as `nivara-ai` actually sends one:
 * a `status` heartbeat, the Answer in one chunk, then `done`. The default
 * every Widget test gets unless it registers its own — most of them are not
 * testing what nivara-ai said, only that a message they sent still shows up.
 */
export function turnAnswered(answer = "Here's how.") {
  const body =
    frame("status", { state: "connecting" }) +
    frame("token", { text: answer }) +
    frame("done", { outcome: "answered", trace: {} });

  return new HttpResponse(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** A Turn that escalated: no Answer, just the notice — see `use-ai-turn.ts`. */
export function turnEscalated(message = "A person now has this and will reply here.") {
  const body =
    frame("status", { state: "connecting" }) +
    frame("escalated", { message }) +
    frame("done", { outcome: "escalated", trace: {} });

  return new HttpResponse(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** `GET /widget/disclosure`'s ordinary answer. */
export function disclosure(text = "This is a demo. Messages are answered by a language model.") {
  return HttpResponse.json({ model_providers: ["Groq"], trace_vendor: "Langfuse Cloud", text });
}

/** The Snippet, as a Tenant pastes it. Left detached; a caller places it. */
export function snippet(
  attributes: Record<string, string> = { "data-tenant-id": tenantId },
): HTMLScriptElement {
  const script = document.createElement("script");
  for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
  return script;
}

/** A thirty-minute credential, as `POST /widget/sessions` hands one back. */
export function minted() {
  return HttpResponse.json({ token: "nvw_1", expiresInSeconds: 1800 });
}

/** What the API answers a page whose origin nobody put on the allowlist. */
export function refused() {
  return HttpResponse.json(
    { error: { code: "forbidden", message: "Origin not allowed for this tenant." } },
    { status: 403 },
  );
}

/** A page of this session's conversations. Empty is the ordinary first answer. */
export function conversations(...tickets: unknown[]) {
  return HttpResponse.json({ data: tickets, nextCursor: null });
}

/**
 * The session a test's Widget holds.
 *
 * `realtimeUrl` is named only where a test drives the wire. Everywhere else it
 * points at a socket nobody starts, which costs nothing: the connection is
 * opened by the first Room somebody reads, and a Widget with no conversation
 * open reads none.
 */
export function widgetSession(store: SessionStore, realtimeUrl = `${baseUrl}/rt`) {
  return createWidgetSession(tenantId, createApiClient({ baseUrl }), store, realtimeUrl);
}
