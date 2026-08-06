/**
 * The queue, while the tenant's work changes underneath it.
 *
 * Every case here is caused on the wire — a real Socket.IO server publishing a
 * real envelope into the staff Room — and asserted on the screen, for the same
 * reason the Ticket's own live tests are: a client that holds the right internal
 * state and shows the wrong list is a broken client.
 *
 * What is being asserted is a *refusal* as much as a behaviour. The list must
 * not move, and the way to fail that honestly is to make the server's answer
 * genuinely different from what is on screen at the moment the envelope lands —
 * so a Dashboard that patched the list locally, or refetched on the event, shows
 * the new answer here and fails.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const printer = ticket({ id: "tkt_1", subject: "The printer is on fire", state: "open" });
const invoice = ticket({ id: "tkt_2", subject: "My invoice is wrong", state: "open" });

/** A Ticket as the socket carries one — a full snapshot, never a diff. */
const snapshot = (of: Ticket) => ({ ...of, spawnedFromTicketId: null, rootTicketId: null });

/**
 * A tenant's queue as the API answers for it, and a colleague changing it.
 *
 * The answers are held rather than canned, because the whole question here is
 * what the screen does when the server's answer and the list on screen have
 * come apart. `nowHolds` is the colleague's write landing at the API — which
 * happens before the envelope announcing it, exactly as it does in life.
 */
function serveQueue(seed: Ticket[]) {
  let held = [...seed];

  api.use(
    http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal())),
    http.get(`${baseUrl}/tickets`, ({ request }) => {
      const state = new URL(request.url).searchParams.get("state");
      const matching = held.filter((one) => state === null || state.split(",").includes(one.state));

      return HttpResponse.json({ data: matching, nextCursor: null });
    }),

    // Enough of a Ticket to open one and come back. What is inside it is the
    // other live tests' question; this file only needs somewhere to have been.
    http.get(`${baseUrl}/tickets/:id/conversation`, ({ params }) =>
      HttpResponse.json({
        data: held.filter((one) => one.id === String(params.id)),
        nextCursor: null,
      }),
    ),
    http.get(`${baseUrl}/tickets/:id/messages`, () =>
      HttpResponse.json({ data: [], nextCursor: null }),
    ),
    http.get(`${baseUrl}/tickets/:id/notes`, () =>
      HttpResponse.json({ data: [], nextCursor: null }),
    ),
    http.get(`${baseUrl}/tickets/:id/audit`, () =>
      HttpResponse.json({ data: [], nextCursor: null }),
    ),
  );

  return { nowHolds: (next: Ticket[]) => (held = next) };
}

async function openQueue(seed: Ticket[], at = "/dashboard") {
  window.history.replaceState(null, "", at);
  const desk = serveQueue(seed);

  const session = renderDashboard(store, live.realtimeUrl);
  opened.push(session.live);

  await screen.findByRole("list", { name: /^tickets$/i });
  // The staff Room is joined once the principal has said which tenant this is.
  await waitFor(() => expect(live.subscribers(AGENTS)).toBe(1));

  return { ...desk, user: userEvent.setup() };
}

