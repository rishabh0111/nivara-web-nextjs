/**
 * A Ticket read while events arrive underneath it.
 *
 * Every case here is *caused* on the wire — a real Socket.IO server publishing
 * a real envelope into a real Room — and asserted on the screen. Nothing calls a
 * handler, nothing inspects a cursor and nothing reads the cache: a client that
 * holds the right internal state and shows the wrong thing is a broken client,
 * and the whole claim of this issue is about what a reader sees.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http, passthrough } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { rooms } from "@/realtime/envelope";
import { startFakeServer, type FakeServer } from "@/realtime/fake-server";
import type { SessionStore } from "@/session/store";

import type { Ticket } from "@/tickets/ticket";

import {
  auditEntry,
  baseUrl,
  dashboardApi,
  message,
  note,
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
});

afterEach(async () => {
  for (const connection of opened.splice(0)) connection.close();
  await live.close();
});

const AGENTS = rooms.agents("ten_1");
const TICKET = rooms.ticket("ten_1", "tkt_1");
const INTERNAL = rooms.internal("ten_1", "tkt_1");

async function openTicket(wire: TicketWire = {}) {
  const opening = await openTicketAgainst(api, store, wire, live.realtimeUrl);
  opened.push(opening.session.live);

  // The Room is joined once the principal has said which tenant this is.
  await waitFor(() => expect(live.subscribers(TICKET)).toBe(1));
  return opening;
}

/** A Ticket as the socket carries one — a full snapshot, never a diff. */
const snapshot = (overrides: Partial<Ticket> = {}) => ({
  ...ticket({ id: "tkt_1", subject: "The printer is on fire", ...overrides }),
  spawnedFromTicketId: null,
  rootTicketId: null,
});

