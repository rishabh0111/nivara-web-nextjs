/**
 * The Dashboard's connection, over the life of a session.
 *
 * Two rules are being defended, and they are the same rule read from both ends.
 * The connection is established once and rides — a renewal must not rebuild it,
 * because the wire contract fixes the principal at connect and rebuilding four
 * times an hour would be a disruption in exchange for nothing. And precisely
 * because it outlives the token, sign-out has to close it explicitly: otherwise
 * a signed-out browser is still being read to, which is the one failure this
 * design could have and must not.
 *
 * Both are asserted from the server's side of the wire, because "the browser
 * stopped reading" is a fact about the socket, not about a variable.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http, passthrough } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApiClient } from "@/api/client";
import { QueryProvider } from "@/api/query-client";
import { rooms } from "@/realtime/envelope";
import { startFakeServer, type FakeServer } from "@/realtime/fake-server";
import { useLiveRoom } from "@/realtime/use-live-room";
import { SessionStore } from "@/session/store";

import { createDashboardSession, type DashboardSession } from "./dashboard-session";
import { DashboardSessionProvider, useDashboardSession } from "./dashboard-session-context";
import { baseUrl, dashboardApi, principal } from "./dashboard.fixtures";
import { useSignOut } from "./use-sign-out";

const api = dashboardApi();

beforeAll(() => api.listen({ onUnhandledRequest: "error" }));
afterEach(() => api.resetHandlers());
afterAll(() => api.close());

let live: FakeServer;
let store: SessionStore;
let session: DashboardSession;

beforeEach(async () => {
  live = await startFakeServer();
  store = new SessionStore();
  store.adopt("dashboard", { accessToken: "tok_1", expiresInSeconds: 900 });
  session = createDashboardSession(createApiClient({ baseUrl }), store, live.realtimeUrl);

  // The socket is a real one on a real port; msw is stubbing the API, not it.
  api.use(http.all(`${live.url}/*`, () => passthrough()));
});

afterEach(async () => {
  session.live.close();
  await live.close();
});

const AGENTS = rooms.agents("ten_1");

/** A signed-in Dashboard, reduced to the two things this file is about. */
function Reading() {
  const held = useDashboardSession();
  const signOut = useSignOut();

  useLiveRoom(held.live, AGENTS, { envelope: () => {}, gap: () => {} });

  return (
    <>
      <button type="button" onClick={() => void held.resource("/auth/me", "get", {})}>
        Read something
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  );
}

function renderDashboard() {
  render(
    <QueryProvider>
      <DashboardSessionProvider session={session}>
        <Reading />
      </DashboardSessionProvider>
    </QueryProvider>,
  );
}

describe("the connection over a session", () => {
  it("is established once, with the credential in the handshake", async () => {
    renderDashboard();

    // One socket, holding the credential the session was signed in with, and
    // reading the Room the view asked for — the subscription lands a moment
    // after the connection does.
    await waitFor(() => expect(live.connections()).toEqual([{ token: "tok_1", rooms: [AGENTS] }]));
  });

  it("is not rebuilt when the access token is renewed", async () => {
    // The first read is refused on the credential the socket is holding, the
    // renewal mints another, and the replay is answered. A renewal that
    // rebuilt the connection would show up as a second one on this server.
    let renewed = false;
    api.use(
      http.get(`${baseUrl}/auth/me`, () =>
        renewed
          ? HttpResponse.json(principal())
          : HttpResponse.json(
              { error: { code: "unauthenticated", message: "Access token expired" } },
              { status: 401 },
            ),
      ),
      http.post(`${baseUrl}/auth/refresh`, () => {
        renewed = true;
        return HttpResponse.json({ accessToken: "tok_2", expiresInSeconds: 900 });
      }),
    );

    renderDashboard();
    await waitFor(() => expect(live.connections()).toHaveLength(1));

    await userEvent.click(screen.getByRole("button", { name: "Read something" }));
    await waitFor(() => expect(store.get("dashboard")?.accessToken).toBe("tok_2"));

    // Still one connection, still the credential it was opened with, and still
    // subscribed — the socket did not so much as flinch.
    expect(live.connections().map((held) => held.token)).toEqual(["tok_1"]);
    expect(live.subscribers(AGENTS)).toBe(1);
  });

  it("is torn down by sign-out, and the server sees it go", async () => {
    api.use(http.post(`${baseUrl}/auth/sign-out`, () => new HttpResponse(null, { status: 204 })));

    renderDashboard();
    await waitFor(() => expect(live.connections()).toHaveLength(1));

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(live.connections()).toHaveLength(0));
  });

  it("is torn down by a sign-out the API refused, because the credential is gone either way", async () => {
    api.use(
      http.post(
        `${baseUrl}/auth/sign-out`,
        () => new HttpResponse(null, { status: 500, headers: { "content-type": "text/plain" } }),
      ),
    );

    renderDashboard();
    await waitFor(() => expect(live.connections()).toHaveLength(1));

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(live.connections()).toHaveLength(0));
    expect(store.get("dashboard")).toBeUndefined();
  });
});
