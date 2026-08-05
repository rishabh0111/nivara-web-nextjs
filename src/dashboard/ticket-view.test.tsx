/**
 * A User opens a Ticket from the queue and understands it before replying.
 *
 * The assertions that matter here are about which of two things a row is. An
 * internal Note posted as a customer Message, or read as one, is the mistake
 * this screen exists to make impossible — so the tests check the wire the note
 * went down and the words the row is announced with, not the colour it is
 * painted.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SessionStore } from "@/session/store";

import {
  auditEntry,
  dashboardApi,
  message,
  note,
  signedInStore,
  ticket,
} from "./dashboard.fixtures";
import { openTicket as openTicketAgainst, printer, type TicketWire } from "./ticket.fixtures";

const server = dashboardApi();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = signedInStore();
});

/** The Ticket this conversation started on, before a reply reopened it elsewhere. */
const earlier = ticket({
  id: "tkt_0",
  subject: "The printer is smoking",
  state: "closed",
  createdAt: "2026-06-01T09:00:00.000Z",
});

const openTicket = (wire: TicketWire = {}) => openTicketAgainst(server, store, wire);

/** What the conversation reads as, top to bottom. */
async function conversation(): Promise<string[]> {
  const list = await screen.findByRole("list", { name: /^conversation$/i });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

describe("opening a Ticket from the queue", () => {
  it("reads the full thread in order", async () => {
    await openTicket({
      messages: {
        tkt_1: [
          message({
            id: "msg_1",
            body: "The printer is on fire.",
            createdAt: "2026-07-01T09:00:00.000Z",
          }),
          message({
            id: "msg_2",
            body: "We are on our way.",
            authorKind: "user",
            authorId: "usr_1",
            createdAt: "2026-07-01T11:00:00.000Z",
          }),
        ],
      },
    });

    const rows = await conversation();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("The printer is on fire.");
    expect(rows[0]).toContain("Customer");
    expect(rows[1]).toContain("We are on our way.");
    expect(rows[1]).toContain("Staff");
  });

  it("takes the reader back to the queue they came from", async () => {
    const { user } = await openTicket();

    await user.click(screen.getByRole("button", { name: /back to tickets/i }));

    expect(await screen.findByRole("list", { name: /^tickets$/i })).toBeInTheDocument();
  });

  /**
   * The other half of the round trip. The control that had focus unmounts on
   * the way back, so without this a keyboard reader is returned to the top of
   * the document — having been told nothing — every time they close a Ticket.
   */
  it("puts focus back on the Ticket they were reading", async () => {
    const { user } = await openTicket();

    await user.click(screen.getByRole("button", { name: /back to tickets/i }));

    await waitFor(() =>
      expect(document.activeElement).toHaveAccessibleName(
        expect.stringContaining("The printer is on fire"),
      ),
    );
  });

  /**
   * A screen reader is told which Ticket is now on screen. Without this the
   * queue is replaced silently and focus falls to the top of the document — the
   * reader is at the start of the page with no idea anything opened.
   */
  it("puts focus on the Ticket it opened, named by its subject", async () => {
    await openTicket();

    await waitFor(() =>
      expect(document.activeElement).toHaveAccessibleName("The printer is on fire"),
    );
  });
});

describe("internal notes", () => {
  it("reads them in the conversation, in the order everything was said", async () => {
    await openTicket({
      messages: {
        tkt_1: [
          message({
            id: "msg_1",
            body: "The printer is on fire.",
            createdAt: "2026-07-01T09:00:00.000Z",
          }),
        ],
      },
      notes: {
        tkt_1: [
          note({
            id: "not_1",
            body: "Third one this month.",
            createdAt: "2026-07-01T10:00:00.000Z",
          }),
        ],
      },
    });

    const rows = await conversation();
    expect(rows[0]).toContain("The printer is on fire.");
    expect(rows[1]).toContain("Third one this month.");
  });

  /**
   * Not by a label. The row says in words, before the note itself, that the
   * customer cannot see it — so a reader who is listening to the page rather
   * than looking at it is told what they are hearing before they hear it, and a
   * reader who cannot distinguish the colours is told at all.
   */
  it("says in words that the customer cannot see one, ahead of the note", async () => {
    await openTicket({ notes: { tkt_1: [note({ id: "not_1", body: "Third one this month." })] } });

    const [row] = await conversation();
    expect(row).toMatch(/internal note: not visible to the customer/i);
    expect(row?.indexOf("Internal note")).toBeLessThan(row?.indexOf("Third one this month.") ?? 0);
  });

  it("writes one, down the Notes endpoint rather than the customer thread", async () => {
    const { user, written } = await openTicket();

    await user.type(screen.getByLabelText(/internal note/i), "Check the maintenance contract.");
    await user.click(screen.getByRole("button", { name: /add internal note/i }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({
      kind: "note",
      ticketId: "tkt_1",
      body: "Check the maintenance contract.",
    });
  });

  it("shows the note it just wrote, as the API stored it", async () => {
    const { user } = await openTicket();

    await user.type(screen.getByLabelText(/internal note/i), "Check the maintenance contract.");
    await user.click(screen.getByRole("button", { name: /add internal note/i }));

    await waitFor(async () =>
      expect((await conversation()).join(" ")).toContain("Check the maintenance contract."),
    );
  });

  /**
   * On a busy Ticket only the first page of the thread has arrived, so the point
   * both halves have been read through sits back at the oldest message — and
   * the note written a moment ago is the newest row there is. It is shown, with
   * the gap above it named, because a form that says "added" over a conversation
   * the note is not in is the interface lying to the person using it.
   */
  it("shows one written on a Ticket whose thread has only partly arrived", async () => {
    const { user } = await openTicket({
      pageThread: true,
      messages: {
        tkt_1: [
          message({
            id: "msg_1",
            body: "It started smoking.",
            createdAt: "2026-06-01T09:00:00.000Z",
          }),
          message({
            id: "msg_2",
            body: "Now it is alight.",
            createdAt: "2026-06-02T09:00:00.000Z",
          }),
        ],
      },
    });

    await user.type(screen.getByLabelText(/internal note/i), "Check the maintenance contract.");
    await user.click(screen.getByRole("button", { name: /add internal note/i }));

    await waitFor(async () =>
      expect((await conversation()).join(" ")).toContain("Check the maintenance contract."),
    );
    expect((await conversation()).join(" ")).toMatch(/earlier messages are still to be loaded/i);
  });
});

describe("a conversation that has run through more than one Ticket", () => {
  /**
   * A `closed` Ticket is terminal, so a reply on one opens a new linked Ticket.
   * The two are one conversation, and reading them as fragments is what the
   * chain endpoint exists to prevent — the Dashboard is told the whole chain
   * rather than having to have watched it happen.
   */
  it("reads as one history, oldest part first", async () => {
    await openTicket({
      conversation: [earlier, printer],
      messages: {
        tkt_0: [
          message({
            id: "msg_0",
            ticketId: "tkt_0",
            body: "There is smoke.",
            createdAt: "2026-06-01T09:00:00.000Z",
          }),
        ],
        tkt_1: [
          message({
            id: "msg_1",
            body: "Now it is on fire.",
            createdAt: "2026-07-01T09:00:00.000Z",
          }),
        ],
      },
    });

    const rows = await waitFor(async () => {
      const held = await conversation();
      expect(held.join(" ")).toContain("There is smoke.");
      return held;
    });

    const smoke = rows.findIndex((row) => row.includes("There is smoke."));
    const fire = rows.findIndex((row) => row.includes("Now it is on fire."));
    expect(smoke).toBeGreaterThanOrEqual(0);
    expect(smoke).toBeLessThan(fire);
  });

  it("names each part, so it is clear which Ticket the reader is on", async () => {
    await openTicket({ conversation: [earlier, printer] });

    const rows = await waitFor(async () => {
      const held = await conversation();
      expect(held.join(" ")).toContain("Earlier in this conversation");
      return held;
    });

    expect(rows.join(" ")).toContain("“The printer is smoking”, closed.");
    expect(rows.join(" ")).toContain("This ticket");
  });

  it("leaves a conversation of one unlabelled, because there is nothing to tell apart", async () => {
    await openTicket({
      messages: { tkt_1: [message({ id: "msg_1", body: "The printer is on fire." })] },
    });

    expect((await conversation()).join(" ")).not.toContain("This ticket");
  });
});

describe("the audit timeline", () => {
  it("shows who changed what, and when", async () => {
    await openTicket({
      audit: [
        auditEntry({
          id: "aud_2",
          action: "ticket.transitioned",
          actorKind: "user",
          actorId: "usr_1",
          fromValue: "open",
          toValue: "pending",
          createdAt: "2026-07-02T09:00:00.000Z",
        }),
        auditEntry({ id: "aud_1" }),
      ],
    });

    const timeline = await screen.findByRole("list", { name: /ticket activity/i });
    const rows = within(timeline)
      .getAllByRole("listitem")
      .map((row) => row.textContent ?? "");

    expect(rows[0]).toContain("State changed");
    expect(rows[0]).toContain("Open → Pending");
    expect(rows[0]).toContain("Staff");
    expect(rows[0]).toContain("usr_1");
    expect(rows[1]).toContain("Ticket opened");
  });

  /**
   * Messages and Notes are domain data attributed on their own rows; the log
   * records changes of state and configuration. Folding one into the other
   * would make an internal note look like an auditable act and a state change
   * look like something someone said.
   */
  it("carries no conversation, which is read above it", async () => {
    await openTicket({
      messages: { tkt_1: [message({ id: "msg_1", body: "The printer is on fire." })] },
      notes: { tkt_1: [note({ id: "not_1", body: "Third one this month." })] },
      audit: [auditEntry({ id: "aud_1" })],
    });

    const timeline = await screen.findByRole("list", { name: /ticket activity/i });
    expect(timeline.textContent).not.toContain("The printer is on fire.");
    expect(timeline.textContent).not.toContain("Third one this month.");
  });

  it("says so when nothing has been changed", async () => {
    await openTicket();

    expect(await screen.findByText(/nothing has been changed on this ticket/i)).toBeInTheDocument();
  });
});
