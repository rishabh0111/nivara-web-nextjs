import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApiClient } from "@/api/client";
import { createPortalSession } from "@/portal/portal-session";

import { createSessionClient } from "./session-client";
import { SessionStore } from "./store";

const baseUrl = "https://api.test";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = new SessionStore();
});

const client = () => createApiClient({ baseUrl });

const expired = () =>
  HttpResponse.json(
    { error: { code: "unauthenticated", message: "Access token expired" } },
    { status: 401 },
  );

function portal() {
  return createPortalSession(client(), store);
}

describe("signing in", () => {
  it("records the credential and reaches an authenticated route with it", async () => {
    server.use(
      http.post(`${baseUrl}/portal/auth/sign-in`, () =>
        HttpResponse.json({ accessToken: "tok_1", expiresInSeconds: 900 }),
      ),
      http.get(`${baseUrl}/portal/tickets`, ({ request }) =>
        request.headers.get("Authorization") === "Bearer tok_1"
          ? HttpResponse.json({ data: [], nextCursor: null })
          : expired(),
      ),
    );

    const session = portal();
    const outcome = await session.signIn({
      tenantId: "ten_1",
      email: "jules@example.test",
      password: "hunter2",
    });

    expect(outcome.ok).toBe(true);
    expect(store.get("portal")?.accessToken).toBe("tok_1");

    const tickets = await session.page("/portal/tickets", "get", {});
    expect(tickets.ok).toBe(true);
  });

  it("answers a refused sign-in identically whatever the API said about why", async () => {
    const answers = [
      "Invalid email or password",
      "No such contact",
      "That contact has no password",
    ];
    const seen: string[] = [];

    for (const message of answers) {
      server.use(
        http.post(`${baseUrl}/portal/auth/sign-in`, () =>
          HttpResponse.json({ error: { code: "unauthenticated", message } }, { status: 401 }),
        ),
      );

      const outcome = await portal().signIn({
        tenantId: "ten_1",
        email: "jules@example.test",
        password: "wrong",
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) seen.push(outcome.failure.kind === "api" ? outcome.failure.code : "other");
    }

    // The Portal must not be usable to discover which addresses exist, so the
    // three cases have to be one case as far as anything downstream can tell.
    expect(new Set(seen)).toEqual(new Set(["unauthenticated"]));
    expect(store.get("portal")).toBeUndefined();
  });
});

describe("renewal", () => {
  it("carries the session across an expiry without the caller noticing", async () => {
    store.set("portal", { accessToken: "stale", expiresAt: 0 });

    let renewals = 0;
    server.use(
      http.post(`${baseUrl}/portal/auth/refresh`, () => {
        renewals += 1;
        return HttpResponse.json({ accessToken: "fresh", expiresInSeconds: 900 });
      }),
      http.get(`${baseUrl}/portal/tickets`, ({ request }) =>
        request.headers.get("Authorization") === "Bearer fresh"
          ? HttpResponse.json({ data: [{ id: "tkt_1" }], nextCursor: null })
          : expired(),
      ),
    );

    const result = await portal().page("/portal/tickets", "get", {});

    expect(result.ok && result.value.items).toEqual([{ id: "tkt_1" }]);
    expect(renewals).toBe(1);
    expect(store.get("portal")?.accessToken).toBe("fresh");
  });

  it("renews once for several requests that expire together, and replays them all", async () => {
    store.set("portal", { accessToken: "stale", expiresAt: 0 });

    let renewals = 0;
    server.use(
      http.post(`${baseUrl}/portal/auth/refresh`, async () => {
        renewals += 1;
        // Slow enough that every caller is queued behind this one.
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({ accessToken: "fresh", expiresInSeconds: 900 });
      }),
      http.get(`${baseUrl}/portal/tickets/:id`, ({ request, params }) =>
        request.headers.get("Authorization") === "Bearer fresh"
          ? HttpResponse.json({ id: params.id })
          : expired(),
      ),
    );

    const session = portal();
    const results = await Promise.all(
      ["a", "b", "c", "d"].map((id) =>
        session.resource("/portal/tickets/{id}", "get", { params: { id } }),
      ),
    );

    expect(renewals).toBe(1);
    expect(results.map((result) => result.ok && result.value)).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
    ]);
  });

  it("does not renew again for a request that expired before someone else's renewal landed", async () => {
    store.set("portal", { accessToken: "stale", expiresAt: 0 });

    let renewals = 0;
    server.use(
      http.post(`${baseUrl}/portal/auth/refresh`, () => {
        renewals += 1;
        return HttpResponse.json({ accessToken: "fresh", expiresInSeconds: 900 });
      }),
      http.get(`${baseUrl}/portal/tickets`, ({ request }) =>
        request.headers.get("Authorization") === "Bearer fresh"
          ? HttpResponse.json({ data: [], nextCursor: null })
          : expired(),
      ),
    );

    const session = portal();
    await session.page("/portal/tickets", "get", {});

    // A call made with the stale credential, arriving after the renewal is done.
    store.set("portal", { accessToken: "fresh", expiresAt: 0 });
    await session.page("/portal/tickets", "get", {});

    expect(renewals).toBe(1);
  });

  it("ends the session cleanly when renewal is refused, rather than looping", async () => {
    store.set("portal", { accessToken: "stale", expiresAt: 0 });

    let renewals = 0;
    let reads = 0;
    server.use(
      http.post(`${baseUrl}/portal/auth/refresh`, () => {
        renewals += 1;
        return expired();
      }),
      http.get(`${baseUrl}/portal/tickets`, () => {
        reads += 1;
        return expired();
      }),
    );

    const result = await portal().page("/portal/tickets", "get", {});

    expect(result.ok).toBe(false);
    expect(renewals).toBe(1);
    expect(reads).toBe(1);
    expect(store.get("portal")).toBeUndefined();
  });

  it("ends the session when the replay is refused too, and does not try a third time", async () => {
    store.set("portal", { accessToken: "stale", expiresAt: 0 });

    let reads = 0;
    server.use(
      http.post(`${baseUrl}/portal/auth/refresh`, () =>
        HttpResponse.json({ accessToken: "fresh", expiresInSeconds: 900 }),
      ),
      http.get(`${baseUrl}/portal/tickets`, () => {
        reads += 1;
        return expired();
      }),
    );

    const result = await portal().page("/portal/tickets", "get", {});

    expect(result.ok).toBe(false);
    expect(reads).toBe(2);
    expect(store.get("portal")).toBeUndefined();
  });

  /**
   * The other direction, and the Widget's whole reason for existing on this
   * type: a Surface whose session cannot be recovered once it has lapsed has to
   * replace the credential *before* the refusal, not because of one.
   */
  it("can be asked to renew before anything has been refused", async () => {
    store.set("portal", { accessToken: "stale", expiresAt: 0 });

    let renewals = 0;
    server.use(
      http.post(`${baseUrl}/portal/auth/refresh`, () => {
        renewals += 1;
        return HttpResponse.json({ accessToken: "fresh", expiresInSeconds: 900 });
      }),
    );

    const renewed = await portal().renew();

    expect(renewed).toBe(true);
    expect(renewals).toBe(1);
    expect(store.get("portal")?.accessToken).toBe("fresh");
  });

  it("renews once when a request expires into a renewal already under way", async () => {
    store.set("portal", { accessToken: "stale", expiresAt: 0 });

    let renewals = 0;
    server.use(
      http.post(`${baseUrl}/portal/auth/refresh`, async () => {
        renewals += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({ accessToken: "fresh", expiresInSeconds: 900 });
      }),
      http.get(`${baseUrl}/portal/tickets`, ({ request }) =>
        request.headers.get("Authorization") === "Bearer fresh"
          ? HttpResponse.json({ data: [], nextCursor: null })
          : expired(),
      ),
    );

    const session = portal();
    const [renewed, read] = await Promise.all([
      session.renew(),
      session.page("/portal/tickets", "get", {}),
    ]);

    expect(renewed).toBe(true);
    expect(read.ok).toBe(true);
    expect(renewals).toBe(1);
  });

  /**
   * Nothing to present, nothing to renew. A Surface with no credential has a
   * sign-in to show, or — on the Widget — a Launcher, and spending a request to
   * be told so would be asking the API a question already answered here.
   */
  it("does not renew a session that is not held", async () => {
    expect(await portal().renew()).toBe(false);
  });

  it("does not renew for a failure that is not an expired credential", async () => {
    store.set("portal", { accessToken: "tok", expiresAt: 0 });

    let renewals = 0;
    server.use(
      http.post(`${baseUrl}/portal/auth/refresh`, () => {
        renewals += 1;
        return HttpResponse.json({ accessToken: "fresh", expiresInSeconds: 900 });
      }),
      http.get(`${baseUrl}/portal/tickets/:id`, () =>
        HttpResponse.json(
          { error: { code: "not_found", message: "No such ticket" } },
          { status: 404 },
        ),
      ),
    );

    const result = await portal().resource("/portal/tickets/{id}", "get", {
      params: { id: "tkt_1" },
    });

    expect(result.ok).toBe(false);
    expect(renewals).toBe(0);
    expect(store.get("portal")?.accessToken).toBe("tok");
  });
});

