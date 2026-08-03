import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { components } from "@/api/generated/openapi";
import type { SessionStore } from "@/session/store";

import { baseUrl, message, renderPortal, signedInStore, ticket } from "./portal.fixtures";

type MessageDto = components["schemas"]["MessageDto"];
type TicketDto = components["schemas"]["TicketDto"];

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = signedInStore();
});

/** The Tickets this Contact has raised, as one page. */
function listing(...tickets: TicketDto[]) {
  return http.get(`${baseUrl}/portal/tickets`, () =>
    HttpResponse.json({ data: tickets, nextCursor: null }),
  );
}

/** One Ticket, read by id — how the Portal picks up a Ticket it did not list. */
function reading(...tickets: TicketDto[]) {
  return http.get(`${baseUrl}/portal/tickets/:id`, ({ params }) => {
    const found = tickets.find((candidate) => candidate.id === params.id);
    return found
      ? HttpResponse.json(found)
      : HttpResponse.json(
          { error: { code: "not_found", message: "No such ticket." } },
          { status: 404 },
        );
  });
}

/** Threads keyed by Ticket id, oldest first, as the Portal asks for them. */
function threads(byTicket: Record<string, MessageDto[]>) {
  return http.get(`${baseUrl}/portal/tickets/:id/messages`, ({ params }) =>
    HttpResponse.json({ data: byTicket[String(params.id)] ?? [], nextCursor: null }),
  );
}

describe("opening a Ticket", () => {
  it("takes a subject and a first message, and lands the Contact on what was opened", async () => {
    const user = userEvent.setup();
    const opened = ticket({ id: "tkt_9", subject: "My invoice is wrong", state: "open" });
    const sent: unknown[] = [];

    server.use(
      listing(),
      http.post(`${baseUrl}/portal/tickets`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json(opened, { status: 201 });
      }),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, async ({ params, request }) => {
        sent.push({ ticketId: params.id, ...((await request.json()) as object) });
        return HttpResponse.json(
          message({ id: "msg_9", ticketId: "tkt_9", body: "You billed me twice." }),
          { status: 201 },
        );
      }),
      reading(opened),
      threads({
        tkt_9: [message({ id: "msg_9", ticketId: "tkt_9", body: "You billed me twice." })],
      }),
    );

    renderPortal(store);

    await user.click(await screen.findByRole("button", { name: /open a ticket/i }));
    await user.type(screen.getByLabelText(/subject/i), "My invoice is wrong");
    await user.type(screen.getByLabelText(/message/i), "You billed me twice.");
    await user.click(screen.getByRole("button", { name: /^open ticket$/i }));

    // The subject is a field of the Ticket and the body is a field of the first
    // Message: the API takes them at two endpoints, not one.
    expect(sent).toEqual([
      { subject: "My invoice is wrong" },
      { ticketId: "tkt_9", body: "You billed me twice." },
    ]);

    expect(await screen.findByRole("heading", { name: "My invoice is wrong" })).toBeVisible();
    const thread = await screen.findByRole("list", { name: /conversation/i });
    expect(within(thread).getByText("You billed me twice.")).toBeVisible();
  });

  /**
   * The Ticket and its first Message are two writes. When the second fails the
   * first has already landed, and a form that re-ran both would leave the
   * Contact with two Tickets for one question.
   */
  it("does not open a second Ticket when only the first message failed", async () => {
    const user = userEvent.setup();
    const opened = ticket({ id: "tkt_9", subject: "My invoice is wrong" });
    let opens = 0;
    let messageAttempts = 0;

    server.use(
      listing(),
      http.post(`${baseUrl}/portal/tickets`, () => {
        opens += 1;
        return HttpResponse.json(opened, { status: 201 });
      }),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, () => {
        messageAttempts += 1;
        return messageAttempts === 1
          ? HttpResponse.json(
              { error: { code: "internal_error", message: "boom" } },
              { status: 500 },
            )
          : HttpResponse.json(message({ id: "msg_9", ticketId: "tkt_9" }), { status: 201 });
      }),
      reading(opened),
      threads({
        tkt_9: [message({ id: "msg_9", ticketId: "tkt_9", body: "You billed me twice." })],
      }),
    );

    renderPortal(store);

    await user.click(await screen.findByRole("button", { name: /open a ticket/i }));
    await user.type(screen.getByLabelText(/subject/i), "My invoice is wrong");
    await user.type(screen.getByLabelText(/message/i), "You billed me twice.");
    await user.click(screen.getByRole("button", { name: /^open ticket$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ticket was opened/i);

    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByRole("heading", { name: "My invoice is wrong" })).toBeVisible();
    expect(opens).toBe(1);
    expect(messageAttempts).toBe(2);
  });
});

