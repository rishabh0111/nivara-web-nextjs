/**
 * What a Ticket is, in one line: its state, how urgent it is, and when it last
 * changed. Enough to find the one you care about and to know whether anyone has
 * picked it up.
 */
import { TICKET_PRIORITY_LABELS, TICKET_STATE_LABELS, type Ticket } from "./ticket";
import { timeAgo } from "./time-ago";

export function TicketSummary({ ticket }: { ticket: Ticket }) {
  return (
    <>
      {TICKET_STATE_LABELS[ticket.state]} · {TICKET_PRIORITY_LABELS[ticket.priority]} priority ·
      updated{" "}
      {/* The instant, machine-readable, beside the reading of it — "3 hours ago"
          is only true for as long as the page has been open. */}
      <time dateTime={ticket.updatedAt}>{timeAgo(ticket.updatedAt)}</time>
    </>
  );
}
