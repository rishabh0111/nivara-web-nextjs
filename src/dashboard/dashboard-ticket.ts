/**
 * One Ticket, as the Dashboard reads it, changes it and answers on it.
 *
 * Four reads, because that is what understanding a Ticket takes: what the
 * customer said, what colleagues said about it, what else this conversation has
 * been called, and what has been done to it. Then five writes, which are the
 * three changes a User can make to a Ticket and the two things they can say on
 * one.
 *
 * The two halves of the conversation are separate calls and not a preference —
 * Messages and Notes are separate tables, and no parameter to either endpoint can
 * reach the other. That is the property that makes an internal Note safe, and it
 * is why interleaving them is this application's job rather than the server's.
 *
 * Every write here is one endpoint doing one thing, in the API's own shape.
 * Nothing is batched and nothing is inferred: state, priority and assignee are
 * three `PATCH`es because they are three independent facts, and a client that
 * sent all three because one changed would be reasserting two values it read
 * before somebody else moved them.
 */
import type { ApiResult, Page } from "@/api/client";
import type { SessionClient } from "@/session/session-client";
import type { Message } from "@/tickets/message";
import type { Note } from "@/tickets/note";
import type { Ticket, TicketPriority, TicketState } from "@/tickets/ticket";

import type { AuditEntry } from "./audit-entry";

export type DashboardTicket = {
  /**
   * Every Ticket in the conversation this one belongs to, oldest first.
   *
   * Never paginated, and addressed by whichever Ticket is in hand rather than by
   * the origin of the chain — so this is the whole narrative in one call, and a
   * conversation that has never been closed-and-replied-to is a chain of one
   * rather than a special case to ask about first.
   */
  conversation(ticketId: string): Promise<ApiResult<Page<Ticket>>>;
  /** One page of the customer-visible thread, oldest first. */
  thread(ticketId: string, cursor?: string): Promise<ApiResult<Page<Message>>>;
  /** One page of the internal Notes, oldest first. */
  notes(ticketId: string, cursor?: string): Promise<ApiResult<Page<Note>>>;
  /** One page of the audit timeline, newest first. */
  audit(ticketId: string, cursor?: string): Promise<ApiResult<Page<AuditEntry>>>;
  /** Writes an internal Note. Never reaches the Contact, by table rather than by flag. */
  writeNote(ticketId: string, body: string): Promise<ApiResult<Note>>;
  /**
   * Moves a Ticket to another state, and answers with the Ticket as it now is.
   *
   * An illegal move answers 409, refused by the database rather than by the
   * service — so this asks for the destination and reports what came back
   * rather than checking first. The table the interface offers from is a way of
   * not asking for a refusal, never a way of deciding one will not happen.
   */
  transition(ticketId: string, state: TicketState): Promise<ApiResult<Ticket>>;
  /** Sets a Ticket's urgency. Not a transition — the state is neither read nor moved. */
  setPriority(ticketId: string, priority: TicketPriority): Promise<ApiResult<Ticket>>;
  /**
   * Makes one User responsible for a Ticket, or nobody.
   *
   * `null` is the unassignment rather than a missing argument: there is at most
   * one holder of a Ticket, and "nobody" is a value that holder can take.
   */
  setAssignee(ticketId: string, assigneeId: string | null): Promise<ApiResult<Ticket>>;
  /**
   * Says something the Contact will see, and answers with the Message stored.
   *
   * The Message that comes back names the Ticket it is on, and that is not
   * always the Ticket it was addressed to — a reply moves the Ticket it lands
   * on, and a terminal one it does not land on at all. Reading `ticketId` off
   * the response is how the caller finds out.
   */
  reply(ticketId: string, body: string): Promise<ApiResult<Message>>;
};

export function createDashboardTicket(session: SessionClient): DashboardTicket {
  return {
    conversation(ticketId) {
      return session.page("/tickets/{id}/conversation", "get", { params: { id: ticketId } });
    },

    // Both halves of the conversation are asked for oldest first, and for the
    // same reason: they are merged by `createdAt`, and two collections paged
    // from opposite ends would never line up at a boundary at all.
    thread(ticketId, cursor) {
      return session.page("/tickets/{id}/messages", "get", {
        params: { id: ticketId },
        query: { sort: "createdAt", cursor },
      });
    },

    notes(ticketId, cursor) {
      return session.page("/tickets/{id}/notes", "get", {
        params: { id: ticketId },
        query: { sort: "createdAt", cursor },
      });
    },

    // Newest first — the API's own default, asked for rather than assumed. A log
    // is read for what just happened; a conversation is read for how it started.
    audit(ticketId, cursor) {
      return session.page("/tickets/{id}/audit", "get", {
        params: { id: ticketId },
        query: { sort: "-createdAt", cursor },
      });
    },

    writeNote(ticketId, body) {
      return session.resource("/tickets/{id}/notes", "post", {
        params: { id: ticketId },
        body: { body },
      });
    },

    transition(ticketId, state) {
      return session.resource("/tickets/{id}/state", "patch", {
        params: { id: ticketId },
        body: { state },
      });
    },

    setPriority(ticketId, priority) {
      return session.resource("/tickets/{id}/priority", "patch", {
        params: { id: ticketId },
        body: { priority },
      });
    },

    setAssignee(ticketId, assigneeId) {
      return session.resource("/tickets/{id}/assignee", "patch", {
        params: { id: ticketId },
        body: { assigneeId },
      });
    },

    reply(ticketId, body) {
      return session.resource("/tickets/{id}/messages", "post", {
        params: { id: ticketId },
        body: { body },
      });
    },
  };
}
