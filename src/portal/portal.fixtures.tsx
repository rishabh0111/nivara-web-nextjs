/**
 * What every Portal test needs to stand a Portal up against a fake wire.
 *
 * Fixtures are typed as the document types them, so a handler cannot describe a
 * response the API could not have sent. That is the whole reason they are shared
 * rather than retyped per file: a fixture that drifts from the document is a
 * test that passes against a client shape the server stopped serving.
 */
import { render } from "@testing-library/react";

import { createApiClient } from "@/api/client";
import type { components } from "@/api/generated/openapi";
import { QueryProvider } from "@/api/query-client";
import { SessionStore } from "@/session/store";

import { createPortalSession } from "./portal-session";
import { PortalSessionProvider } from "./portal-session-context";
import { Portal } from "./portal";

export const baseUrl = "https://api.test";

type TicketDto = components["schemas"]["TicketDto"];
type MessageDto = components["schemas"]["MessageDto"];

export function ticket(overrides: Partial<TicketDto> = {}): TicketDto {
  return {
    id: "tkt_1",
    subject: "The printer is on fire",
    contactId: "con_1",
    assigneeId: null,
    state: "open",
    priority: "normal",
    source: "portal",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-07-02T09:00:00.000Z",
    ...overrides,
  };
}

export function message(overrides: Partial<MessageDto> = {}): MessageDto {
  return {
    id: "msg_1",
    ticketId: "tkt_1",
    body: "It is definitely on fire.",
    authorKind: "contact",
    authorId: "con_1",
    createdAt: "2026-07-01T09:00:00.000Z",
    ...overrides,
  };
}

/** A store already holding a Portal credential, so tests start signed in. */
export function signedInStore(): SessionStore {
  const store = new SessionStore();
  store.adopt("portal", { accessToken: "tok_1", expiresInSeconds: 900 });
  return store;
}

export function renderPortal(store: SessionStore) {
  render(
    // A fresh QueryProvider per test, so nothing one test cached is answered
    // from the cache in the next.
    <QueryProvider>
      <PortalSessionProvider session={createPortalSession(createApiClient({ baseUrl }), store)}>
        <Portal />
      </PortalSessionProvider>
    </QueryProvider>,
  );
}
