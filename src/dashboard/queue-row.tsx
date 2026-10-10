"use client";

/**
 * One Ticket as a queue row: what the AI did, what it is, who has it now.
 *
 * Read in the order a User triages: the ruling first (the AI answered this,
 * asked about it, or handed it over), then the subject, then whether a person
 * is what it is waiting on. The subject is still the first thing in the
 * markup, so the row is announced by what it is about; the grid places the
 * ruling before it on screen — at the start of the row on a wide screen, on
 * the first line of the card on a phone.
 *
 * The Portal's list keeps `TicketRow`: a Contact has no use for who holds
 * their Ticket inside the desk, and no ruling to read.
 */
import { memo, useRef, useState } from "react";

import { describeFailure } from "@/api/errors";
import { MiniRuling } from "@/tickets/ruling-strip";
import {
  TICKET_PRIORITY_LABELS,
  TICKET_SOURCE_LABELS,
  TICKET_STATE_LABELS,
  type Ticket,
  type TicketPriority,
} from "@/tickets/ticket";
import { timeAgo } from "@/tickets/time-ago";
import { useToaster } from "@/ui/toast";
import { useSeenOnScreen } from "@/ui/viewport";

import { HOLDER_LABELS, holderOf, type Holder } from "./holder";
import { useAiRuling } from "./use-ai-ruling";
import { useTicketWrites } from "./use-ticket-writes";

/**
 * The row's grid, shared with the column header above the list so the two
 * cannot drift apart. On a phone: the ruling and the holder on the first line,
 * the subject on the second, the details on the third.
 */
export const QUEUE_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 md:grid-cols-[9.5rem_minmax(0,1fr)_9rem_8rem] md:items-center md:gap-y-0.5";

/** The width of the trailing action column, shared with the header. */
export const QUEUE_ACTION_COLUMN = "md:w-[8.5rem]";

/** Who has it, in ink. Only the fact that nobody does is set apart, by weight and a pill. */
const HOLDER_INK: Record<Holder, string> = {
  "needs-person": "chip chip-open",
  you: "font-medium text-ink",
  colleague: "text-ink-muted",
  "on-hold": "text-ink-muted",
  finished: "text-ink-muted",
};

/** Urgency as a mark beside its word, never instead of it. */
const PRIORITY_MARK: Record<TicketPriority, string> = {
  low: "bg-line-strong",
  normal: "bg-ink-faint",
  high: "bg-ink",
  urgent: "bg-danger",
};

export const QueueRow = memo(function QueueRow({
  ticket,
  me,
}: {
  ticket: Ticket;
  /** The signed-in User's id, so a ticket of theirs says "With you". */
  me: string | undefined;
}) {
  const mark = useRef<HTMLSpanElement>(null);
  const seen = useSeenOnScreen(mark);
  const { ruling, reading } = useAiRuling(ticket, seen);
  const holder = holderOf(ticket, me);

  return (
    <>
      {/* The subject first in the markup, so the row is announced by what it
          is about. */}
      <span className="col-span-2 col-start-1 row-start-2 min-w-0 font-medium break-words text-ink md:col-span-1 md:col-start-2 md:row-start-1 md:truncate">
        {ticket.subject}
      </span>

      <span className="col-span-2 col-start-1 row-start-3 flex min-w-0 flex-wrap items-center gap-x-2 text-[0.8125rem] text-ink-muted md:col-span-1 md:col-start-2 md:row-start-2">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`size-1.5 shrink-0 rounded-full ${PRIORITY_MARK[ticket.priority]}`}
          />
          <span className={ticket.priority === "urgent" ? "font-medium text-ink" : undefined}>
            {TICKET_PRIORITY_LABELS[ticket.priority]}
          </span>
        </span>
        <span aria-hidden="true">·</span>
        <span>via {TICKET_SOURCE_LABELS[ticket.source]}</span>
        <span aria-hidden="true">·</span>
        <span>{TICKET_STATE_LABELS[ticket.state]}</span>
        {/* On a phone the time joins this line rather than taking a column. */}
        <span aria-hidden="true" className="md:hidden">
          ·
        </span>
        <span className="md:hidden">
          updated <time dateTime={ticket.updatedAt}>{timeAgo(ticket.updatedAt)}</time>
        </span>
      </span>

      <span
        ref={mark}
        className="col-start-1 row-start-1 text-[0.8125rem] md:col-start-1 md:row-span-2 md:row-start-1"
      >
        <MiniRuling
          ruling={ruling}
          reading={reading}
          none={ticket.source === "widget" ? "No AI ruling" : "No AI turn"}
        />
      </span>

      <span className="col-start-2 row-start-1 justify-self-end text-[0.8125rem] md:col-start-3 md:row-span-2 md:row-start-1 md:justify-self-start">
        <span className={HOLDER_INK[holder]}>{HOLDER_LABELS[holder]}</span>
      </span>

      {/* The instant, machine-readable, beside the reading of it. */}
      <span className="hidden text-right text-[0.8125rem] text-ink-muted md:col-start-4 md:row-span-2 md:row-start-1 md:block">
        <span className="sr-only">updated </span>
        <time dateTime={ticket.updatedAt}>{timeAgo(ticket.updatedAt)}</time>
      </span>
    </>
  );
});

/**
 * "Assign to me", on a row nobody has claimed.
 *
 * Beside the row rather than inside it, because the row is itself a button and
 * a button cannot hold another. A real write, made only when pressed.
 */
export function AssignToMe({ ticket, me }: { ticket: Ticket; me: string }) {
  const writes = useTicketWrites(ticket.id);
  const toaster = useToaster();
  const [writing, setWriting] = useState(false);

  return (
    <button
      type="button"
      disabled={writing}
      // Named for the act alone: it sits in the Ticket's own list item, which
      // is the context, and a name repeating the subject would make the row
      // and its action two controls answering to the same words.
      onClick={async () => {
        setWriting(true);
        const written = await writes.setAssignee(me);
        setWriting(false);
        if (written.ok) toaster.show("outcome", "This ticket is now yours.");
        else toaster.show("failure", describeFailure(written.failure));
      }}
      className="btn btn-quiet !min-h-8 px-2.5 text-[0.8125rem]"
    >
      {writing ? "Assigning…" : "Assign to me"}
    </button>
  );
}