describe("signing out", () => {
  it("clears the session", async () => {
    store.set("portal", { accessToken: "tok", expiresAt: 0 });
    server.use(
      http.post(`${baseUrl}/portal/auth/sign-out`, () => new HttpResponse(null, { status: 204 })),
    );

    await portal().signOut();

    expect(store.get("portal")).toBeUndefined();
  });

  it("clears the session even when the API could not be told", async () => {
    store.set("portal", { accessToken: "tok", expiresAt: 0 });
    server.use(http.post(`${baseUrl}/portal/auth/sign-out`, () => HttpResponse.error()));

    await portal().signOut();

    expect(store.get("portal")).toBeUndefined();
  });
});

describe("two Surfaces in one browser", () => {
  const dashboard = () =>
    createSessionClient({
      surface: "dashboard",
      client: client(),
      store,
      renew: (renewClient) => renewClient.resource("/auth/refresh", "post", { withCookies: true }),
    });

  it("keeps their credentials apart", () => {
    store.set("portal", { accessToken: "contact_tok", expiresAt: 0 });
    store.set("dashboard", { accessToken: "agent_tok", expiresAt: 0 });

    expect(portal().current()?.accessToken).toBe("contact_tok");
    expect(dashboard().current()?.accessToken).toBe("agent_tok");
  });

  it("leaves the other alone when one session ends", async () => {
    store.set("portal", { accessToken: "contact_tok", expiresAt: 0 });
    store.set("dashboard", { accessToken: "agent_tok", expiresAt: 0 });

    server.use(
      http.post(`${baseUrl}/portal/auth/refresh`, () => expired()),
      http.get(`${baseUrl}/portal/tickets`, () => expired()),
    );

    await portal().page("/portal/tickets", "get", {});

    expect(store.get("portal")).toBeUndefined();
    expect(store.get("dashboard")?.accessToken).toBe("agent_tok");
  });

  it("sends each Surface its own credential", async () => {
    store.set("portal", { accessToken: "contact_tok", expiresAt: 0 });
    store.set("dashboard", { accessToken: "agent_tok", expiresAt: 0 });

    const sent: string[] = [];
    server.use(
      http.get(`${baseUrl}/portal/tickets`, ({ request }) => {
        sent.push(request.headers.get("Authorization") ?? "none");
        return HttpResponse.json({ data: [], nextCursor: null });
      }),
      http.get(`${baseUrl}/tickets`, ({ request }) => {
        sent.push(request.headers.get("Authorization") ?? "none");
        return HttpResponse.json({ data: [], nextCursor: null });
      }),
    );

    await portal().page("/portal/tickets", "get", {});
    await dashboard().page("/tickets", "get", {});

    expect(sent).toEqual(["Bearer contact_tok", "Bearer agent_tok"]);
  });
});
