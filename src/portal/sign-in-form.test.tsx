import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApiClient } from "@/api/client";
import { QueryProvider } from "@/api/query-client";
import { SessionStore } from "@/session/store";

import { createPortalSession } from "./portal-session";
import { PortalSessionProvider } from "./portal-session-context";
import { Portal } from "./portal";

const baseUrl = "https://api.test";

// Reaching the signed-in Portal loads the Contact's Tickets. That is not what
// these tests are about, so it is answered here rather than in each of them —
// as a permanent handler, so `resetHandlers` between tests leaves it standing.
const server = setupServer(
  http.get(`${baseUrl}/portal/tickets`, () => HttpResponse.json({ data: [], nextCursor: null })),
  // A browser with no refresh cookie, which is what every one of these starts
  // as. The Portal asks this once on mount now — the access token is held in
  // memory, so the cookie is the only thing that can say whether a reload
  // still has a session. Standing, so `resetHandlers` leaves it in place.
  http.post(`${baseUrl}/portal/auth/refresh`, () =>
    HttpResponse.json(
      { error: { code: "unauthenticated", message: "No refresh token presented." } },
      { status: 401 },
    ),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = new SessionStore();
});

function renderPortal() {
  const session = createPortalSession(createApiClient({ baseUrl }), store);
  render(
    <QueryProvider>
      <PortalSessionProvider session={session}>
        <Portal />
      </PortalSessionProvider>
    </QueryProvider>,
  );
  return session;
}

async function signIn(password = "hunter2") {
  const user = userEvent.setup();
  // Awaited: the form appears once the refresh cookie has been asked about
  // and refused, not on the first paint.
  await user.type(await screen.findByLabelText(/workspace id/i), "ten_1");
  await user.type(screen.getByLabelText(/email/i), "jules@example.test");
  await user.type(screen.getByLabelText(/password/i), password);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("the Portal sign-in form", () => {
  it("reaches an authenticated Portal route", async () => {
    server.use(
      http.post(`${baseUrl}/portal/auth/sign-in`, () =>
        HttpResponse.json({ accessToken: "tok_1", expiresInSeconds: 900 }),
      ),
    );

    renderPortal();
    await signIn();

    expect(await screen.findByRole("heading", { name: /your tickets/i })).toBeVisible();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("sends the workspace, address and password it was given", async () => {
    let body: unknown;
    server.use(
      http.post(`${baseUrl}/portal/auth/sign-in`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ accessToken: "tok_1", expiresInSeconds: 900 });
      }),
    );

    renderPortal();
    await signIn();

    expect(body).toEqual({ tenantId: "ten_1", email: "jules@example.test", password: "hunter2" });
  });

  it("says the same thing for a wrong password, an unknown address and a Widget-born Contact", async () => {
    const answers = [
      "Invalid email or password",
      "No contact with that address",
      "That contact has no password set",
    ];
    const shown: string[] = [];

    for (const message of answers) {
      server.use(
        http.post(`${baseUrl}/portal/auth/sign-in`, () =>
          HttpResponse.json({ error: { code: "unauthenticated", message } }, { status: 401 }),
        ),
      );

      renderPortal();
      await signIn("whatever");
      shown.push((await screen.findByRole("alert")).textContent ?? "");
      cleanup();
    }

    expect(new Set(shown).size).toBe(1);
    // Nothing the API said about which part was wrong reaches the page.
    for (const message of answers) {
      expect(shown[0]).not.toContain(message);
    }
  });

  it("announces a refusal to a screen reader and leaves the form usable", async () => {
    server.use(
      http.post(`${baseUrl}/portal/auth/sign-in`, () =>
        HttpResponse.json({ error: { code: "unauthenticated", message: "no" } }, { status: 401 }),
      ),
    );

    renderPortal();
    await signIn("wrong");

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled();
  });

  it("is operable by keyboard alone", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${baseUrl}/portal/auth/sign-in`, () =>
        HttpResponse.json({ accessToken: "tok_1", expiresInSeconds: 900 }),
      ),
    );

    renderPortal();

    await screen.findByLabelText(/workspace id/i);

    await user.tab();
    expect(screen.getByLabelText(/workspace id/i)).toHaveFocus();
    await user.keyboard("ten_1");
    await user.tab();
    expect(screen.getByLabelText(/email/i)).toHaveFocus();
    await user.keyboard("jules@example.test");
    await user.tab();
    expect(screen.getByLabelText(/password/i)).toHaveFocus();
    await user.keyboard("hunter2{Enter}");

    expect(await screen.findByRole("heading", { name: /your tickets/i })).toBeVisible();
  });
});

describe("signing out", () => {
  it("returns to the sign-in form", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${baseUrl}/portal/auth/sign-in`, () =>
        HttpResponse.json({ accessToken: "tok_1", expiresInSeconds: 900 }),
      ),
      http.post(`${baseUrl}/portal/auth/sign-out`, () => new HttpResponse(null, { status: 204 })),
    );

    renderPortal();
    await signIn();
    await user.click(await screen.findByRole("button", { name: /sign out/i }));

    expect(await screen.findByLabelText(/password/i)).toBeVisible();
    expect(store.get("portal")).toBeUndefined();
  });
});
