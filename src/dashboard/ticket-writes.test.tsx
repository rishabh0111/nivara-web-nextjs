/**
 * A User changes a Ticket and answers the Contact.
 *
 * Two things are being defended here, and they are the two ways this screen can
 * lie to the person using it.
 *
 * The first is offering a move that does not exist. The transition table is the
 * database's, so an illegal move is refused wherever it is attempted — an
 * interface that offered one would be teaching the rules by refusal, which is
 * the thing the issue names.
 *
 * The second is worse: leaving a User believing a change landed when it did not.
 * So every refusal here is asserted twice over — that it is *said*, and that the
 * control has gone back to what the API still holds. A screen that kept showing
 * the value somebody chose would send them away thinking the Ticket had moved.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SessionStore } from "@/session/store";

import { baseUrl, dashboardApi, message, signedInStore, ticket } from "./dashboard.fixtures";
import { openTicket as openTicketAgainst, printer, type TicketWire } from "./ticket.fixtures";

const server = dashboardApi();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = signedInStore();
});

const openTicket = (wire: TicketWire = {}) => openTicketAgainst(server, store, wire);

/** The signed-in User, as `dashboard.fixtures` mints the principal. */
const ME = "usr_1";

/** The words the header summarises the Ticket with — its state and priority. */
function summary(): HTMLElement {
  return screen.getByText(/priority · updated/i, { selector: "p" });
}

/** What the state control currently offers, in the reader's words. */
function stateOptions(): string[] {
  return within(screen.getByLabelText("State"))
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");
}

describe("only the transitions that are actually legal", () => {
  it("offers the three moves out of an open Ticket, and never straight to closed", async () => {
    await openTicket();

    expect(stateOptions()).toEqual(["Open", "Pending", "On hold", "Resolved"]);
  });

  /**
   * The one path to a locked record. Reaching it from an active state would be
   * refused by the database, so it is not offered from one.
   */
  it("offers closing only once a Ticket is resolved", async () => {
    await openTicket({ conversation: [{ ...printer, state: "resolved" }] });

    expect(stateOptions()).toEqual(["Resolved", "Open", "Closed"]);
  });

  it("models the fifth state the realtime document leaves out", async () => {
    await openTicket({ conversation: [{ ...printer, state: "on_hold" }] });

    expect(stateOptions()).toContain("On hold");
    expect(stateOptions()).toEqual(["On hold", "Open", "Pending", "Resolved"]);
  });

  /**
   * Nothing leads out of `closed`, so there is no control — absent rather than
   * present-and-refusing, and with the reason said in words, because a reader
   * looking for the control needs to know it is missing on purpose.
   */
  it("offers no state control on a closed Ticket, and says why", async () => {
    await openTicket({ conversation: [{ ...printer, state: "closed" }] });

    expect(screen.queryByLabelText("State")).not.toBeInTheDocument();
    expect(screen.getByText(/closed ticket is final/i)).toBeInTheDocument();
  });
});

