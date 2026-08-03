"use client";

import { useEffect, useRef } from "react";

import { TICKET_ROW_LAYOUT, TicketRow } from "@/tickets/ticket-row";
import type { Ticket } from "@/tickets/ticket";
import { CollectionView, LoadMore } from "@/ui/collection-view";

import { usePortalTicketList } from "./use-portal-tickets";

export function TicketList({
  onOpen,
  onOpenNew,
  /** The Ticket just closed, if the reader arrived here by coming back from one. */
  returningFrom,
}: {
  onOpen: (ticket: Ticket) => void;
  onOpenNew: () => void;
  returningFrom?: string;
}) {
  const tickets = usePortalTicketList();

  // Coming back puts the reader where they left, not at the top of the page.
  const returnTo = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    returnTo.current?.focus();
  }, [returningFrom, tickets.isPending]);

  return (
    <div className="space-y-4">
      {/* Outside the collection: asking for help is the reason to be here, and
          it must be reachable when the list is empty, still arriving, or
          refused — which is exactly when a Contact most needs it. */}
      <button type="button" onClick={onOpenNew} className="btn btn-primary">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-4"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Open a ticket
      </button>

      <CollectionView
        collection={tickets}
        waiting="Loading your tickets…"
        empty="You have not raised a ticket yet."
      >
        {(items) => (
          <div className="space-y-4">
            <ul aria-label="Your tickets" className="card divide-y divide-line overflow-hidden">
              {items.map((ticket) => (
                <li key={ticket.id}>
                  {/*
                    A button rather than a row with a handler on it, so the whole
                    entry is one tab stop, one Enter away from opening, and one
                    accessible name — the subject and everything a reader needs
                    to choose between two of them.
                  */}
                  <button
                    type="button"
                    ref={ticket.id === returningFrom ? returnTo : undefined}
                    onClick={() => onOpen(ticket)}
                    className={`${TICKET_ROW_LAYOUT} w-full px-4 py-3.5 text-left transition-colors duration-150 hover:bg-sunken focus-visible:-outline-offset-2`}
                  >
                    <TicketRow ticket={ticket} />
                  </button>
                </li>
              ))}
            </ul>

            <LoadMore
              collection={tickets}
              label="Load more tickets"
              end="That is all of your tickets."
              counted="tickets"
            />
          </div>
        )}
      </CollectionView>
    </div>
  );
}
