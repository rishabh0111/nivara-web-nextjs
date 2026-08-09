/**
 * One path, against the deployed API and the isolation Tenant: sign in, load
 * the queue, open a Ticket, reply, and watch the reply arrive live.
 *
 * It is small on purpose, and it is not a second test suite. The mocked suite
 * already says what this application does with every answer the API can give.
 * What it cannot say is whether the answers arrive at all — a cross-origin
 * refusal, a refresh cookie a browser would not send, a socket that never
 * connects. Those are the failures that would most embarrass this repository,
 * and a mocked run passes straight through every one of them. It already did:
 * both API-side blockers were found by asking the deployed API rather than by
 * running the suite.
 *
 * So the code under test here is the shipping code — the request layer, the
 * session, the live connection — with one thing swapped underneath it: a
 * `fetch` that enforces what a browser would, because Node's does not.
 * `e2e/README.md` has the argument for that substitution and its limits.
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient, type ApiResult } from "@/api/client";
import { createDashboardSession, type DashboardSession } from "@/dashboard/dashboard-session";
import { rooms, type RealtimeEnvelope } from "@/realtime/envelope";
import { SessionStore } from "@/session/store";
import type { Message } from "@/tickets/message";
import type { Ticket } from "@/tickets/ticket";

import { createBrowserFetch, type BrowserFetch } from "./browser-rules/browser-fetch";
import { describeCookies } from "./browser-rules/cookie-jar";
import { readLiveEnvironment, type LiveEnvironment } from "./environment";

/** How long a published event has to arrive before the socket is the suspect. */
const LIVE_ARRIVAL_MS = 30_000;

const reading = readLiveEnvironment();

if (reading.ready) {
  livePath(reading.environment);
} else {
  console.warn(`Skipping the live path — ${reading.reason}`);

  describe.skip("one path against the deployed API", () => {
    it("is not configured", () => {});
  });
}

/**
 * The environment arrives as an argument rather than being read back out of the
 * module, so that a misconfiguration is the one sentence above and never a
 * `TypeError` four steps into a run.
 */
