/**
 * Which live events could change what is in a queue, or where it sits in one.
 *
 * The question is deliberately about the *Ticket* rather than about the slice on
 * screen. Whether a change matters to a filtered, sorted, cursor-paginated
 * window is exactly what no client can work out — that is ADR-0002's whole
 * point — so this cannot be sharpened by looking at the filters without becoming
 * the local guess it exists to avoid. It answers the one question that can be
 * answered from an envelope alone: did a Ticket change.
 *
 * The three Ticket events say yes. Every one of them carries a snapshot whose
 * state, priority, assignee, source or timestamps may differ from what the
 * server matched and ordered on when it answered — and a Ticket that was created
 * may belong in the slice without anything on screen having changed at all.
 *
 * A Message and a Note say no, and this is the line worth defending. Both are
 * rows in a Ticket's thread; neither is a fact the queue filters or sorts on.
 * The tempting objection is that a reply surely bumps the Ticket's `updatedAt`,
 * which the queue can be ordered by — but whether it does is the API's rule, not
 * this client's to assume, and where the API does consider the Ticket changed it
 * says so with `ticket.updated`. Reading a bump into a Message would tell a
 * reader on a busy tenant that their queue had been overtaken on every reply,
 * most of them for a list that did not move — and something said that often and
 * wrongly is something nobody reads.
 *
 * The two notification events say no because nothing about the Ticket differs
 * afterwards. They are announced instead, and that is all they are for.
 */
import { noCaseFor, type RealtimeEnvelope } from "@/realtime/envelope";

export function changesTheQueue(envelope: RealtimeEnvelope): boolean {
  switch (envelope.event) {
    case "ticket.created":
    case "ticket.updated":
    case "ticket.assigned":
      return true;

    case "message.created":
    case "note.created":
    case "ticket.sla.breached":
    case "ticket.integration.failed":
      return false;

    default:
      return noCaseFor(envelope) ?? false;
  }
}
