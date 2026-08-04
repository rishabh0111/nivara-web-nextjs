"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Ticket } from "@/tickets/ticket";
import { TICKET_ROW_LAYOUT, TicketRow } from "@/tickets/ticket-row";
import { CollectionView, LoadMore } from "@/ui/collection-view";
import { WindowedList } from "@/ui/windowed-list";

import { QueueFilters } from "./queue-filters";
import { QueueFreshness } from "./queue-freshness";
import { SubjectFilter } from "./subject-filter";
import { isNarrowed } from "./queue-slice";
import { useQueueSlice } from "./use-queue-slice";
import { useStaffPrincipal } from "./use-staff-principal";
import { useTicketQueue } from "./use-ticket-queue";

/**
 * The tenant's Tickets — the first thing a User sees, because it is the work.
 *
 * Every Ticket in the tenant, in the order the API returns them, for an agent
 * and an admin alike, until the reader narrows it themselves.
 *
 * The slice lives here, above both the controls that edit it and the read that
 * asks for it, so there is one answer to what is on screen and the two cannot
 * disagree. It comes from the URL, which is the only place it can come from
 * that survives a reload — and where the URL names none, it is the whole queue:
 * a Dashboard that opened onto somebody else's filter would be hiding work
 * without saying so.
 *
 * Each slice is its own query. Narrowing asks the cache a question it has not
 * been asked, so the queue says it is loading and then answers — and where the
 * answer is nothing, it says that too, out loud. A narrowing that returns a
 * shorter list still announces only the wait: saying how many arrived would be
 * offering a count of a page as though it were a count of the result.
 */
export function Queue({
  onOpen,
  /** The Ticket just closed, if the reader arrived here by coming back from one. */
  returningFrom,
}: {
  onOpen: (ticket: Ticket) => void;
  returningFrom?: string;
}) {
  const [slice, setSlice] = useQueueSlice();
  const principal = useStaffPrincipal();
  const queue = useTicketQueue(slice);

  // Coming back puts the reader on the Ticket they were reading, not at the top
  // of the page. Opening one moves focus deliberately; a return that did not
  // would be half a round trip — the control that had focus unmounts, and a
  // keyboard reader is dropped to the start of the document having been told
  // nothing.
  const returnTo = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    returnTo.current?.focus();
  }, [returningFrom, queue.isPending]);

  // Held here rather than in the slice, and deliberately not in the URL: the
  // slice is what the *server* was asked for, and this was asked of nobody. A
  // shared link carrying it would promise the recipient a result computed over
  // whatever pages that reader happened to have loaded.
  const [subject, setSubject] = useState("");
  const wanted = subject.trim().toLowerCase();

  const matching = useMemo(
    () =>
      wanted === ""
        ? queue.items
        : queue.items.filter((ticket) => ticket.subject.toLowerCase().includes(wanted)),
    [queue.items, wanted],
  );

  return (
    <div className="space-y-6">
      <QueueFilters slice={slice} onChange={setSlice} principal={principal} />

      <QueueFreshness failed={Boolean(queue.error)} />

      <CollectionView
        collection={queue}
        waiting="Loading tickets…"
        empty={isNarrowed(slice) ? "No tickets match these filters." : "No tickets yet."}
      >
        {() => (
          <div className="space-y-4">
            <SubjectFilter
              value={subject}
              onChange={setSubject}
              loaded={queue.items.length}
              matched={matching.length}
              more={queue.hasMore}
            />

            {matching.length === 0 ? (
              /* Its own sentence, and not the collection's "no tickets match
                 these filters" — that one is about what the server answered,
                 and this is about what a reader typed over the answer. */
              <p
                role="status"
                className="rounded-card border border-dashed border-line-strong bg-sunken px-4 py-8 text-center text-sm leading-relaxed text-ink-muted"
              >
                No loaded ticket has that in its subject.
              </p>
            ) : (
              <WindowedList
                items={matching}
                label="Tickets"
                keyOf={(ticket) => ticket.id}
                // Where the reader was standing, so a row scrolled out of the
                // window is brought back before the focus below reaches for it.
                ensureVisible={matching.findIndex((ticket) => ticket.id === returningFrom)}
              >
                {(ticket) => (
                  /* The whole row, so what a keyboard reaches and what a
                   pointer hits are the same target — and one control per
                   Ticket rather than a link on the subject beside a summary
                   that is not part of it. */
                  <button
                    type="button"
                    ref={ticket.id === returningFrom ? returnTo : undefined}
                    onClick={() => onOpen(ticket)}
                    className={`${TICKET_ROW_LAYOUT} block w-full px-4 py-3.5 text-left transition-colors duration-150 hover:bg-sunken focus-visible:-outline-offset-2`}
                  >
                    <TicketRow ticket={ticket} />
                  </button>
                )}
              </WindowedList>
            )}

            <LoadMore
              collection={queue}
              label="Load more tickets"
              end="That is every ticket."
              counted="tickets"
            />
          </div>
        )}
      </CollectionView>
    </div>
  );
}
