/**
 * A Dashboard that loses its connection, and what the User is owed while it is
 * gone.
 *
 * Every case here is caused on the wire by actually dropping the socket — the
 * server drops it, or the server goes away entirely — and asserted on the
 * screen. None of it is simulated above the transport, because the whole claim
 * is about what a browser does with a connection it did not choose to lose, and
 * a test that called a handler would be asserting that the handler exists.
 *
 * The three answers being defended are different from each other. An ordinary
 * blip is invisible: what was missed arrives, once, and nothing on the screen
 * moves. A Gap is visible and ordinary: what cannot be accounted for is dropped
 * and read again, with the same waiting treatment any read has. A connection
 * that cannot be restored is visible and said in words, because the one thing a
 * User must never do is trust a screen that has stopped updating.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http, passthrough } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { rooms } from "@/realtime/envelope";
import { startFakeServer, type FakeServer } from "@/realtime/fake-server";
import type { SessionStore } from "@/session/store";
import type { Ticket } from "@/tickets/ticket";

import {
  baseUrl,
  dashboardApi,
  message,
  principal,
  renderDashboard,
  signedInStore,
  ticket,
} from "./dashboard.fixtures";
import { openTicket as openTicketAgainst, type TicketWire } from "./ticket.fixtures";

const api = dashboardApi();

beforeAll(() => api.listen({ onUnhandledRequest: "error" }));
afterEach(() => api.resetHandlers());
afterAll(() => api.close());

let live: FakeServer;
let store: SessionStore;
/** Closed at the end of every test: a connection outlives the tree it opened. */
const opened: { close(): void }[] = [];

beforeEach(async () => {
  live = await startFakeServer();
  store = signedInStore();

  // The socket is a real one on a real port; msw is stubbing the API, not it.
  api.use(http.all(`${live.url}/*`, () => passthrough()));
  window.history.replaceState(null, "", "/dashboard");
});

afterEach(async () => {
  for (const connection of opened.splice(0)) connection.close();
  await live.close();
});

const AGENTS = rooms.agents("ten_1");
const TICKET = rooms.ticket("ten_1", "tkt_1");

/** Socket.IO waits a second before its first attempt to come back. */
const ACROSS_A_RECOVERY = { timeout: 5000 };

async function openTicket(wire: TicketWire = {}) {
  const opening = await openTicketAgainst(api, store, wire, live.realtimeUrl);
  opened.push(opening.session.live);

  await waitFor(() => expect(live.subscribers(TICKET)).toBe(1));
  return opening;
}

