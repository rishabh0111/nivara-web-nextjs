/**
 * A Ticket as one entry in a list, for the two Surfaces that show a list of
 * them.
 *
 * The Portal's list and the Dashboard's queue were the same three lines of
 * markup twice, and they are the same *reading* twice: which ticket is this,
 * what state is it in, how urgent, and when did it last move. Written once so
 * the two cannot drift into showing a Contact and a User different things about
 * the same record.
 *
 * What this does not do is decide what happens when it is pressed — it renders
 * inside whatever control the caller wraps it in. The queue and the Portal
 * disagree about where a Ticket opens, and that is the caller's business.
 */
import { memo } from "react";

import { TICKET_PRIORITY_LABELS, TICKET_STATE_LABELS, type Ticket } from "./ticket";
import type { TicketPriority, TicketState } from "./ticket";
import { timeAgo } from "./time-ago";

/**
 * What each state looks like, and why these and not others.
 *
 * Open is the accent because it is the work; resolved is the settled green
 * because it is finished. Pending wears the urgent colour on purpose — it is
 * the state that means somebody is waiting on us, which is the only state a
 * desk should feel bad about leaving alone. On hold and closed are deliberately
 * grey: neither is a call to action, and colouring them would spend attention
 * on rows nobody needs to look at.
 */
export const TICKET_STATE_CHIP: Record<TicketState, string> = {
  open: "chip-accent",
  pending: "chip-urgent",
  on_hold: "chip-neutral",
  resolved: "chip-calm",
  closed: "chip-neutral",
};

/** The dot beside the priority word, never instead of it. */
const PRIORITY_DOT: Record<TicketPriority, string> = {
  low: "bg-ink-faint",
  normal: "bg-ink-muted",
  high: "bg-urgent",
  urgent: "bg-danger",
};

/**
 * The caller puts this on its own control, because this renders as a fragment.
 *
 * Two rows and two columns: the subject and the state chip share the top line,
 * and the meta runs underneath the subject. Laid out by grid placement rather
 * than by nesting, so the subject stays the first thing in the markup — it is
 * the first thing read aloud, and the row is announced subject-first rather
 * than opening with a status nobody asked for yet.
 */
export const TICKET_ROW_LAYOUT = "grid grid-cols-[1fr_auto] items-start gap-x-3";

/**
 * Memoised, because the queue re-renders more often than its rows change.
 *
 * Realtime envelopes arrive continuously and the screen above this holds the
 * slice, the freshness flag and the subject filter — every one of which
 * re-renders the list. A Ticket comes out of the query cache with a stable
 * identity until the record itself changes, so the comparison is a pointer
 * check and the rows that did not change do no work.
 */
export const TicketRow = memo(function TicketRow({ ticket }: { ticket: Ticket }) {
  return (
    <>
      <span className="col-start-1 row-start-1 truncate font-semibold tracking-tight">
        {ticket.subject}
      </span>

      <span className="col-start-1 row-start-2 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        {/*
            The dot is decorative and the word is not. Priority is carried by
            the label either way — a reader who cannot separate the amber dot
            from the red one still reads "Urgent", which is the whole point of
            never letting colour be the only thing that says it.
          */}
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[ticket.priority]}`}
          />
          {TICKET_PRIORITY_LABELS[ticket.priority]}
        </span>

        <span aria-hidden="true" className="text-ink-faint">
          ·
        </span>

        {/* The instant, machine-readable, beside the reading of it — "3 hours
              ago" is only true for as long as the page has been open. */}
        <span>
          updated <time dateTime={ticket.updatedAt}>{timeAgo(ticket.updatedAt)}</time>
        </span>
      </span>

      <span className={`chip ${TICKET_STATE_CHIP[ticket.state]} col-start-2 row-start-1 shrink-0`}>
        {TICKET_STATE_LABELS[ticket.state]}
      </span>
    </>
  );
});