/** What the queue reads as, top to bottom. */
function queued(): string[] {
  const list = screen.getByRole("list", { name: /^tickets$/i });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

/** What the queue says about itself: overtaken, current, or nothing yet. */
function saidAboutTheList(): string {
  return screen.getByRole("status", { name: /whether this list is current/i }).textContent ?? "";
}

/** The reader being told the list is behind, if they are being told. */
function toldItChanged(): boolean {
  return /the queue has changed/i.test(saidAboutTheList());
}

/**
 * Waits until anything the last envelope set off has had its chance.
 *
 * Asserting that a list did *not* move is asserting about something that has
 * not happened yet, and the answer that would move it is one msw round trip
 * away — so an assertion made straight after the envelope passes whether the
 * list is being held still or is a moment from being replaced. This publishes
 * something later into the same Room and waits for it to reach the screen: it
 * crosses a real socket, and nothing arrives that way before an in-process HTTP
 * response already in flight.
 */
async function settle(after: string) {
  live.emit(AGENTS, "ticket.sla.breached", {
    ticketId: after,
    timer: "resolution",
    breachedAt: "2026-07-03T09:00:00.000Z",
  });

  const notices = await screen.findByRole("log", { name: /what has happened/i });
  await waitFor(() => expect(notices).toHaveTextContent(/resolution/i));
}

const refreshButton = () => screen.getByRole("button", { name: /refresh the queue/i });

describe("a Ticket arriving while the queue is being read", () => {
  it("does not insert itself into the list", async () => {
    const desk = await openQueue([printer]);

    // The API has it, and would serve it to anybody who asked again.
    desk.nowHolds([invoice, printer]);
    live.emit(AGENTS, "ticket.created", snapshot(invoice));

    await waitFor(() => expect(toldItChanged()).toBe(true));
    await settle("tkt_1");

    expect(queued()).toHaveLength(1);
    expect(screen.queryByText("My invoice is wrong")).not.toBeInTheDocument();
  });

  it("moves when the User asks, to what the server says", async () => {
    const desk = await openQueue([printer]);

    desk.nowHolds([invoice, printer]);
    live.emit(AGENTS, "ticket.created", snapshot(invoice));
    await waitFor(() => expect(toldItChanged()).toBe(true));

    await desk.user.click(refreshButton());

    await waitFor(() => expect(queued()).toHaveLength(2));
    // The server's own order, not one computed here from an envelope.
    expect(queued()[0]).toContain("My invoice is wrong");
    expect(toldItChanged()).toBe(false);
  });

  it("leaves the control the reader was standing on where it was", async () => {
    const desk = await openQueue([printer]);

    desk.nowHolds([invoice, printer]);
    live.emit(AGENTS, "ticket.created", snapshot(invoice));
    await waitFor(() => expect(toldItChanged()).toBe(true));

    const refresh = refreshButton();
    refresh.focus();
    await desk.user.click(refresh);
    await waitFor(() => expect(queued()).toHaveLength(2));

    // The affordance is asked for repeatedly and by a keyboard, so it does not
    // go away under the reader the moment they use it.
    expect(document.activeElement).toBe(refreshButton());
  });
});

/**
 * The case no client can compute.
 *
 * Membership in a cursor-paginated window over a server-side sort is not a
 * property of the Ticket, so a resolved Ticket in a list of open ones cannot be
 * patched, removed or re-sorted into the right answer — it can only be asked
 * about.
 */
describe("a Ticket that no longer belongs in the slice", () => {
  it("stays where it is until the User asks, then goes because the server says so", async () => {
    const desk = await openQueue([printer], "/dashboard?state=open");
    expect(queued()).toHaveLength(1);

    const resolved = { ...printer, state: "resolved" as const };
    desk.nowHolds([resolved]);
    live.emit(AGENTS, "ticket.updated", snapshot(resolved));

    await waitFor(() => expect(toldItChanged()).toBe(true));
    await settle("tkt_1");

    // Still in a list of open Tickets, where the server would no longer put it.
    expect(screen.getByText("The printer is on fire")).toBeVisible();

    await desk.user.click(refreshButton());

    expect(await screen.findByText("No tickets match these filters.")).toBeVisible();
  });
});

/**
 * The other half of the same impossibility, and the one that costs a misclick.
 *
 * A Ticket that moved in the server's order has not left the slice; it is in a
 * different row of it. Re-sorting the page in hand would be meaningless anyway —
 * it is one window of several over an order the server owns — but the reason it
 * is not attempted is nearer than that: rows that swap under a cursor are rows
 * that get clicked by mistake.
 */
describe("a Ticket the server would now put somewhere else in the order", () => {
  it("stays in the row it was read in, and moves only when the User asks", async () => {
    const desk = await openQueue([printer, invoice]);
    expect(queued()[0]).toContain("The printer is on fire");

    // The same two Tickets, the other way round — nothing has entered or left,
    // so nothing but the order can be being asserted here.
    desk.nowHolds([invoice, printer]);
    live.emit(AGENTS, "ticket.updated", snapshot(invoice));

    await waitFor(() => expect(toldItChanged()).toBe(true));
    await settle("tkt_2");

    expect(queued()[0]).toContain("The printer is on fire");

    await desk.user.click(refreshButton());

    await waitFor(() => expect(queued()[0]).toContain("My invoice is wrong"));
  });
});

/**
 * A refresh that changes nothing looks exactly like a refresh that did nothing.
 *
 * So the region says which it was — and says it once the read has come back,
 * because a message written on the click would be reporting the button rather
 * than the server.
 */
describe("asking a queue that has not changed", () => {
  it("says so, and says nothing until it has been asked", async () => {
    const desk = await openQueue([printer]);
    expect(saidAboutTheList()).toBe("");

    await desk.user.click(refreshButton());

    await waitFor(() => expect(saidAboutTheList()).toMatch(/the queue is up to date/i));
    expect(queued()).toHaveLength(1);
  });
});

/**
 * The events that cannot change which Tickets are in a queue or where they sit.
 *
 * Telling a reader their list is behind when it is not is how the telling stops
 * being worth reading.
 */
describe("an event that leaves the queue alone", () => {
  it("says nothing about the queue for something that merely happened", async () => {
    await openQueue([printer]);

    live.emit(AGENTS, "ticket.sla.breached", {
      ticketId: "tkt_1",
      timer: "first_response",
      breachedAt: "2026-07-03T09:00:00.000Z",
    });

    // The notice is the proof the envelope arrived and was read at all, so this
    // cannot pass by a Dashboard that never joined the Room.
    const notices = await screen.findByRole("log", { name: /what has happened/i });
    await waitFor(() => expect(notices).toHaveTextContent(/first response/i));

    expect(toldItChanged()).toBe(false);
  });

  it("says nothing about the queue for a Message on somebody's Ticket", async () => {
    await openQueue([printer]);

    live.emit(AGENTS, "message.created", message({ id: "msg_2", body: "Chasing it now." }));

    // Something after it, in the same Room, so the assertion below is made once
    // the Message has had every chance to land rather than in a race with it.
    live.emit(AGENTS, "ticket.integration.failed", {
      ticketId: "tkt_9",
      messageId: "msg_9",
      source: "slack",
      target: "#support",
      error: "channel_not_found",
    });

    const notices = await screen.findByRole("log", { name: /what has happened/i });
    await waitFor(() => expect(notices).toHaveTextContent("channel_not_found"));

    expect(toldItChanged()).toBe(false);
  });
});

/**
 * The reader who was not on the queue when it changed.
 *
 * Holding the list still is about not moving it under a cursor, and nobody's
 * cursor is on it while a Ticket is open — so coming back is where the truth can
 * arrive without costing anybody a misclick. Held here as the property the
 * decision leans on rather than as a claim about this code: the read on the way
 * back is what fetches, as it did before any of this existed. What would break
 * it is the queue being taught to hold its answer across a remount, and that is
 * what this would catch.
 */
describe("a queue nobody is reading", () => {
  it("is caught up by the time the reader comes back to it", async () => {
    const desk = await openQueue([printer]);

    await desk.user.click(screen.getByRole("button", { name: /the printer is on fire/i }));
    await screen.findByRole("heading", { name: "The printer is on fire" });

    desk.nowHolds([invoice, printer]);
    live.emit(AGENTS, "ticket.created", snapshot(invoice));

    await desk.user.click(await screen.findByRole("button", { name: /back to tickets/i }));

    expect(await screen.findByText("My invoice is wrong")).toBeVisible();
    expect(toldItChanged()).toBe(false);
  });
});
