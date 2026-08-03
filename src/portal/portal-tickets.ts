/**
 * What a Contact can do with their Tickets on the Portal.
 *
 * Nothing here filters by identity, and nothing should: the API returns a
 * Contact only their own Tickets whichever endpoint asked, by row-level
 * security rather than by a `contactId` this application remembers to send.
 * Another Contact's Ticket is not excluded from the page — in this context it
 * does not exist.
 *
 * Each read answers one page. Following the cursor is the query cache's job,
 * and the interface offers "load more" rather than a count the API does not
 * return.
 */
import type { ApiResult, Page } from "@/api/client";
import type { Message } from "@/tickets/message";
import type { SessionClient } from "@/session/session-client";
import type { Ticket } from "@/tickets/ticket";

export type PortalTickets = {
  /** One page of the Tickets this Contact has raised, most recently updated first. */
  list(cursor?: string): Promise<ApiResult<Page<Ticket>>>;
  /** One Ticket by id, for one the Portal holds an id for but no record of. */
  one(ticketId: string): Promise<ApiResult<Ticket>>;
  /** One page of the customer-visible thread on one Ticket, oldest first. */
  thread(ticketId: string, cursor?: string): Promise<ApiResult<Page<Message>>>;
  /**
   * Opens a Ticket. Subject only: the requester comes from the credential, and
   * state, priority and source are the API's to decide.
   */
  open(subject: string): Promise<ApiResult<Ticket>>;
  /**
   * Says something on a Ticket.
   *
   * The Message that comes back may belong to a *different* Ticket than the one
   * addressed: a reply moves the Ticket it lands on, and `closed` is terminal,
   * so replying there opens a new linked Ticket instead of reviving it. Read
   * `ticketId` off the answer. Nothing above this may assume it matches.
   */
  reply(ticketId: string, body: string): Promise<ApiResult<Message>>;
};

export function createPortalTickets(session: SessionClient): PortalTickets {
  return {
    list(cursor) {
      // Most recently updated first, because the question the list answers is
      // "has anyone picked this up", and that is a fact about the last change.
      return session.page("/portal/tickets", "get", { query: { sort: "-updatedAt", cursor } });
    },

    one(ticketId) {
      return session.resource("/portal/tickets/{id}", "get", { params: { id: ticketId } });
    },

    thread(ticketId, cursor) {
      // The API defaults to newest first, which is where the work is for staff.
      // A conversation is read downwards, so this asks for the other order
      // rather than reversing what arrived and hoping the page boundaries line
      // up.
      return session.page("/portal/tickets/{id}/messages", "get", {
        params: { id: ticketId },
        query: { sort: "createdAt", cursor },
      });
    },

    open(subject) {
      return session.resource("/portal/tickets", "post", { body: { subject } });
    },

    reply(ticketId, body) {
      return session.resource("/portal/tickets/{id}/messages", "post", {
        params: { id: ticketId },
        body: { body },
      });
    },
  };
}
