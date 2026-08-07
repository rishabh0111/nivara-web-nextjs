/**
 * What a Visitor can do from the Widget.
 *
 * Five routes, all under `/widget`, and that is the whole of the Surface. There
 * is no staff operation to reach from here — not because the interface hides
 * one, but because this module cannot name one: a Ticket's state, its priority,
 * its assignee and its internal notes have no `/widget` route at all. Anything
 * raised through these carries Source `widget`, stamped by the API from the
 * credential rather than claimed by the request, which is why nothing here
 * sends one.
 *
 * Scoping is not this application's job and nothing here filters by identity.
 * A session that has not written anything has no Contact yet, and the API
 * answers it an empty page rather than creating one — asking does not make a
 * Visitor into a Contact.
 */
import type { ApiResult, Page } from "@/api/client";
import type { SessionClient } from "@/session/session-client";
import type { Message } from "@/tickets/message";
import type { RepliableTickets } from "@/tickets/reply";
import type { Ticket } from "@/tickets/ticket";

export type WidgetTickets = RepliableTickets & {
  /** One page of this session's Tickets, most recently updated first. */
  list(cursor?: string): Promise<ApiResult<Page<Ticket>>>;
  one(ticketId: string): Promise<ApiResult<Ticket>>;
  /** One page of one Ticket's conversation, **newest first**. */
  thread(ticketId: string, cursor?: string): Promise<ApiResult<Page<Message>>>;
  /**
   * Opens a Ticket. Subject only — state, priority and Source are the API's to
   * decide, and this is the write that makes the Visitor's Contact exist.
   */
  open(subject: string): Promise<ApiResult<Ticket>>;
  reply(ticketId: string, body: string): Promise<ApiResult<Message>>;
};

export function createWidgetTickets(session: SessionClient): WidgetTickets {
  return {
    list(cursor) {
      // Most recently updated first, because a Visitor coming back is looking
      // for the conversation they were just having, not the first one they
      // ever started.
      return session.page("/widget/tickets", "get", { query: { sort: "-updatedAt", cursor } });
    },

    one(ticketId) {
      return session.resource("/widget/tickets/{id}", "get", { params: { id: ticketId } });
    },

    thread(ticketId, cursor) {
      /*
        Newest first — the API's own default, and the opposite of what the
        Portal asks for.

        A chat opens at the bottom. A Visitor returning to a long conversation
        wants the last thing said, and paging forwards from the oldest Message
        would show them the beginning of a conversation they have already read
        and make them page to catch up. So the pages walk *backwards* in time
        and the reader is offered earlier messages above, which is the affordance
        a chat has.

        The rendering reverses what arrives, which is safe precisely because of
        the order asked for: pages of a descending sort, concatenated and then
        reversed whole, are the same conversation in ascending order however the
        page boundaries fall. Reversing an *ascending* read page by page is the
        thing that does not survive them, and is what the Portal's comment
        refuses.
      */
      return session.page("/widget/tickets/{id}/messages", "get", {
        params: { id: ticketId },
        query: { sort: "-createdAt", cursor },
      });
    },

    open(subject) {
      return session.resource("/widget/tickets", "post", { body: { subject } });
    },

    reply(ticketId, body) {
      return session.resource("/widget/tickets/{id}/messages", "post", {
        params: { id: ticketId },
        body: { body },
      });
    },
  };
}
