import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SessionStore } from "@/session/store";

import { baseUrl, dashboardApi, principal, renderDashboard, ticket } from "./dashboard.fixtures";

/**
 * Coming back to a Surface that is already signed in.
 *
 * The access token is held in memory and deliberately nowhere else, so every
 * reload starts with an empty store whether or not the reader has a session.
 * That makes the store useless as an answer to "am I signed in", and for a
 * while this application asked it anyway: the queue rendered the sign-in form
 * the instant the page came back, without ever presenting the one thing that
 * knew better — the httpOnly refresh cookie, which only the API can read.
 *
 * A browser sends that cookie on its own. What was missing was anything asking
 * for it. These are the two answers it can give.
 */
const server = dashboardApi();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A reload: no token in hand, exactly as a fresh page has none. */
let store: SessionStore;
beforeEach(() => {
  store = new SessionStore();
});

describe("a reload carrying a live refresh cookie", () => {
  it("comes back to the queue rather than to the sign-in form", async () => {
    server.use(
      http.post(`${baseUrl}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: "tok_2", expiresInSeconds: 900 }),
      ),
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal({ role: "admin" }))),
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({
          data: [ticket({ id: "tkt_1", subject: "The printer is on fire" })],
          nextCursor: null,
        }),
      ),
    );

    renderDashboard(store);

    // The work, not a password prompt. This is the whole bug in one assertion.
    expect(await screen.findByRole("list", { name: /^tickets$/i })).toBeVisible();
    expect(screen.queryByLabelText(/workspace id/i)).not.toBeInTheDocument();
  });

  it("does not show the sign-in form while it is still asking", async () => {
    let answer: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });

    server.use(
      http.post(`${baseUrl}/auth/refresh`, async () => {
        await held;
        return HttpResponse.json({ accessToken: "tok_2", expiresInSeconds: 900 });
      }),
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal())),
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket({ id: "tkt_1" })], nextCursor: null }),
      ),
    );

    renderDashboard(store);

    // Nothing has come back yet. Rendering the sign-in form here is what used
    // to happen, and it is wrong even for the moment it would have lasted:
    // a reader who never signed out should not watch one flash past.
    expect(screen.queryByLabelText(/workspace id/i)).not.toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(/loading this screen/i);

    answer?.();
    expect(await screen.findByRole("list", { name: /^tickets$/i })).toBeVisible();
  });
});

describe("a reload with no cookie the API will accept", () => {
  it("settles on the sign-in form", async () => {
    // The fixture's standing handler already refuses this, which is what a
    // browser holding nothing gets.
    renderDashboard(store);

    expect(await screen.findByLabelText(/workspace id/i)).toBeVisible();
  });

  it("asks exactly once, because a second ask is read as theft", async () => {
    // The API rotates the refresh token on every use and revokes the whole
    // family if an already-rotated one is presented. A boot that asked twice
    // would sign the reader out of every tab they have open.
    const asked: string[] = [];
    server.use(
      http.post(`${baseUrl}/auth/refresh`, () => {
        asked.push("refresh");
        return HttpResponse.json(
          { error: { code: "unauthenticated", message: "No refresh token presented." } },
          { status: 401 },
        );
      }),
    );

    renderDashboard(store);
    await screen.findByLabelText(/workspace id/i);

    expect(asked).toHaveLength(1);
  });
});
