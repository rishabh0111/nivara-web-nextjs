/**
 * The live events that report something happened without changing anything.
 *
 * An SLA breach and an integration failure leave the Ticket exactly as it was —
 * same state, same priority, same assignee — so neither half of ADR-0002's rule
 * reaches them. There is nothing to append and nothing to invalidate, and a view
 * that diffs a snapshot renders nothing at all. They are read into words here,
 * and shown as events in their own right, because the alternative is that a
 * delivery failure the customer never heard about is also one nobody here hears
 * about.
 *
 * Reading them is a pure function of the envelope, kept apart from where they
 * are held so that the wording is one thing and the log is another.
 */
import { noCaseFor, type RealtimeEnvelope, type SlaBreach } from "@/realtime/envelope";

export type LiveNotice = {
  /**
   * The event's own identity, and deliberately not the Room and sequence number
   * it arrived under.
   *
   * The same event delivered into two Rooms carries two unrelated numbers, and
   * both envelopes are the one thing that happened — so the log is keyed by what
   * the event *is*, and raising it twice adds it once. Every field in it is
   * something the server decided about the event rather than about the delivery,
   * which is what makes the two agree.
   */
  id: string;
  /** When it happened, by the server's account, machine-readable. */
  at: string;
  /** What happened, in the words a User reads. */
  what: string;
};

/**
 * The two timers the API runs. A `Record` over the union, so a third one added
 * to the contract is a compile error rather than a notice reading `undefined`.
 */
const TIMER_LABELS: Record<SlaBreach["timer"], string> = {
  first_response: "first response",
  resolution: "resolution",
};

/**
 * What this envelope is worth telling a User about, if anything.
 *
 * Every event the contract defines is named, including the five that are
 * announced by nothing — an event added to the contract and not decided about
 * here is a compile error rather than one that silently reports nothing.
 */
export function noticeFor(envelope: RealtimeEnvelope): LiveNotice | undefined {
  switch (envelope.event) {
    case "ticket.sla.breached": {
      const { ticketId, timer, breachedAt } = envelope.data;

      return {
        // The latch value rather than the emission time: the two differ by the
        // sweep, and it is the breach that is being identified, not the sweep
        // that noticed it.
        id: `sla:${ticketId}:${timer}:${breachedAt}`,
        at: breachedAt,
        what: `SLA breached on ticket ${ticketId}: the ${TIMER_LABELS[timer]} timer ran out.`,
      };
    }

    case "ticket.integration.failed": {
      const { ticketId, messageId, source, target, error } = envelope.data;

      return {
        // An adapter gives up on one message once, so what it gave up on is
        // what identifies it. The time is not part of that — the same failure
        // announced into two Rooms is one failure.
        id: `integration:${messageId}:${source}:${target}`,
        at: envelope.ts,
        what:
          `A reply on ticket ${ticketId} was never delivered. ` +
          `${source} gave up trying to reach ${target}. It said: ${error}`,
      };
    }

    // These change something, and are applied rather than announced. Whoever is
    // reading the thing they changed shows the change; announcing it as well
    // would be telling a reader about what is already in front of them.
    case "ticket.created":
    case "ticket.updated":
    case "ticket.assigned":
    case "message.created":
    case "note.created":
      return undefined;

    default:
      return noCaseFor(envelope);
  }
}