/** What the conversation reads as, top to bottom. */
async function conversation(): Promise<string[]> {
  const list = await screen.findByRole("list", { name: /^conversation$/i });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

describe("the thread of a Ticket being read", () => {
  it("grows as a Message is sent", async () => {
    await openTicket({
      messages: { tkt_1: [message({ id: "msg_1", body: "The printer is on fire." })] },
    });

    live.emit(
      TICKET,
      "message.created",
      message({
        id: "msg_2",
        body: "An engineer is on the way.",
        authorKind: "user",
        authorId: "usr_1",
        createdAt: "2026-07-01T11:00:00.000Z",
      }),
    );

    expect(await screen.findByText("An engineer is on the way.")).toBeVisible();
    expect(await conversation()).toHaveLength(2);
  });

  it("does not grow twice for a Message delivered twice", async () => {
    await openTicket({
      messages: { tkt_1: [message({ id: "msg_1", body: "The printer is on fire." })] },
    });

    const published = live.emit(
      TICKET,
      "message.created",
      message({
        id: "msg_2",
        body: "An engineer is on the way.",
        authorKind: "user",
        authorId: "usr_1",
        createdAt: "2026-07-01T11:00:00.000Z",
      }),
    );
    expect(await screen.findByText("An engineer is on the way.")).toBeVisible();

    // At-least-once delivery: the same envelope, under the same number, again.
    live.redeliver(published);

    // Something after it, so the count below is taken once the redelivery has
    // had every chance to land.
    live.emit(
      TICKET,
      "message.created",
      message({ id: "msg_3", body: "Fire is out.", createdAt: "2026-07-01T12:00:00.000Z" }),
    );
    expect(await screen.findByText("Fire is out.")).toBeVisible();

    expect(await conversation()).toHaveLength(3);
  });

  it("grows as an internal Note is added, and says which it is", async () => {
    await openTicket({
      messages: { tkt_1: [message({ id: "msg_1", body: "The printer is on fire." })] },
    });
    await waitFor(() => expect(live.subscribers(INTERNAL)).toBe(1));

    live.emit(
      INTERNAL,
      "note.created",
      note({
        id: "not_1",
        body: "Third printer this month.",
        createdAt: "2026-07-01T12:00:00.000Z",
      }),
    );

    const arrived = await screen.findByText("Third printer this month.");
    // A Note is a Note because of the Room it arrived in, and the row has to
    // say so — a colleague's aside read as a customer message is the one
    // mistake this screen exists to prevent.
    expect(arrived.closest("li")).toHaveTextContent("not visible to the customer");
  });
});

describe("a Ticket changed by a colleague", () => {
  it("shows the reassignment while it is being read", async () => {
    const desk = await openTicket();
    expect(await screen.findByText("Nobody has claimed this ticket.")).toBeVisible();

    // The colleague's write happened at the API first; the envelope is only the
    // announcement of it. Authority is what the API last answered, so the two
    // are made to disagree: the API says the Ticket is with usr_2, and the
    // snapshot on the wire is a moment behind and still says usr_9. A client
    // that filed the snapshot would show usr_9 and go on showing it.
    desk.move("tkt_1", { assigneeId: "usr_2" });
    live.emit(TICKET, "ticket.assigned", snapshot({ assigneeId: "usr_9" }));

    expect(await screen.findByText("Assigned to usr_2.")).toBeVisible();
    expect(screen.queryByText("Assigned to usr_9.")).not.toBeInTheDocument();
  });

  it("shows what the log recorded about it", async () => {
    const desk = await openTicket();
    expect(await screen.findByText("Nothing has been changed on this ticket.")).toBeVisible();

    desk.move("tkt_1", { assigneeId: "usr_2" });
    desk.record(
      auditEntry({
        id: "aud_2",
        action: "ticket.assigned",
        actorKind: "user",
        actorId: "usr_1",
        fromValue: null,
        toValue: "usr_2",
        createdAt: "2026-07-03T09:00:00.000Z",
      }),
    );
    live.emit(TICKET, "ticket.assigned", snapshot({ assigneeId: "usr_2" }));

    const log = await screen.findByRole("list", { name: /ticket activity/i });
    await waitFor(() => expect(log).toHaveTextContent("Assignee changed"));
    expect(log).toHaveTextContent("Unassigned → usr_2");
  });
});

/**
 * The events that change nothing.
 *
 * Neither half of ADR-0002's rule reaches these: there is nothing to append and
 * nothing to invalidate, because the Ticket is exactly as it was. A view that
 * diffed a snapshot would render nothing at all — so they are surfaced as
 * things that happened, or they are invisible, and a silent delivery failure
 * that stays silent is the failure this exists to prevent.
 */
describe("something that happened without changing the Ticket", () => {
  it("surfaces an SLA breach", async () => {
    await openTicket();

    live.emit(TICKET, "ticket.sla.breached", {
      ticketId: "tkt_1",
      timer: "first_response",
      breachedAt: "2026-07-03T09:00:00.000Z",
    });

    const notices = await screen.findByRole("log", { name: /what has happened/i });
    await waitFor(() => expect(notices).toHaveTextContent(/first response/i));
    expect(notices).toHaveTextContent("tkt_1");
  });

  it("shows the breach in the log too, because the API records one", async () => {
    const desk = await openTicket();
    expect(await screen.findByText("Nothing has been changed on this ticket.")).toBeVisible();

    desk.record(
      auditEntry({
        id: "aud_2",
        action: "sla.breached",
        actorKind: "system",
        actorId: null,
        toValue: "first_response",
        createdAt: "2026-07-03T09:00:00.000Z",
      }),
    );
    live.emit(TICKET, "ticket.sla.breached", {
      ticketId: "tkt_1",
      timer: "first_response",
      breachedAt: "2026-07-03T09:00:00.000Z",
    });

    const log = await screen.findByRole("list", { name: /ticket activity/i });
    await waitFor(() => expect(log).toHaveTextContent("SLA breached"));
  });

  it("surfaces an integration failure, with what the far end said", async () => {
    await openTicket();

    live.emit(TICKET, "ticket.integration.failed", {
      ticketId: "tkt_1",
      messageId: "msg_2",
      source: "slack",
      target: "#support",
      error: "channel_not_found",
    });

    const notices = await screen.findByRole("log", { name: /what has happened/i });
    await waitFor(() => expect(notices).toHaveTextContent("channel_not_found"));
    expect(notices).toHaveTextContent("#support");
  });

  it("counts one delivered into two Rooms once", async () => {
    await openTicket();
    await waitFor(() => expect(live.subscribers(AGENTS)).toBe(1));

    // The same breach, announced to the staff Room and to the Ticket's own. Two
    // envelopes, two unrelated sequence numbers, one thing that happened.
    const breach = {
      ticketId: "tkt_1",
      timer: "first_response",
      breachedAt: "2026-07-03T09:00:00.000Z",
    } as const;

    // The staff Room alone first, and asserted — so that a Dashboard which
    // never read that Room, or read it and announced nothing, fails here rather
    // than arriving at a count of one by having done half the work.
    live.emit(AGENTS, "ticket.sla.breached", breach);
    const notices = await screen.findByRole("log", { name: /what has happened/i });
    await waitFor(() => expect(within(notices).getAllByRole("listitem")).toHaveLength(1));

    live.emit(TICKET, "ticket.sla.breached", breach);

    // Something later, in the Room the second one went to, so the assertion
    // below is made after that delivery rather than in a race with it.
    live.emit(TICKET, "message.created", message({ id: "msg_2", body: "Chasing it now." }));
    expect(await screen.findByText("Chasing it now.")).toBeVisible();

    expect(within(notices).getAllByRole("listitem")).toHaveLength(1);
  });
});

/**
 * The Room a User reads for as long as they are signed in.
 *
 * This is the case the whole arrangement is for. A User working the queue is
 * not reading the Ticket a delivery just failed on — that is precisely why
 * nobody would otherwise hear about it.
 */
describe("a User who is not reading the Ticket at all", () => {
  it("is still told a reply on it was never delivered", async () => {
    api.use(
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal())),
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket()], nextCursor: null }),
      ),
    );

    const session = renderDashboard(store, live.realtimeUrl);
    opened.push(session.live);

    // On the queue, with no Ticket open and no Ticket Room joined.
    await screen.findByRole("list", { name: /^tickets$/i });
    await waitFor(() => expect(live.subscribers(AGENTS)).toBe(1));
    expect(live.subscribers(rooms.ticket("ten_1", "tkt_2"))).toBe(0);

    live.emit(AGENTS, "ticket.integration.failed", {
      ticketId: "tkt_2",
      messageId: "msg_7",
      source: "slack",
      target: "#support",
      error: "channel_not_found",
    });

    const notices = await screen.findByRole("log", { name: /what has happened/i });
    await waitFor(() => expect(notices).toHaveTextContent("tkt_2"));
    expect(notices).toHaveTextContent("channel_not_found");
  });

  it("can put a notice down once they have read it", async () => {
    const { user } = await openTicket();

    live.emit(TICKET, "ticket.sla.breached", {
      ticketId: "tkt_1",
      timer: "resolution",
      breachedAt: "2026-07-03T09:00:00.000Z",
    });

    const notices = await screen.findByRole("log", { name: /what has happened/i });
    await waitFor(() => expect(notices).toHaveTextContent(/resolution/i));

    // The controls live in the panel behind the bell, not in the live region.
    // That region exists to announce and holds nothing to press — a `log` full
    // of buttons is a thing a screen reader reads out as it announces.
    await user.click(screen.getByRole("button", { name: /what has happened/i }));
    await user.click(screen.getByRole("button", { name: /^dismiss$/i }));

    expect(within(notices).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("is not buried under a day of them", async () => {
    await openTicket();

    // A busy tenant, and a Dashboard nobody has closed. What falls off the end
    // is the oldest, which is what has been read or has been missed.
    for (let breached = 1; breached <= 25; breached += 1) {
      live.emit(AGENTS, "ticket.sla.breached", {
        ticketId: `tkt_${breached}`,
        timer: "first_response",
        breachedAt: `2026-07-03T09:00:${String(breached).padStart(2, "0")}.000Z`,
      });
    }

    const notices = await screen.findByRole("log", { name: /what has happened/i });
    await waitFor(() => expect(notices).toHaveTextContent("tkt_25"));

    expect(within(notices).getAllByRole("listitem")).toHaveLength(20);
    expect(notices).not.toHaveTextContent("tkt_1 ");
  });
});

describe("the Rooms this screen holds", () => {
  it("resumes each from its own count of the same period", async () => {
    await openTicket();
    await waitFor(() => expect(live.subscribers(AGENTS)).toBe(1));
    const before = live.subscribes().length;

    // The staff Room has been busy with other people's Tickets; this one has
    // heard nothing at all.
    live.emit(AGENTS, "ticket.created", snapshot({ id: "tkt_7" }));
    live.emit(AGENTS, "ticket.updated", snapshot({ id: "tkt_8" }));
    live.emit(AGENTS, "ticket.updated", snapshot({ id: "tkt_9" }));

    // Then one event, announced into both — the fourth thing the staff Room has
    // carried and the first thing this Ticket's has.
    const breach = {
      ticketId: "tkt_1",
      timer: "resolution",
      breachedAt: "2026-07-03T09:00:00.000Z",
    } as const;
    live.emit(AGENTS, "ticket.sla.breached", breach);
    live.emit(TICKET, "ticket.sla.breached", breach);

    const notices = await screen.findByRole("log", { name: /what has happened/i });
    await waitFor(() => expect(notices).toHaveTextContent(/resolution/i));

    // A moment of bad wifi. Every Room comes back asking for what it alone
    // missed: the numbers are per Room, so 4 and 1 are two unrelated counts of
    // the same stretch of time — and of the same event, at the end of it.
    live.disconnectAll();

    await waitFor(() => expect(live.subscribes().length).toBe(before + 3), { timeout: 5000 });
    const resumed = live.subscribes().slice(before);
    expect(resumed.find((asked) => asked.room === AGENTS)?.afterSeq).toBe(4);
    expect(resumed.find((asked) => asked.room === TICKET)?.afterSeq).toBe(1);
    expect(resumed.find((asked) => asked.room === INTERNAL)?.afterSeq).toBe(0);

    // And nothing was announced twice by coming back.
    expect(within(notices).getAllByRole("listitem")).toHaveLength(1);
  });
});
