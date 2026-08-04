/**
 * What every Dashboard test needs to stand a Dashboard up against a fake wire.
 *
 * Fixtures are typed as the document types them, so a handler cannot describe a
 * response the API could not have sent. That is the whole reason they are shared
 * rather than retyped per file: a fixture that drifts from the document is a
 * test that passes against a client shape the server stopped serving.
 */
import { render } from "@testing-library/react";
import { HttpResponse, http, passthrough, type RequestHandler } from "msw";
import { setupServer, type SetupServer } from "msw/node";

import { createApiClient } from "@/api/client";
import type { components } from "@/api/generated/openapi";
import { QueryProvider } from "@/api/query-client";
import { SessionStore } from "@/session/store";

import { createDashboardSession, type DashboardSession } from "./dashboard-session";
import { DashboardSessionProvider } from "./dashboard-session-context";
import { Dashboard } from "./dashboard";

export const baseUrl = "https://api.test";

/**
 * Where the live connection goes when a test is not driving one.
 *
 * A signed-in Dashboard reads Rooms — that is now part of what it is, not
 * something a test opts into — so every test that stands one up opens a socket
 * whether or not it cares. Pointing them at a port nothing is listening on is
 * the honest version of "there is no live server here": the handshake is
 * refused by the operating system, exactly as it would be against an API that
 * is down, and a client that fell over because of it would be a client with a
 * bug worth failing over.
 */
const NOWHERE = "http://127.0.0.1:1";

/**
 * The msw server a Dashboard test asks its questions through.
 *
 * Its one standing handler lets the handshake out of msw rather than answering
 * it, so a socket connecting to nothing does not read as a request nobody
 * wrote a handler for. Standing rather than added per test, so `resetHandlers`
 * does not quietly take it away again.
 */
/**
 * What a browser with no refresh cookie gets, which is every test that has not
 * said otherwise.
 *
 * Standing rather than per-test, because every Surface now asks this once on
 * mount: the access token lives in memory, so after a reload the only thing
 * that can say whether a session survives is the cookie. A test about a signed
 * *out* screen would otherwise fail on an unhandled request, having said
 * nothing about renewal at all.
 *
 * It answers exactly as the deployed API does — 401 `unauthenticated`, no body
 * beyond the error. A test that wants a renewal to succeed overrides it.
 */
export const noRefreshCookie = http.post(`${baseUrl}/auth/refresh`, () =>
  HttpResponse.json(
    { error: { code: "unauthenticated", message: "No refresh token presented." } },
    { status: 401 },
  ),
);

export function dashboardApi(...standing: RequestHandler[]): SetupServer {
  return setupServer(
    http.all(`${NOWHERE}/*`, () => passthrough()),
    noRefreshCookie,
    ...standing,
  );
}

type PrincipalDto = components["schemas"]["PrincipalDto"];

/**
 * The records themselves come from beside the domain types, so a unit test over
 * a pure function can have one without standing a React tree up to get it.
 */
export { auditEntry, message, note, ticket } from "@/tickets/tickets.fixtures";

export function principal(overrides: Partial<PrincipalDto> = {}): PrincipalDto {
  return {
    kind: "user",
    userId: "usr_1",
    tenantId: "ten_1",
    role: "agent",
    email: "sam@meridian.test",
    name: "Sam Okonkwo",
    ...overrides,
  };
}

/** A store already holding a Dashboard credential, so tests start signed in. */
export function signedInStore(): SessionStore {
  const store = new SessionStore();
  store.adopt("dashboard", { accessToken: "tok_1", expiresInSeconds: 900 });
  return store;
}

/**
 * Stands the whole Dashboard up against a fake wire.
 *
 * The session comes back so that a test which opened a live connection can
 * close it: the connection outlives the tree it was opened from, which is the
 * whole point of it, and a test that unmounted and walked away would leave a
 * socket reconnecting to a server the next test has already replaced.
 */
export function renderDashboard(
  store: SessionStore,
  /** Where the live connection goes, when a test is driving one. */
  realtimeUrl: string = `${NOWHERE}/rt`,
): DashboardSession {
  const session = createDashboardSession(createApiClient({ baseUrl }), store, realtimeUrl);

  render(
    // A fresh QueryProvider per test, so nothing one test cached is answered
    // from the cache in the next.
    <QueryProvider>
      <DashboardSessionProvider session={session}>
        <Dashboard />
      </DashboardSessionProvider>
    </QueryProvider>,
  );

  return session;
}
