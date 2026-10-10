"use client";

/**
 * What the AI did with a set of tickets: one cell per ticket, lit in its
 * ruling's hue, and the three counts beside them.
 *
 * Each cell reads its own ticket's ruling when it comes on screen, through the
 * same reader the queue rows use (same cache, same four-at-a-time limit), so
 * the counts fill in as cells are read and say how many are still to read
 * rather than guessing. A portal or Slack ticket has no AI turn and stays an
 * empty cell.
 */
import { useRef } from "react";

import { RULING_OUTCOMES, RULING_SOURCE, RULINGS, type Ruling } from "@/tickets/ruling";
import type { Ticket } from "@/tickets/ticket";
import { useSeenOnScreen } from "@/ui/viewport";

import { useAiRuling, useReadRulings } from "./use-ai-ruling";

export const RULING_FILL: Record<Ruling, string> = {
  answer: "bg-go",
  clarify: "bg-ask",
  escalate: "bg-accent",
};

export function RulingCells({
  tickets,
  more,
  label,
}: {
  tickets: readonly Ticket[];
  /** Whether there are tickets beyond these, so the caption says "the first". */
  more: boolean;
  label: string;
}) {
  const read = useReadRulings(tickets);
  const counts: Record<Ruling, number> = { answer: 0, clarify: 0, escalate: 0 };
  let unread = 0;
  tickets.forEach((ticket, index) => {
    const ruling = read[index];
    if (ruling) counts[ruling] += 1;
    else if (ruling === undefined && ticket.source === "widget") unread += 1;
  });

  return (
    <figure className="min-w-0 space-y-3">
      <ul aria-label={label} className="flex flex-wrap gap-1">
        {tickets.map((ticket) => (
          <Cell key={ticket.id} ticket={ticket} />
        ))}
      </ul>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {RULINGS.map((ruling) => (
          <span key={ruling} className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className={`block size-2.5 rounded-[2px] ${RULING_FILL[ruling]}`} />
            <span className="num font-medium">{counts[ruling]}</span>
            {RULING_OUTCOMES[ruling].toLowerCase()}
          </span>
        ))}
        <span className="text-[0.8125rem] text-ink-muted">
          of {more ? "the first " : ""}
          {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
          {unread > 0 ? `, ${unread} still to read` : ""}. {RULING_SOURCE}.
        </span>
      </figcaption>
    </figure>
  );
}

function Cell({ ticket }: { ticket: Ticket }) {
  const cell = useRef<HTMLLIElement>(null);
  const seen = useSeenOnScreen(cell);
  const { ruling, reading } = useAiRuling(ticket, seen);

  return (
    <li
      ref={cell}
      title={`${ticket.subject}: ${ruling ? RULING_OUTCOMES[ruling] : reading ? "reading" : "no AI ruling"}`}
      className={`block size-4 rounded-[3px] ${
        ruling ? RULING_FILL[ruling] : reading ? "animate-sheen bg-raised" : "bg-sunken"
      }`}
    >
      <span className="sr-only">
        {ticket.subject}: {ruling ? RULING_OUTCOMES[ruling] : "no AI ruling"}
      </span>
    </li>
  );
}
