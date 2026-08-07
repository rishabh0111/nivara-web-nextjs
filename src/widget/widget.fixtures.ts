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

export const tenantId = "ten_1";

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
