/**
 * A fake Nivara Desk holding one conversation, for the tests that open a Ticket.
 *
 * The one thing stubbed is the network — everything above it, the generated
 * client, the middleware, the query cache and the components, runs for real. So
 * this is written as a small API rather than as a bag of canned responses: a
 * write changes what the reads afterwards answer, because that is the property
 * the write tests are about. A handler that accepted a transition and went on
 * serving the old state would let a screen that never updated pass.
 *
 * Shared between the reading tests and the writing tests deliberately. Two
 * descriptions of the same wire is how one of them ends up asserting against a
 * shape the API stopped serving while the other is corrected.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { SetupServer } from "msw/node";

import type { ApiErrorCode } from "@/api/errors";
import type { components } from "@/api/generated/openapi";
import type { SessionStore } from "@/session/store";
import type { Message } from "@/tickets/message";
import type { Note } from "@/tickets/note";
import type { Ticket, TicketPriority, TicketState } from "@/tickets/ticket";
import { message, note, ticket } from "@/tickets/tickets.fixtures";

import type { AuditEntry } from "./audit-entry";
import { baseUrl, principal, renderDashboard } from "./dashboard.fixtures";

/** One write the fake accepted, in the vocabulary of the endpoint that took it. */
export type Written =
  | { kind: "state"; ticketId: string; state: TicketState }
  | { kind: "priority"; ticketId: string; priority: TicketPriority }
  | { kind: "assignee"; ticketId: string; assigneeId: string | null }
  | { kind: "message"; ticketId: string; body: string }
  | { kind: "note"; ticketId: string; body: string };

type WriteKind = Written["kind"];

/** A refusal in the API's own envelope, so the client parses it as the real one. */
export type Refusal = { status: number; code: ApiErrorCode; message: string };

export type TicketWire = {
  /** The chain, oldest first. The last one is the Ticket the reader opens. */
  conversation?: Ticket[];
  messages?: Record<string, Message[]>;
  notes?: Record<string, Note[]>;
  audit?: AuditEntry[];
  /** Serves the thread one message at a time, as a busy Ticket's would arrive. */
  pageThread?: boolean;
  /** Refuses every write of a kind, so a test can watch a refusal reach the screen. */
  refuse?: Partial<Record<WriteKind, Refusal>>;
  /**
   * Where a reply to this Ticket actually lands, when that is not here.
   *
   * The API moves a reply that addressed a terminal Ticket onto a new linked
   * one and says so on the response. The Dashboard reads that rather than
   * predicting it, and this is how a test causes it.
   */
  replyLandsOn?: string;
};

type FakeDesk = {
  /** Every write the API accepted, in the order it accepted them. */
  written: Written[];
  /**
   * Changes a Ticket behind the reader's back, as a colleague working the same
   * Ticket does. What the reads answer afterwards is what the API now says —
   * which is what a test asserting on an envelope's effect has to be able to
   * cause, because authority is the API and never the socket.
   */
  move(ticketId: string, change: Partial<Ticket>): void;
  /** Records something in the audit log, as the API does when a Ticket moves. */
  record(entry: AuditEntry): void;
  /**
   * Adds a Message to a thread, as a colleague answering the customer does.
   *
   * The write lands at the API before the envelope announcing it — which is the
   * order that matters to a test about what a re-read finds.
   */
  say(entry: Message): void;
};

/** The default conversation: one open Ticket, unassigned. */
export const printer = ticket({ id: "tkt_1", subject: "The printer is on fire", state: "open" });