function livePath(environment: LiveEnvironment): void {
  describe("one path against the deployed API", () => {
    const { tenantId } = environment.credentials;

    let browser: BrowserFetch;
    let dashboard: DashboardSession;
    let ticket: Ticket;

    beforeAll(() => {
      browser = createBrowserFetch({ origin: environment.origin });

      dashboard = createDashboardSession(
        createApiClient({ baseUrl: environment.endpoints.httpBaseUrl, fetch: browser.fetch }),
        // Its own store: this suite is a browser that has just been opened, and
        // the process-wide one belongs to whatever else imported it.
        new SessionStore(),
        environment.endpoints.realtimeUrl,
      );
    });

    afterAll(() => {
      // The connection outlives the token by design, and the process will not
      // exit while it is open.
      dashboard?.live.close();
    });

    it("wakes the API, however long that takes", async () => {
      const started = Date.now();

      // The budget is a timeout rather than an assertion on the elapsed time. A
      // Cold start is a state, not a failure: waking slowly is the condition
      // this step exists to survive, and only never waking is a result.
      const response = await browser.fetch(`${environment.endpoints.httpBaseUrl}/health`, {
        signal: AbortSignal.timeout(environment.coldStartBudgetMs),
      });

      console.log(`The API answered /health in ${((Date.now() - started) / 1000).toFixed(1)}s.`);

      expect(response.ok).toBe(true);
    });

    it("signs a User in at the isolation Tenant", async () => {
      const signedIn = await dashboard.signIn(environment.credentials);

      expect(signedIn.ok, failureOf(signedIn)).toBe(true);
      expect(dashboard.current()?.accessToken).toBeTruthy();

      // The tenant was a routing input to the sign-in lookup and is not held
      // anywhere afterwards, so the only account of which Tenant this credential
      // acts in is the API's own — and the Rooms below are named from the
      // Tenant that was asked for, which this is what confirms.
      const principal = await dashboard.resource("/auth/me", "get", {});

      expect(principal.ok, failureOf(principal)).toBe(true);
      if (!principal.ok) return;

      expect(principal.value.tenantId).toBe(tenantId);
    });

    it("renews the credential from the refresh cookie, as a browser would", async () => {
      const before = dashboard.current()?.accessToken;

      // Asserted before renewing, because a renewal that succeeded some other
      // way would be a green step that never exercised the cookie rule at all
      // — which is the half of this the deployed API was blocked on.
      expect(
        browser.jar.header("/auth/refresh"),
        [
          "Sign-in set no refresh cookie a browser would send back cross-site.",
          `Held for /auth/refresh but withheld: ${describeCookies(browser.jar.withheld("/auth/refresh"))}.`,
          "A cookie that survives this arrangement is SameSite=None; Secure.",
        ].join(" "),
      ).toBeTruthy();

      const renewed = await dashboard.renew();

      expect(renewed, "The session was refused a renewal it presented a cookie for.").toBe(true);

      const after = dashboard.current()?.accessToken;

      // Truthy as well as different: a cleared session is also "not what was
      // held before", and it is the opposite of a renewal.
      expect(after).toBeTruthy();
      expect(after).not.toBe(before);
    });

    it("loads the queue and opens a Ticket", async () => {
      const queue = await dashboard.page("/tickets", "get", { query: { limit: 5 } });

      expect(queue.ok, failureOf(queue)).toBe(true);
      if (!queue.ok) return;

      // The isolation Tenant is small on purpose — five seeded Tickets — which
      // is what makes it a Tenant a person can check rather than count.
      expect(queue.value.items.length).toBeGreaterThan(0);

      const summary = queue.value.items[0]!;
      const opened = await dashboard.resource("/tickets/{id}", "get", {
        params: { id: summary.id },
      });

      expect(opened.ok, failureOf(opened)).toBe(true);
      if (!opened.ok) return;

      expect(opened.value.id).toBe(summary.id);
      ticket = opened.value;

      const thread = await dashboard.page("/tickets/{id}/messages", "get", {
        params: { id: ticket.id },
      });

      expect(thread.ok, failureOf(thread)).toBe(true);
    });

    it("replies, and sees the reply arrive live", async () => {
      expect(ticket, "No Ticket was opened, so there is nothing to reply to.").toBeDefined();

      // Unique, so that what arrives is provably the Message this run sent and
      // not a redelivery of one from the last.
      const body = `End-to-end check ${randomUUID()}`;

      const arrived = new Promise<RealtimeEnvelope<"message.created">>((resolve, reject) => {
        const timer = setTimeout(() => {
          leave();
          reject(
            new Error(
              `Nothing arrived in ${rooms.ticket(tenantId, ticket.id)} within ${LIVE_ARRIVAL_MS}ms of the reply being accepted.`,
            ),
          );
        }, LIVE_ARRIVAL_MS);

        const leave = dashboard.live.join(rooms.ticket(tenantId, ticket.id), {
          envelope(envelope) {
            if (envelope.event !== "message.created") return;
            if ((envelope.data as Message).body !== body) return;

            clearTimeout(timer);
            leave();
            resolve(envelope as RealtimeEnvelope<"message.created">);
          },
          // The Room is joined from nothing, so the server having moved past
          // this resume point says the buffer is short, not that this run went
          // wrong.
          gap() {},
        });
      });

      const sent = await dashboard.resource("/tickets/{id}/messages", "post", {
        params: { id: ticket.id },
        body: { body },
      });

      expect(sent.ok, failureOf(sent)).toBe(true);
      if (!sent.ok) return;

      const envelope = await arrived;

      // The same Message, by id, and in the Room the Ticket it landed on names.
      // Which Ticket that is comes off the answer rather than off the request:
      // a reply to a `closed` Ticket opens a new linked one.
      expect(envelope.data.id).toBe(sent.value.id);
      expect(envelope.data.ticketId).toBe(sent.value.ticketId);
      expect(envelope.seq).toBeGreaterThan(0);
    });
  });
}

/** Whatever the API said, where a step failed and the message is the diagnosis. */
function failureOf(result: ApiResult<unknown>): string | undefined {
  return result.ok ? undefined : JSON.stringify(result.failure);
}
