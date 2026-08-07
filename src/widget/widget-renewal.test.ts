/**
 * Renewal ahead of expiry, which is the only kind this Surface can use.
 *
 * The Portal and the Dashboard renew because a request was refused, and can
 * afford to: their refresh cookie outlives the access token and the refusal is
 * recoverable. A Widget session has no such thing behind it. It renews by
 * presenting the credential it holds, so once that credential has lapsed there
 * is nothing left to present — a reactive renewal would be a request sent to be
 * told the one answer it cannot act on.
 */
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionStore } from "@/session/store";

import { baseUrl, widgetSession as sessionFor } from "./widget.fixtures";
import { keepWidgetSessionFresh, RENEW_LEAD_MS } from "./widget-renewal";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
const stopping: (() => void)[] = [];

beforeEach(() => {
  store = new SessionStore();
  vi.useFakeTimers();
});

afterEach(() => {
  for (const stop of stopping.splice(0)) stop();
  vi.useRealTimers();
});

/** A session already minted, with `minutes` of life left on it. */
function held(minutes: number) {
  const session = sessionFor(store);
  store.set("widget", { accessToken: "nvw_1", expiresAt: Date.now() + minutes * 60_000 });

  const stop = keepWidgetSessionFresh(session);
  stopping.push(stop);

  return session;
}

function renews(answer: () => Response) {
  const asked: number[] = [];
  server.use(
    http.post(`${baseUrl}/widget/sessions/renew`, () => {
      asked.push(Date.now());
      return answer();
    }),
  );
  return asked;
}

const fresh = () => HttpResponse.json({ token: "nvw_2", expiresInSeconds: 1800 });

const lapsed = () =>
  HttpResponse.json(
    { error: { code: "unauthenticated", message: "Session expired" } },
    { status: 401 },
  );

describe("a session with time left on it", () => {
  it("is replaced before it expires, not when it is refused", async () => {
    const asked = renews(fresh);
    const expiresAt = Date.now() + 30 * 60_000;
    held(30);

    await vi.advanceTimersByTimeAsync(30 * 60_000 - RENEW_LEAD_MS - 1);
    expect(asked).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(2);

    expect(asked).toHaveLength(1);
    expect(asked[0]).toBeLessThan(expiresAt);
    expect(store.get("widget")?.accessToken).toBe("nvw_2");
  });

  it("keeps going, so a long conversation is not cut off by the second expiry", async () => {
    const asked = renews(fresh);
    held(30);

    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(asked).toHaveLength(1);

    // The credential it was given is a thirty-minute one too, and it is due
    // exactly as the first was.
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(asked).toHaveLength(2);
  });

  /**
   * A session taken back up from the host page's storage can already be inside
   * the window — a Visitor who left the tab and came back to it. There is
   * nothing to wait for.
   */
  it("is replaced at once where it is already inside the window", async () => {
    const asked = renews(fresh);
    held(0.5);

    await vi.advanceTimersByTimeAsync(0);

    expect(asked).toHaveLength(1);
  });
});

describe("a session that cannot be renewed", () => {
  /**
   * There is no grace period and nothing else to present. A client that tried
   * again would be looping on the one answer that will not change, and the
   * Visitor would be sitting in an interface that silently fails.
   */
  it("ends, once, rather than being asked about again", async () => {
    const asked = renews(lapsed);
    held(30);

    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(asked).toHaveLength(1);
    expect(store.get("widget")).toBeUndefined();

    await vi.advanceTimersByTimeAsync(4 * 60 * 60_000);
    expect(asked).toHaveLength(1);
  });
});

describe("a Widget that has come off the page", () => {
  it("stops asking", async () => {
    const asked = renews(fresh);
    held(30);

    stopping.splice(0).forEach((stop) => stop());

    await vi.advanceTimersByTimeAsync(4 * 60 * 60_000);
    expect(asked).toHaveLength(0);
  });
});

describe("a Visitor who has not asked for support", () => {
  it("costs the API nothing, because there is no session to keep", async () => {
    const asked = renews(fresh);
    const session = sessionFor(store);
    stopping.push(keepWidgetSessionFresh(session));

    await vi.advanceTimersByTimeAsync(4 * 60 * 60_000);

    expect(asked).toHaveLength(0);
  });
});