function serveTicket(server: SetupServer, wire: TicketWire = {}): FakeDesk {
  const chain = wire.conversation ?? [printer];
  const tickets = new Map(chain.map((held) => [held.id, held]));
  const messages: Record<string, Message[]> = { ...wire.messages };
  const notes: Record<string, Note[]> = { ...wire.notes };
  const audit: AuditEntry[] = [...(wire.audit ?? [])];
  const written: Written[] = [];

  const held = (ticketId: string) => tickets.get(ticketId) ?? chain[chain.length - 1]!;

  /** The chain in its seeded order, each Ticket as it now stands. */
  const conversation = () => chain.map((seeded) => held(seeded.id));

  const refusal = (kind: WriteKind) => {
    const refused = wire.refuse?.[kind];
    return refused
      ? HttpResponse.json(
          {
            error: { code: refused.code, message: refused.message },
          } satisfies components["schemas"]["ErrorResponse"],
          { status: refused.status },
        )
      : undefined;
  };

  /** Accepts an edit to a Ticket and answers with the Ticket as it now is. */
  const edit = (ticketId: string, change: Partial<Ticket>, record: Written) => {
    const updated = { ...held(ticketId), ...change, updatedAt: "2026-07-03T09:00:00.000Z" };
    tickets.set(ticketId, updated);
    written.push(record);
    return HttpResponse.json(updated);
  };

  server.use(
    http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal())),
    http.get(`${baseUrl}/tickets`, () =>
      HttpResponse.json({ data: [held(printer.id)], nextCursor: null }),
    ),

    // Any Ticket in a chain answers with the same chain, so this does not vary
    // by id — which is the property that lets the view ask from wherever the
    // reader happens to have opened.
    http.get(`${baseUrl}/tickets/:id/conversation`, () =>
      HttpResponse.json({ data: conversation(), nextCursor: null }),
    ),

    http.get(`${baseUrl}/tickets/:id/messages`, ({ params, request }) => {
      const thread = messages[String(params.id)] ?? [];
      if (!wire.pageThread) return HttpResponse.json({ data: thread, nextCursor: null });

      const cursor = new URL(request.url).searchParams.get("cursor");
      return cursor === null
        ? HttpResponse.json({ data: thread.slice(0, 1), nextCursor: "cur_2" })
        : HttpResponse.json({ data: thread.slice(1), nextCursor: null });
    }),

    http.get(`${baseUrl}/tickets/:id/notes`, ({ params }) =>
      HttpResponse.json({ data: notes[String(params.id)] ?? [], nextCursor: null }),
    ),

    http.get(`${baseUrl}/tickets/:id/audit`, () =>
      HttpResponse.json({ data: audit, nextCursor: null }),
    ),

    http.patch(`${baseUrl}/tickets/:id/state`, async ({ params, request }) => {
      const refused = refusal("state");
      if (refused) return refused;

      const { state } = (await request.json()) as { state: TicketState };
      return edit(
        String(params.id),
        { state },
        { kind: "state", ticketId: String(params.id), state },
      );
    }),

    http.patch(`${baseUrl}/tickets/:id/priority`, async ({ params, request }) => {
      const refused = refusal("priority");
      if (refused) return refused;

      const { priority } = (await request.json()) as { priority: TicketPriority };
      return edit(
        String(params.id),
        { priority },
        { kind: "priority", ticketId: String(params.id), priority },
      );
    }),

    http.patch(`${baseUrl}/tickets/:id/assignee`, async ({ params, request }) => {
      const refused = refusal("assignee");
      if (refused) return refused;

      const { assigneeId } = (await request.json()) as { assigneeId: string | null };
      return edit(
        String(params.id),
        { assigneeId },
        { kind: "assignee", ticketId: String(params.id), assigneeId },
      );
    }),

    http.post(`${baseUrl}/tickets/:id/messages`, async ({ params, request }) => {
      const refused = refusal("message");
      if (refused) return refused;

      const { body } = (await request.json()) as { body: string };
      written.push({ kind: "message", ticketId: String(params.id), body });

      // Where the reply moved, it is stored on the Ticket it landed on and the
      // response says so — the addressed Ticket never sees it.
      const landedOn = wire.replyLandsOn ?? String(params.id);
      const stored = message({
        id: `msg_${written.length + 90}`,
        ticketId: landedOn,
        body,
        authorKind: "user",
        authorId: "usr_1",
        createdAt: "2026-07-03T09:00:00.000Z",
      });
      messages[landedOn] = [...(messages[landedOn] ?? []), stored];

      return HttpResponse.json(stored, { status: 201 });
    }),

    http.post(`${baseUrl}/tickets/:id/notes`, async ({ params, request }) => {
      const refused = refusal("note");
      if (refused) return refused;

      const { body } = (await request.json()) as { body: string };
      written.push({ kind: "note", ticketId: String(params.id), body });

      const stored = note({ id: `not_${written.length + 90}`, body });
      notes[String(params.id)] = [...(notes[String(params.id)] ?? []), stored];

      return HttpResponse.json(stored, { status: 201 });
    }),
  );

  return {
    written,
    move: (ticketId, change) => tickets.set(ticketId, { ...held(ticketId), ...change }),
    // Newest first, the order the endpoint serves in.
    record: (entry) => audit.unshift(entry),
    say: (entry) => {
      messages[entry.ticketId] = [...(messages[entry.ticketId] ?? []), entry];
    },
  };
}

/** Stands the whole Dashboard up against the fake and opens the Ticket. */
export async function openTicket(
  server: SetupServer,
  store: SessionStore,
  wire: TicketWire = {},
  /** Where the live connection goes, for a test driving one. */
  realtimeUrl?: string,
) {
  const desk = serveTicket(server, wire);

  const session = renderDashboard(store, realtimeUrl);
  const user = userEvent.setup();

  await user.click(await screen.findByRole("button", { name: /the printer is on fire/i }));
  await screen.findByRole("heading", { name: "The printer is on fire" });

  return { user, session, ...desk };
}
