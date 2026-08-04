import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SessionStore } from "@/session/store";

import { baseUrl, dashboardApi, principal, renderDashboard, ticket } from "./dashboard.fixtures";

// Reaching the signed-in Dashboard loads the queue and asks who is holding the
// credential. Those are not what these tests are about, so they are answered
// here — as permanent handlers, so `resetHandlers` leaves them standing.
const server = dashboardApi(
  http.get(`${baseUrl}/tickets`, () => HttpResponse.json({ data: [ticket()], nextCursor: null })),
  http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal())),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = new SessionStore();
});

const minted = { accessToken: "tok_1", expiresInSeconds: 900 };

async function signIn(password = "hunter2") {
  const user = userEvent.setup();

  // Awaited, because the form is not the first thing this screen renders any
  // more. A reload has no access token — it lives in memory — so every mount
  // asks the refresh cookie whether there is a session to resume, and the
  // sign-in form is what that question resolving to "no" produces.
  await user.type(await screen.findByLabelText(/workspace id/i), "ten_1");
  await user.type(screen.getByLabelText(/email/i), "sam@meridian.test");
  await user.type(screen.getByLabelText(/password/i), password);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  return user;
}

describe("a User signing in", () => {
  it("lands on the queue, with no further navigation to make", async () => {
    server.use(http.post(`${baseUrl}/auth/sign-in`, () => HttpResponse.json(minted)));

    renderDashboard(store);
    await signIn();

    // The queue itself, not a landing page offering to show it.
    const queue = await screen.findByRole("list", { name: /^tickets$/i });
    expect(queue).toBeVisible();
    expect(screen.getByText("The printer is on fire")).toBeVisible();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("sends the tenant, address and password it was given", async () => {
    let body: unknown;
    server.use(
      http.post(`${baseUrl}/auth/sign-in`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(minted);
      }),
    );

    renderDashboard(store);
    await signIn();
    await screen.findByRole("list", { name: /^tickets$/i });

    expect(body).toEqual({ tenantId: "ten_1", email: "sam@meridian.test", password: "hunter2" });
  });

  /**
   * The tenant is a routing input to the sign-in lookup and nothing else. The
   * API resolves it from the credential on every subsequent call, so a client
   * that keeps hold of it has a second source of truth for something it does
   * not own — and a URL that carries it invites someone to edit it.
   */
  it("never names the tenant again once signed in", async () => {
    const afterwards: string[] = [];

    server.use(
      http.post(`${baseUrl}/auth/sign-in`, () => HttpResponse.json(minted)),
      http.all(`${baseUrl}/*`, async ({ request }) => {
        afterwards.push(`${request.url} ${await request.clone().text()}`);
        return undefined;
      }),
    );

    renderDashboard(store);
    await signIn();
    await screen.findByRole("list", { name: /^tickets$/i });

    expect(afterwards.length).toBeGreaterThan(0);
    for (const request of afterwards) {
      expect(request).not.toContain("ten_1");
      expect(request).not.toContain("tenant");
    }

    // Nor anywhere a reader could see it or a colleague could be sent it.
    expect(document.body.textContent).not.toContain("ten_1");
    expect(window.location.href).not.toContain("ten_1");
  });

  it("says the same thing whichever part of the credential was wrong", async () => {
    const answers = [
      "Invalid email or password",
      "No user with that address",
      "That address belongs to a different tenant",
    ];
    const shown: string[] = [];

    for (const message of answers) {
      server.use(
        http.post(`${baseUrl}/auth/sign-in`, () =>
          HttpResponse.json({ error: { code: "unauthenticated", message } }, { status: 401 }),
        ),
      );

      renderDashboard(new SessionStore());
      await signIn("whatever");
      shown.push((await screen.findByRole("alert")).textContent ?? "");
      cleanup();
    }

    expect(new Set(shown).size).toBe(1);
    for (const message of answers) {
      expect(shown[0]).not.toContain(message);
    }
  });

  it("announces a refusal and leaves the form usable", async () => {
    server.use(
      http.post(`${baseUrl}/auth/sign-in`, () =>
        HttpResponse.json({ error: { code: "unauthenticated", message: "no" } }, { status: 401 }),
      ),
    );

    renderDashboard(store);
    await signIn("wrong");

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled();
  });

  it("is operable by keyboard alone", async () => {
    const user = userEvent.setup();
    server.use(http.post(`${baseUrl}/auth/sign-in`, () => HttpResponse.json(minted)));

    renderDashboard(store);

    await user.tab();
    expect(screen.getByLabelText(/workspace id/i)).toHaveFocus();
    await user.keyboard("ten_1");
    await user.tab();
    expect(screen.getByLabelText(/email/i)).toHaveFocus();
    await user.keyboard("sam@meridian.test");
    await user.tab();
    expect(screen.getByLabelText(/password/i)).toHaveFocus();
    await user.keyboard("hunter2{Enter}");

    expect(await screen.findByRole("list", { name: /^tickets$/i })).toBeVisible();
  });
});

describe("signing out", () => {
  it("ends the session and returns to the sign-in form", async () => {
    let toldTheApi = false;
    server.use(
      http.post(`${baseUrl}/auth/sign-in`, () => HttpResponse.json(minted)),
      http.post(`${baseUrl}/auth/sign-out`, () => {
        toldTheApi = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderDashboard(store);
    const user = await signIn();
    await screen.findByRole("list", { name: /^tickets$/i });

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(await screen.findByLabelText(/password/i)).toBeVisible();
    expect(store.get("dashboard")).toBeUndefined();
    expect(toldTheApi).toBe(true);

    // Nor is the workspace kept to save the next sign-in some typing. That is
    // the tempting way the tenant gets back into the client, and from there
    // back onto a request.
    expect(screen.getByLabelText(/workspace id/i)).toHaveValue("");
  });

  /**
   * Everything on the screen was read with the credential just given up. A
   * second User signing in on the same machine must not be shown the first
   * one's queue and name, not even for the moment a refetch takes.
   */
  it("takes the last User's queue and name with it", async () => {
    server.use(
      http.post(`${baseUrl}/auth/sign-in`, () => HttpResponse.json(minted)),
      http.post(`${baseUrl}/auth/sign-out`, () => new HttpResponse(null, { status: 204 })),
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal({ name: "Sam Okonkwo" }))),
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket({ subject: "Sam's ticket" })], nextCursor: null }),
      ),
    );

    renderDashboard(store);
    const user = await signIn();
    expect(await screen.findByText("Sam's ticket")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /sign out/i }));
    await screen.findByLabelText(/password/i);

    server.use(
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal({ name: "Ada Byrne" }))),
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({
          data: [ticket({ id: "tkt_2", subject: "Ada's ticket" })],
          nextCursor: null,
        }),
      ),
    );

    await signIn();

    expect(await screen.findByText("Ada's ticket")).toBeVisible();
    expect(screen.queryByText("Sam's ticket")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sam Okonkwo/)).not.toBeInTheDocument();
  });

  it("forgets the credential even when the API could not be told", async () => {
    server.use(
      http.post(`${baseUrl}/auth/sign-in`, () => HttpResponse.json(minted)),
      http.post(`${baseUrl}/auth/sign-out`, () => HttpResponse.error()),
    );

    renderDashboard(store);
    const user = await signIn();
    await screen.findByRole("list", { name: /^tickets$/i });

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(await screen.findByLabelText(/password/i)).toBeVisible();
    expect(store.get("dashboard")).toBeUndefined();
  });
});