/** What the conversation reads as, top to bottom. */
async function conversation(): Promise<string[]> {
  const list = await screen.findByRole("list", { name: /^conversation$/i });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

/**
 * A recovery the reader has no way of noticing.
 *
 * The interesting assertions here are the ones about things that did *not*
 * happen: the same elements are still the same elements, the reader is standing
 * where they were standing, and nothing arrived twice.
 */
describe("a moment of bad wifi while a Ticket is open", () => {
  it("backfills only what was missed, without disturbing the screen", async () => {
    await openTicket({ messages: { tkt_1: [message({ id: "msg_1", body: "There is smoke." })] } });

    live.emit(
      TICKET,
      "message.created",
      message({
        id: "msg_2",
        body: "An engineer is on the way.",
        createdAt: "2026-07-01T11:00:00.000Z",
      }),
    );
    expect(await screen.findByText("An engineer is on the way.")).toBeVisible();

    // The elements the reader is looking at, and the control they are standing
    // on, before anything happens to the connection.
    //
    // Scroll position is not asserted directly, and could not be honestly:
    // there is no layout here, so every element's `scrollTop` is zero whatever
    // happens to it. What actually loses a reader their place is the list being
    // torn down and built again, and that is what is asserted — along with the
    // focus, which is the other thing a re-mount takes with it.
    const list = await screen.findByRole("list", { name: /^conversation$/i });
    const reply = screen.getByRole("textbox", { name: /reply to the customer/i });
    reply.focus();

    live.disconnectAll();

    // Published while nobody was there to hear it. The Room's buffer holds it
    // and the resume point is what decides what comes back.
    live.emit(
      TICKET,
      "message.created",
      message({ id: "msg_3", body: "Fire is out.", createdAt: "2026-07-01T12:00:00.000Z" }),
    );

    await waitFor(() => expect(screen.getByText("Fire is out.")).toBeVisible(), ACROSS_A_RECOVERY);

    // Three rows, not four: the one already seen was not replayed into the
    // screen a second time.
    expect(await conversation()).toHaveLength(3);
    // The same list element, not a new one that happens to read the same. A
    // recovery that re-mounted the view would have scrolled the reader to the
    // top of it and dropped what they were typing.
    expect(await screen.findByRole("list", { name: /^conversation$/i })).toBe(list);
    expect(document.activeElement).toBe(reply);
  });
});

/**
 * The Gap, caused the only way it happens: the socket is away long enough that
 * the Room's replay buffer no longer reaches back to where it got to.
 *
 * `forget` is the bounded buffer doing on a busy Room what a fixed number of
 * envelopes does. What makes these tests honest is that the reply published
 * while the socket was away is *not* replayed to it — the only way it can reach
 * the screen is by being read from the API again.
 */
describe("a Ticket whose Room the server can no longer replay", () => {
  it("reads the Ticket again rather than showing what it cannot stand behind", async () => {
    const desk = await openTicket({
      messages: { tkt_1: [message({ id: "msg_1", body: "There is smoke." })] },
    });

    // Something heard, so this Room has a resume point to fall behind from.
    desk.say(
      message({
        id: "msg_2",
        body: "An engineer is on the way.",
        createdAt: "2026-07-01T11:00:00.000Z",
      }),
    );
    live.emit(
      TICKET,
      "message.created",
      message({
        id: "msg_2",
        body: "An engineer is on the way.",
        createdAt: "2026-07-01T11:00:00.000Z",
      }),
    );
    expect(await screen.findByText("An engineer is on the way.")).toBeVisible();

    live.disconnectAll();

    // The colleague's reply lands at the API and is announced into a Room
    // nobody is currently in — and by the time the socket is back, the server
    // can no longer replay it.
    desk.say(message({ id: "msg_3", body: "Fire is out.", createdAt: "2026-07-01T12:00:00.000Z" }));
    live.emit(
      TICKET,
      "message.created",
      message({ id: "msg_3", body: "Fire is out.", createdAt: "2026-07-01T12:00:00.000Z" }),
    );
    live.forget(TICKET);

    // Nothing on the wire can put this on the screen. It is here because the
    // Gap sent the Dashboard back to the API for the whole thread.
    await waitFor(() => expect(screen.getByText("Fire is out.")).toBeVisible(), ACROSS_A_RECOVERY);
    expect(await conversation()).toHaveLength(3);
  });

  it("waits, rather than reporting a failure", async () => {
    await openTicket({ messages: { tkt_1: [message({ id: "msg_1", body: "There is smoke." })] } });

    live.emit(
      TICKET,
      "message.created",
      message({
        id: "msg_2",
        body: "An engineer is on the way.",
        createdAt: "2026-07-01T11:00:00.000Z",
      }),
    );
    expect(await screen.findByText("An engineer is on the way.")).toBeVisible();

    // An API that has not answered yet, so what the screen does in the moment
    // between discarding and being told again is observable rather than raced
    // against. A read in flight is the ordinary condition of every screen here.
    api.use(http.get(`${baseUrl}/tickets/:id/messages`, () => new Promise<never>(() => {})));

    live.disconnectAll();
    live.emit(
      TICKET,
      "message.created",
      message({ id: "msg_3", body: "Fire is out.", createdAt: "2026-07-01T12:00:00.000Z" }),
    );
    live.forget(TICKET);

    expect(
      await screen.findByText("Loading the conversation…", {}, ACROSS_A_RECOVERY),
    ).toBeVisible();
    // Dropped, not kept alongside a spinner: what was held is exactly what the
    // server has just said it cannot account for.
    expect(screen.queryByText("There is smoke.")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

/** The tenant's queue as the API answers for it, and a colleague changing it. */
function serveQueue(seed: Ticket[]) {
  let held = [...seed];

  api.use(
    http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal())),
    http.get(`${baseUrl}/tickets`, () => HttpResponse.json({ data: held, nextCursor: null })),
  );

  return { nowHolds: (next: Ticket[]) => (held = next) };
}

const printer = ticket({ id: "tkt_1", subject: "The printer is on fire", state: "open" });
const invoice = ticket({ id: "tkt_2", subject: "My invoice is wrong", state: "open" });

/** A Ticket as the socket carries one — a full snapshot, never a diff. */
const snapshot = (of: Ticket) => ({ ...of, spawnedFromTicketId: null, rootTicketId: null });

async function openQueue(seed: Ticket[]) {
  const desk = serveQueue(seed);
  const session = renderDashboard(store, live.realtimeUrl);
  opened.push(session.live);

  await screen.findByRole("list", { name: /^tickets$/i });
  await waitFor(() => expect(live.subscribers(AGENTS)).toBe(1));

  return desk;
}

/** What the queue reads as, top to bottom. */
function queued(): string[] {
  const list = screen.getByRole("list", { name: /^tickets$/i });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

/**
 * The one thing that moves the list without the reader asking.
 *
 * Everywhere else this Dashboard refuses to: a queue that rearranged itself
 * under a cursor is how the wrong Ticket gets clicked. A Gap is the exception
 * the refusal depends on — the reader is being offered a choice about a list
 * nobody can describe, and "leave it as it is" is not one of the options.
 */
describe("a staff Room the server can no longer replay", () => {
  it("re-reads the queue without waiting to be asked", async () => {
    const desk = await openQueue([printer]);

    live.emit(AGENTS, "ticket.updated", snapshot(printer));
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: /whether this list is current/i }),
      ).toHaveTextContent(/the queue has changed/i),
    );

    live.disconnectAll();

    desk.nowHolds([invoice, printer]);
    live.emit(AGENTS, "ticket.created", snapshot(invoice));
    live.forget(AGENTS);

    await waitFor(() => expect(queued()).toHaveLength(2), ACROSS_A_RECOVERY);
    expect(screen.getByText("My invoice is wrong")).toBeVisible();

    // And the reader is not left being told the list is behind, having just
    // watched it catch up without being asked.
    expect(
      screen.getByRole("status", { name: /whether this list is current/i }),
    ).not.toHaveTextContent(/the queue has changed/i);
  });

  it("waits for the list, rather than reporting a failure", async () => {
    await openQueue([printer]);

    // Something heard, so this Room has a resume point to fall behind from: a
    // reader with no history has missed nothing and is never told otherwise.
    live.emit(AGENTS, "ticket.updated", snapshot(printer));
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: /whether this list is current/i }),
      ).toHaveTextContent(/the queue has changed/i),
    );

    // An API that has not answered yet, so what the queue does between
    // discarding and being told again is observable rather than raced against.
    api.use(http.get(`${baseUrl}/tickets`, () => new Promise<never>(() => {})));

    live.disconnectAll();
    live.emit(AGENTS, "ticket.created", snapshot(invoice));
    live.forget(AGENTS);

    expect(await screen.findByText("Loading tickets…", {}, ACROSS_A_RECOVERY)).toBeVisible();
    expect(screen.queryByText("The printer is on fire")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

/** What the Dashboard says about whether it is still being kept current. */
function saidAboutTheConnection(): string {
  return (
    screen.getByRole("status", { name: /whether this screen is receiving updates/i }).textContent ??
    ""
  );
}

/**
 * The connection that cannot be restored.
 *
 * Caused by taking the server away, which is what a sleeping instance or a
 * network that has gone looks like from a browser: every attempt to come back
 * is refused by nothing at all. The browser goes on trying, so being told is a
 * state the screen leaves as well as one it enters.
 */
describe("a connection that cannot be restored", () => {
  it("tells the User the screen has stopped updating, until it has not", async () => {
    await openQueue([printer]);
    expect(saidAboutTheConnection()).toBe("");

    await live.close();
    await waitFor(() => expect(saidAboutTheConnection()).toMatch(/stopped receiving updates/i), {
      timeout: 15000,
    });

    // Back on the port the browser has been trying to reach all along.
    const back = await startFakeServer({ port: live.port });
    try {
      await waitFor(() => expect(saidAboutTheConnection()).toBe(""), { timeout: 15000 });
      // And reading again, from where it got to.
      await waitFor(() => expect(back.subscribers(AGENTS)).toBe(1));
    } finally {
      await back.close();
    }
  }, 40000);
});