describe("replying to a Ticket", () => {
  async function open(user: ReturnType<typeof userEvent.setup>, subject: RegExp) {
    await user.click(await screen.findByRole("button", { name: subject }));
    await screen.findByRole("list", { name: /conversation/i });
  }

  it("shows the reply in the thread", async () => {
    const user = userEvent.setup();
    const thread = [message({ id: "msg_1", ticketId: "tkt_1", body: "It is on fire." })];

    server.use(
      listing(ticket({ id: "tkt_1", state: "open" })),
      // The Ticket is read back after the reply: replying reopens a `pending`
      // or `resolved` Ticket, so the record in hand is one write out of date.
      reading(ticket({ id: "tkt_1", state: "open" })),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, async ({ request }) => {
        const body = (await request.json()) as { body: string };
        const reply = message({ id: "msg_2", ticketId: "tkt_1", body: body.body });
        thread.push(reply);
        return HttpResponse.json(reply, { status: 201 });
      }),
      http.get(`${baseUrl}/portal/tickets/:id/messages`, () =>
        HttpResponse.json({ data: [...thread], nextCursor: null }),
      ),
    );

    renderPortal(store);
    await open(user, /the printer is on fire/i);

    await user.type(screen.getByLabelText("Reply"), "It is still on fire.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    const conversation = await screen.findByRole("list", { name: /conversation/i });
    expect(await within(conversation).findByText("It is still on fire.")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(/reply was sent/i);
  });

  /**
   * `closed` is terminal. The API does not revive it — it opens a new linked
   * Ticket and the reply becomes its first Message — so the Contact must end up
   * looking at the Ticket their message actually landed on.
   */
  it("lands on the new Ticket when the one replied to was closed", async () => {
    const user = userEvent.setup();

    server.use(
      listing(ticket({ id: "tkt_1", subject: "The printer is on fire", state: "closed" })),
      reading(ticket({ id: "tkt_2", subject: "The printer is on fire", state: "open" })),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, () =>
        HttpResponse.json(
          message({ id: "msg_2", ticketId: "tkt_2", body: "It is on fire again." }),
          { status: 201 },
        ),
      ),
      threads({
        tkt_1: [message({ id: "msg_1", ticketId: "tkt_1", body: "It was on fire." })],
        tkt_2: [message({ id: "msg_2", ticketId: "tkt_2", body: "It is on fire again." })],
      }),
    );

    renderPortal(store);
    await open(user, /the printer is on fire/i);

    await user.type(screen.getByLabelText("Reply"), "It is on fire again.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByText(/opened a new ticket/i)).toBeVisible();
    const conversation = await screen.findByRole("list", { name: /conversation/i });
    expect(await within(conversation).findByText("It is on fire again.")).toBeVisible();
  });

  /**
   * The response is read, never predicted. Here the Ticket replied to is `open`,
   * so every rule of thumb says the reply stayed put — and the API says
   * otherwise. What the API said wins.
   */
  it("follows the Ticket the API answered with, not the one replied to", async () => {
    const user = userEvent.setup();

    server.use(
      listing(ticket({ id: "tkt_1", subject: "The printer is on fire", state: "open" })),
      reading(ticket({ id: "tkt_7", subject: "The printer is on fire", state: "open" })),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, () =>
        HttpResponse.json(message({ id: "msg_7", ticketId: "tkt_7", body: "Any news?" }), {
          status: 201,
        }),
      ),
      threads({
        tkt_1: [message({ id: "msg_1", ticketId: "tkt_1", body: "It was on fire." })],
        tkt_7: [message({ id: "msg_7", ticketId: "tkt_7", body: "Any news?" })],
      }),
    );

    renderPortal(store);
    await open(user, /the printer is on fire/i);

    await user.type(screen.getByLabelText("Reply"), "Any news?");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    const conversation = await screen.findByRole("list", { name: /conversation/i });
    expect(await within(conversation).findByText("Any news?")).toBeVisible();
  });

  /**
   * The Message landed; the read that would say where it landed did not. Saying
   * "that failed" would be false, and would invite the Contact to send the same
   * thing again — so it is reported as sent, and what was typed is let go.
   */
  it("does not offer a resend when the reply landed but could not be followed", async () => {
    const user = userEvent.setup();

    server.use(
      listing(ticket({ id: "tkt_1", subject: "The printer is on fire", state: "closed" })),
      // Nothing answers `GET /portal/tickets/tkt_2`.
      reading(),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, () =>
        HttpResponse.json(
          message({ id: "msg_2", ticketId: "tkt_2", body: "It is on fire again." }),
          { status: 201 },
        ),
      ),
      threads({ tkt_1: [message({ id: "msg_1", ticketId: "tkt_1", body: "It was on fire." })] }),
    );

    renderPortal(store);
    await open(user, /the printer is on fire/i);

    const box = screen.getByLabelText("Reply");
    await user.type(box, "It is on fire again.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByText(/was sent and opened a new ticket/i)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(box).toHaveValue("");
  });

  it("reads a chain of linked Tickets as one continuous history", async () => {
    const user = userEvent.setup();

    server.use(
      listing(ticket({ id: "tkt_1", subject: "The printer is on fire", state: "closed" })),
      reading(ticket({ id: "tkt_2", subject: "The printer is on fire", state: "open" })),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, () =>
        HttpResponse.json(
          message({ id: "msg_3", ticketId: "tkt_2", body: "It is on fire again." }),
          { status: 201 },
        ),
      ),
      threads({
        tkt_1: [
          message({ id: "msg_1", ticketId: "tkt_1", body: "It was on fire." }),
          message({
            id: "msg_2",
            ticketId: "tkt_1",
            body: "We put it out.",
            authorKind: "user",
            authorId: "usr_1",
          }),
        ],
        tkt_2: [message({ id: "msg_3", ticketId: "tkt_2", body: "It is on fire again." })],
      }),
    );

    renderPortal(store);
    await open(user, /the printer is on fire/i);

    await user.type(screen.getByLabelText("Reply"), "It is on fire again.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    const conversation = await screen.findByRole("list", { name: /conversation/i });
    await within(conversation).findByText("It is on fire again.");
    await within(conversation).findByText("It was on fire.");

    // One list, in order: what the earlier Ticket was and what became of it,
    // everything said on it, then everything said since.
    const rows = within(conversation)
      .getAllByRole("listitem")
      .map((row) => row.textContent ?? "");

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatch(/earlier in this conversation/i);
    expect(rows[0]).toMatch(/closed/i);
    expect(rows[1]).toContain("It was on fire.");
    expect(rows[2]).toContain("We put it out.");
    expect(rows[3]).toContain("It is on fire again.");
  });

  /**
   * A reply reopens a `pending` or `resolved` Ticket. The reader is looking
   * straight at the state that changed, so it is re-read rather than left as it
   * was when the list handed it over.
   */
  it("shows the state the Ticket is in after the reply, not before it", async () => {
    const user = userEvent.setup();

    server.use(
      listing(ticket({ id: "tkt_1", state: "resolved" })),
      reading(ticket({ id: "tkt_1", state: "open" })),
      threads({ tkt_1: [message({ id: "msg_1", ticketId: "tkt_1", body: "It is on fire." })] }),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, () =>
        HttpResponse.json(message({ id: "msg_2", ticketId: "tkt_1" }), { status: 201 }),
      ),
    );

    renderPortal(store);
    await open(user, /the printer is on fire/i);
    expect(screen.getByText(/^Resolved ·/)).toBeVisible();

    await user.type(screen.getByLabelText("Reply"), "It is still on fire.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByText(/^Open ·/)).toBeVisible();
  });

  /**
   * The earlier half of a conversation is worth most exactly when this Ticket's
   * own thread is missing, so it must not be rendered through the same
   * collection — a refused read here would take the whole history with it.
   */
  it("keeps the earlier history when the current Ticket's thread cannot be read", async () => {
    const user = userEvent.setup();
    server.use(
      listing(ticket({ id: "tkt_1", subject: "The printer is on fire", state: "closed" })),
      reading(ticket({ id: "tkt_2", subject: "The printer is on fire", state: "open" })),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, () =>
        HttpResponse.json(message({ id: "msg_2", ticketId: "tkt_2" }), { status: 201 }),
      ),
      http.get(`${baseUrl}/portal/tickets/:id/messages`, ({ params }) =>
        params.id === "tkt_2"
          ? HttpResponse.json(
              { error: { code: "internal_error", message: "boom" } },
              { status: 500 },
            )
          : HttpResponse.json({
              data: [message({ id: "msg_1", ticketId: "tkt_1", body: "It was on fire." })],
              nextCursor: null,
            }),
      ),
    );

    renderPortal(store);
    await open(user, /the printer is on fire/i);

    await user.type(screen.getByLabelText("Reply"), "It is on fire again.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    const conversation = await screen.findByRole("list", { name: /conversation/i });
    expect(await within(conversation).findByText("It was on fire.")).toBeVisible();
    expect(within(conversation).getByRole("alert")).toBeVisible();
  });
});