describe("changing a Ticket's state", () => {
  it("writes the transition and shows the Ticket where it now is", async () => {
    const { user, written } = await openTicket();

    await user.selectOptions(screen.getByLabelText("State"), "pending");
    await user.click(screen.getByRole("button", { name: /change state/i }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({ kind: "state", ticketId: "tkt_1", state: "pending" });

    await waitFor(() => expect(screen.getByLabelText("State")).toHaveValue("pending"));
    expect(summary()).toHaveTextContent(/^Pending ·/);
  });

  /** The set of legal moves is a property of where the Ticket is, so it moves too. */
  it("offers the moves out of where the Ticket has arrived", async () => {
    const { user } = await openTicket();

    await user.selectOptions(screen.getByLabelText("State"), "resolved");
    await user.click(screen.getByRole("button", { name: /change state/i }));

    await waitFor(() => expect(stateOptions()).toEqual(["Resolved", "Open", "Closed"]));
  });

  /**
   * The `ticket:close` permission is not on any read this application makes, so
   * closing is offered to everyone from `resolved` and a User who may not close
   * learns it here. That makes the refusal path the one that has to be right.
   */
  it("says a refused transition was refused, and puts the state back", async () => {
    const { user, written } = await openTicket({
      conversation: [{ ...printer, state: "resolved" }],
      refuse: { state: { status: 403, code: "forbidden", message: "Not permitted." } },
    });

    await user.selectOptions(screen.getByLabelText("State"), "closed");
    await user.click(screen.getByRole("button", { name: /change state/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/your role does not allow this/i);
    expect(screen.getByLabelText("State")).toHaveValue("resolved");
    expect(summary()).toHaveTextContent(/^Resolved ·/);
    expect(written).toHaveLength(0);
  });
});

describe("changing a Ticket's priority", () => {
  it("escalates one, and shows the Ticket at its new urgency", async () => {
    const { user, written } = await openTicket();

    await user.selectOptions(screen.getByLabelText("Priority"), "urgent");
    await user.click(screen.getByRole("button", { name: /change priority/i }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({ kind: "priority", ticketId: "tkt_1", priority: "urgent" });

    await waitFor(() => expect(summary()).toHaveTextContent(/Urgent priority/));
  });

  it("says a refused change was refused, and puts the priority back", async () => {
    const { user } = await openTicket({
      refuse: { priority: { status: 409, code: "conflict", message: "Changed." } },
    });

    await user.selectOptions(screen.getByLabelText("Priority"), "urgent");
    await user.click(screen.getByRole("button", { name: /change priority/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/has changed since you loaded it/i);
    expect(screen.getByLabelText("Priority")).toHaveValue("normal");
    expect(summary()).toHaveTextContent(/Normal priority/);
  });

  /** A locked record. Its own rule, not a transition — the table is not consulted. */
  it("is not offered on a closed Ticket", async () => {
    await openTicket({ conversation: [{ ...printer, state: "closed" }] });

    expect(screen.queryByLabelText("Priority")).not.toBeInTheDocument();
  });
});

describe("who a Ticket belongs to", () => {
  it("says when nobody has claimed it", async () => {
    await openTicket();

    expect(screen.getByText(/nobody has claimed this ticket/i)).toBeInTheDocument();
  });

  it("claims one for the signed-in User", async () => {
    const { user, written } = await openTicket();

    await user.click(screen.getByRole("button", { name: /assign to me/i }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({ kind: "assignee", ticketId: "tkt_1", assigneeId: ME });
    expect(await screen.findByText(new RegExp(`assigned to ${ME}`, "i"))).toBeInTheDocument();
  });

  it("hands one to a colleague by their id", async () => {
    const { user, written } = await openTicket();

    await user.type(screen.getByLabelText(/assign to a colleague/i), "usr_2");
    await user.click(screen.getByRole("button", { name: /^assign$/i }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({ kind: "assignee", ticketId: "tkt_1", assigneeId: "usr_2" });
    expect(await screen.findByText(/assigned to usr_2/i)).toBeInTheDocument();
  });

  /** Back to the unclaimed pool, which is a place a Ticket goes and not an absence. */
  it("returns one to the unclaimed pool", async () => {
    const { user, written } = await openTicket({
      conversation: [{ ...printer, assigneeId: "usr_2" }],
    });

    await user.click(screen.getByRole("button", { name: /unassign/i }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({ kind: "assignee", ticketId: "tkt_1", assigneeId: null });
    expect(await screen.findByText(/nobody has claimed this ticket/i)).toBeInTheDocument();
  });

  it("says a refused assignment was refused, and leaves the Ticket where it was", async () => {
    const { user } = await openTicket({
      conversation: [{ ...printer, assigneeId: "usr_2" }],
      refuse: { assignee: { status: 404, code: "not_found", message: "No such User." } },
    });

    await user.click(screen.getByRole("button", { name: /assign to me/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not found/i);
    expect(screen.getByText(/assigned to usr_2/i)).toBeInTheDocument();
  });
});

describe("answering the Contact", () => {
  it("replies down the customer thread, and the reply appears in it", async () => {
    const { user, written } = await openTicket({
      messages: { tkt_1: [message({ id: "msg_1", body: "The printer is on fire." })] },
    });

    await user.type(screen.getByLabelText(/reply to the customer/i), "An engineer is on the way.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({
      kind: "message",
      ticketId: "tkt_1",
      body: "An engineer is on the way.",
    });

    const conversation = await screen.findByRole("list", { name: /^conversation$/i });
    await waitFor(() => expect(conversation).toHaveTextContent("An engineer is on the way."));
  });

  /**
   * A reply is not only a Message — it moves the Ticket it lands on, and a
   * terminal one it does not land on at all. Which Ticket that was is read off
   * the response rather than predicted from the state in hand, because a
   * prediction that is right most of the time is how a reply is shown on a
   * Ticket it is not on.
   */
  it("follows the Ticket the reply actually landed on", async () => {
    const { user } = await openTicket({
      conversation: [
        { ...printer, state: "closed" },
        ticket({ id: "tkt_2", subject: "Still alight" }),
      ],
      replyLandsOn: "tkt_2",
    });

    await user.type(screen.getByLabelText(/reply to the customer/i), "Reopening this.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    const conversation = await screen.findByRole("list", { name: /^conversation$/i });
    await waitFor(() => expect(conversation).toHaveTextContent("Reopening this."));
  });

  it("keeps what was typed when the reply is refused", async () => {
    const { user } = await openTicket({
      refuse: { message: { status: 429, code: "rate_limited", message: "Slow down." } },
    });

    const box = screen.getByLabelText(/reply to the customer/i);
    await user.type(box, "An engineer is on the way.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too many requests/i);
    expect(box).toHaveValue("An engineer is on the way.");
  });

  /**
   * The reply and the internal note are two forms over two endpoints, never one
   * box with a toggle. The distinction is the whole point of the screen above
   * them, and a mis-click here is a colleague's aside sent to the customer.
   */
  it("is a separate form from the internal note", async () => {
    const { user, written } = await openTicket();

    await user.type(screen.getByLabelText(/internal note/i), "Third one this month.");
    await user.click(screen.getByRole("button", { name: /add internal note/i }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]?.kind).toBe("note");
  });
});

describe("from the keyboard alone", () => {
  /**
   * Not "the controls exist and could be focused" — the whole round trip, done
   * with keys: reach the control, choose a value, submit, and be told what
   * happened. A write reachable only with a pointer is a write half the people
   * doing this job cannot make.
   */
  it("moves a Ticket without a pointer, and announces the outcome", async () => {
    const { user, written } = await openTicket();

    const state = screen.getByLabelText("State");
    await user.selectOptions(state, "pending");

    // The control that acts on the choice is the next thing along, so choosing
    // and submitting is one movement rather than a hunt across the region.
    state.focus();
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName(/change state/i);

    await user.keyboard("{Enter}");

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({ kind: "state", ticketId: "tkt_1", state: "pending" });

    // Announced, not merely rendered. The live region that does it is the
    // toaster rather than a line inside the panel: on a real Ticket screen the
    // panel is below the conversation, so a reader who has scrolled up never
    // sees what it says. The criterion is unchanged — the write is announced.
    await waitFor(() =>
      expect(screen.getByRole("region", { name: /what just happened/i })).toHaveTextContent(
        /state is now pending/i,
      ),
    );
  });

  it("claims a Ticket with a key press, and announces that it did", async () => {
    const { user, written } = await openTicket();

    screen.getByRole("button", { name: /assign to me/i }).focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({ kind: "assignee", ticketId: "tkt_1", assigneeId: ME });

    await waitFor(() =>
      expect(screen.getByRole("region", { name: /what just happened/i })).toHaveTextContent(
        /this ticket is now yours/i,
      ),
    );
  });

  /**
   * The id field submits on Enter, which is what a reader who has just finished
   * typing one will press. Reaching for the button afterwards is a movement the
   * form should not require, and a text input inside a form that ignored Enter
   * would be quietly unlike every other one.
   */
  it("hands a Ticket over on Enter, without reaching for the button", async () => {
    const { user, written } = await openTicket();

    await user.type(screen.getByLabelText(/assign to a colleague/i), "usr_2{Enter}");

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toEqual({ kind: "assignee", ticketId: "tkt_1", assigneeId: "usr_2" });
  });

  it("answers the customer without a pointer, and announces that it was sent", async () => {
    const { user, written } = await openTicket();

    const box = screen.getByLabelText(/reply to the customer/i);
    box.focus();
    await user.keyboard("An engineer is on the way.");

    await user.tab();
    expect(document.activeElement).toHaveAccessibleName(/send reply/i);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]?.kind).toBe("message");

    // Its own region, named apart from the one the three changes announce into:
    // "sent" and "changed" are different claims, and a reader hearing one wants
    // to know which form has just spoken.
    await waitFor(() =>
      expect(screen.getByRole("status", { name: /happened to your reply/i })).toHaveTextContent(
        /sent to the customer/i,
      ),
    );
  });
});

/**
 * The half of the optimism bargain that is not a rollback.
 *
 * Predicting a write is only licensed because a refusal is impossible to miss,
 * and the refusals are asserted throughout this file already. What was missing
 * is the other side: that the prediction happens at all. Without this the three
 * edits could quietly go back to waiting for the server and every other test
 * here would still pass.
 */
describe("an edit the reader has not waited for", () => {
  it("shows the new state before the API has answered", async () => {
    const { user } = await openTicket();

    // Registered after the fixture's own, and `server.use` prepends — so this
    // is the handler that answers, and it does not answer until it is let go.
    let answer: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });

    server.use(
      http.patch(`${baseUrl}/tickets/:id/state`, async () => {
        await held;
        return HttpResponse.json(ticket({ id: "tkt_1", state: "pending" }));
      }),
    );

    await user.selectOptions(screen.getByLabelText("State"), "pending");
    await user.click(screen.getByRole("button", { name: /change state/i }));

    // Nothing has come back yet, and the header already reads the new state.
    // This is the prediction and it can be nothing else.
    await waitFor(() => expect(summary()).toHaveTextContent(/pending/i));

    answer?.();

    // Still there once the server's own account of the write has replaced it.
    await waitFor(() => expect(summary()).toHaveTextContent(/pending/i));
  });
});
