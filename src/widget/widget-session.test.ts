import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SessionStore } from "@/session/store";

import { baseUrl, refused, widgetSession as sessionFor } from "./widget.fixtures";
import { readWidgetFailure } from "./widget-session";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = new SessionStore();
});

const widgetSession = () => sessionFor(store);

describe("minting a Widget session", () => {
  it("names the Tenant and holds the credential it is given", async () => {
    let body: unknown;
    server.use(
      http.post(`${baseUrl}/widget/sessions`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ token: "nvw_1", expiresInSeconds: 1800 });
      }),
    );

    const result = await widgetSession().start();

    expect(result.ok).toBe(true);
    expect(body).toEqual({ tenantId: "ten_1" });
    expect(store.get("widget")?.accessToken).toBe("nvw_1");
  });

  /**
   * The allowlist is checked against the browser-set `Origin` header, which no
   * script can forge. So the Widget sends no origin of its own — a `tenantId`
   * in a body a page author controls is exactly the value the gate does not
   * trust, and sending one alongside it would suggest otherwise.
   */
  it("claims no origin of its own", async () => {
    let sent: string[] = [];
    server.use(
      http.post(`${baseUrl}/widget/sessions`, async ({ request }) => {
        sent = [...request.headers.keys()];
        return HttpResponse.json({ token: "nvw_1", expiresInSeconds: 1800 });
      }),
    );

    await widgetSession().start();

    expect(sent).not.toContain("origin");
    expect(sent).not.toContain("referer");
  });

  it("is refused from an origin nobody listed, and holds nothing afterwards", async () => {
    server.use(http.post(`${baseUrl}/widget/sessions`, refused));

    const result = await widgetSession().start();

    expect(result).toEqual({
      ok: false,
      failure: expect.objectContaining({ kind: "api", code: "forbidden" }),
    });
    expect(store.get("widget")).toBeUndefined();
  });

  /**
   * A refusal here is not a permission problem a Visitor could do anything
   * about, and the shared wording — "your role does not allow this" — would be
   * nonsense on a Surface with no roles and no account. It is the anti-Lifting
   * gate doing its one job, and it is read as such.
   */
  it("reads a refusal as the Widget being somewhere it does not belong", () => {
    const failure = readWidgetFailure({
      kind: "api",
      code: "forbidden",
      status: 403,
      message: "Origin not allowed for this tenant.",
    });

    expect(failure.gate).toBe(true);
    expect(failure.words).toMatch(/site/i);
    expect(failure.words).not.toMatch(/role/i);
    expect(failure.words).not.toMatch(/sign in/i);
  });

  /**
   * The distinction the Widget acts on. A gate refusal is settled and asking
   * again cannot change it; a sleeping server or a burst of traffic is weather,
   * and treating weather as settled would take support off a Tenant's page for
   * the rest of the session over one dropped request.
   */
  it("does not call weather a gate refusal", () => {
    const unreachable = readWidgetFailure({
      kind: "transport",
      reason: "unreachable",
      message: "boom",
    });

    expect(unreachable.gate).toBe(false);
    expect(unreachable.words).not.toMatch(/site/i);
    expect(unreachable.words).toMatch(/reach/i);

    const throttled = readWidgetFailure({
      kind: "api",
      code: "rate_limited",
      status: 429,
      message: "slow down",
      retryAfterSeconds: 5,
    });

    expect(throttled.gate).toBe(false);
    expect(throttled.words).toMatch(/try again/i);
  });
});

describe("a Widget session that has to be renewed", () => {
  /**
   * Renewal keeps the same session, and therefore the same conversation. It is
   * wired here so that a credential that lapses mid-call is renewed rather than
   * dropped; renewing *ahead* of expiry is 19's business.
   */
  it("renews against the same session rather than starting another", async () => {
    const asked: string[] = [];
    server.use(
      http.post(`${baseUrl}/widget/sessions`, () => {
        asked.push("start");
        return HttpResponse.json({ token: "nvw_1", expiresInSeconds: 1800 });
      }),
      http.post(`${baseUrl}/widget/sessions/renew`, () => {
        asked.push("renew");
        return HttpResponse.json({ token: "nvw_2", expiresInSeconds: 1800 });
      }),
      http.get(`${baseUrl}/widget/tickets`, ({ request }) =>
        request.headers.get("Authorization") === "Bearer nvw_2"
          ? HttpResponse.json({ data: [], nextCursor: null })
          : HttpResponse.json(
              { error: { code: "unauthenticated", message: "expired" } },
              { status: 401 },
            ),
      ),
    );

    const session = widgetSession();
    await session.start();
    const page = await session.page("/widget/tickets", "get", {});

    expect(page.ok).toBe(true);
    expect(asked).toEqual(["start", "renew"]);
    expect(store.get("widget")?.accessToken).toBe("nvw_2");
  });
});