describe("writing by keyboard and by screen reader", () => {
  it("opens a Ticket without a mouse", async () => {
    const user = userEvent.setup();

    server.use(
      listing(),
      http.post(`${baseUrl}/portal/tickets`, () =>
        HttpResponse.json(ticket({ id: "tkt_9", subject: "My invoice is wrong" }), { status: 201 }),
      ),
      reading(ticket({ id: "tkt_9", subject: "My invoice is wrong" })),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, () =>
        HttpResponse.json(message({ id: "msg_9", ticketId: "tkt_9" }), { status: 201 }),
      ),
      threads({
        tkt_9: [message({ id: "msg_9", ticketId: "tkt_9", body: "You billed me twice." })],
      }),
    );

    renderPortal(store);
    await screen.findByRole("button", { name: /open a ticket/i });

    await user.tab(); // Sign out
    await user.tab(); // Theme
    await user.tab();
    expect(screen.getByRole("button", { name: /open a ticket/i })).toHaveFocus();
    await user.keyboard("{Enter}");

    // The list this replaced took the focused element with it, so the form
    // announces itself rather than dropping focus at the top of the document.
    expect(await screen.findByRole("heading", { name: /open a ticket/i })).toBeVisible();
    await user.tab();
    expect(screen.getByRole("button", { name: /all tickets/i })).toHaveFocus();

    await user.tab();
    await user.keyboard("My invoice is wrong");
    await user.tab();
    await user.keyboard("You billed me twice.");
    await user.tab();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("heading", { name: "My invoice is wrong" })).toBeVisible();
  });

  it("says a refused reply was refused, and keeps what was typed", async () => {
    const user = userEvent.setup();

    server.use(
      listing(ticket({ id: "tkt_1", state: "open" })),
      threads({ tkt_1: [message({ id: "msg_1", ticketId: "tkt_1", body: "It is on fire." })] }),
      http.post(`${baseUrl}/portal/tickets/:id/messages`, () =>
        HttpResponse.json({ error: { code: "internal_error", message: "boom" } }, { status: 500 }),
      ),
    );

    renderPortal(store);
    await user.click(await screen.findByRole("button", { name: /the printer is on fire/i }));
    await screen.findByRole("list", { name: /conversation/i });

    const box = screen.getByLabelText("Reply");
    await user.type(box, "It is still on fire.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByRole("alert")).toBeVisible();
    // Nothing was sent, so nothing is thrown away — the Contact can try again
    // without retyping.
    expect(box).toHaveValue("It is still on fire.");
  });
});
