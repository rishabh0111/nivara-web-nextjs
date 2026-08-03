/**
 * Saying something on a Ticket, and finding out where it went.
 *
 * Written once because two Surfaces do it — a Contact on the Portal and a
 * Visitor on the Widget — and the API answers both the same way. A reply moves
 * the Ticket it lands on: a `pending` or `resolved` one reopens, and a `closed`
 * one is terminal and is not revived, so the reply opens a **new linked Ticket**
 * and becomes its first Message. Which Ticket it landed on is read off the
 * answer and never predicted from the state in hand.
 *
 * The protocol is small and the mistakes in it are not, which is why it is not
 * two copies. Sending and then reading back is two requests, and the second one
 * can fail on its own — leaving a Message that landed somewhere this client
 * cannot name. That is not a failure and must not be reported as one.
 *
 * What is deliberately not here is what either Surface does about it. Which
 * caches to invalidate, whether to follow the reader to the Ticket it moved to,
 * and what to say afterwards are each Surface's business.
 */
import type { ApiResult } from "@/api/client";
import type { ApiFailure } from "@/api/errors";

import type { Message } from "./message";
import type { Ticket } from "./ticket";

/**
 * What became of a reply.
 *
 * Three outcomes, not two, because "it was not sent" and "it was sent and this
 * client cannot say where it went" are opposite instructions to whoever asked.
 * One means try again; the other means do not, on pain of saying the same thing
 * twice. Collapsing them into a failure is how somebody posts a duplicate.
 *
 * `landedOn: undefined` therefore only ever means the reply moved: where it
 * stayed put, the Ticket in hand still names the right one and is handed back.
 */
export type ReplyOutcome =
  | { sent: false; failure: ApiFailure }
  | { sent: true; landedOn: Ticket }
  | { sent: true; landedOn: undefined };

/** The two reads a reply needs, as either Surface's own client offers them. */
export type RepliableTickets = {
  reply(ticketId: string, body: string): Promise<ApiResult<Message>>;
  one(ticketId: string): Promise<ApiResult<Ticket>>;
};

export async function sendReply(
  api: RepliableTickets,
  ticket: Ticket,
  body: string,
): Promise<ReplyOutcome> {
  const sent = await api.reply(ticket.id, body);
  if (!sent.ok) return { sent: false, failure: sent.failure };

  const landedElsewhere = sent.value.ticketId !== ticket.id;

  // Read back rather than patch. Even when the reply stayed put, the Ticket in
  // hand was read before this write and its state may have moved underneath it
  // — and the reader is looking straight at that state.
  const landed = await api.one(sent.value.ticketId);
  if (landed.ok) return { sent: true, landedOn: landed.value };

  // The read back failed, but the Message did not. Where the reply stayed put,
  // the Ticket in hand still names the right one and only its summary is stale;
  // where it moved, there is nothing truthful to show, and saying so is better
  // than sending the reader somewhere their message is not.
  return landedElsewhere ? { sent: true, landedOn: undefined } : { sent: true, landedOn: ticket };
}
