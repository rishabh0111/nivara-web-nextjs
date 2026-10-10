"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { RULING_OUTCOMES, RULING_SOURCE, RULINGS, type Ruling } from "@/tickets/ruling";
import type { Ticket } from "@/tickets/ticket";
import { CollectionView, LoadMore } from "@/ui/collection-view";
import { WindowedList } from "@/ui/windowed-list";

import { needsPerson } from "./holder";
import { QueueFilters } from "./queue-filters";
import { QueueFreshness } from "./queue-freshness";
import { AssignToMe, QUEUE_ACTION_COLUMN, QUEUE_ROW_GRID, QueueRow } from "./queue-row";
import { SubjectFilter } from "./subject-filter";
import { EVERYTHING, isNarrowed, type QueueSlice } from "./queue-slice";
import { useQueueSlice } from "./use-queue-slice";
import { useStaffPrincipal } from "./use-staff-principal";
import { RULING_FILL } from "./ruling-cells";
import { useReadRulings } from "./use-ai-ruling";
import { useTicketQueue } from "./use-ticket-queue";

/**
 * The tenant's Tickets — the first thing a User sees, because it is the work.
 *
 * Every Ticket in the tenant, in the order the API returns them, for an agent
 * and an admin alike, until the reader narrows it themselves.
 *
 * Each row leads with the AI's ruling (answered, asked, handed over) and ends
 * with who has it now, so the two things a desk needs to see at a glance —
 * what the AI already settled, and what is waiting on a person — are read off
 * the list rather than out of a sentence about it. The one sentence there is
 * says how many are waiting, and offers to show only those.
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
    <div className="space-y-5">
      <div className="space-y-4">
      <Waiting
        items={queue.items}
        complete={!queue.isPending && !queue.hasMore}
        shown={!queue.isPending && !queue.error}
        slice={slice}
        onChange={setSlice}
      />

      {queue.items.length > 0 ? <Tally tickets={queue.items} more={queue.hasMore} /> : null}
      </div>

      {/* One row on a wide screen: what narrows the list on the left, whether
          it is current on the right. Stacked, they cost the first screen a row
          of Tickets. */}
      <div className="flex flex-wrap items-start justify-end gap-3">
        <div className="min-w-0 flex-[1_1_18rem]">
          <QueueFilters slice={slice} onChange={setSlice} principal={principal} />
        </div>

        <QueueFreshness failed={Boolean(queue.error)} />
      </div>

      <CollectionView
        collection={queue}
        waiting="Loading tickets…"
        empty={isNarrowed(slice) ? "No tickets match these filters." : "No tickets yet."}
      >
        {() => (
          <div className="space-y-3">
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
                className="rounded-card border border-dashed border-line-strong px-4 py-6 text-center text-sm leading-relaxed text-ink-muted"
              >
                No loaded ticket has that in its subject.
              </p>
            ) : (
              <div>
                {/* The columns, named once above the rows. Hidden from
                    assistive technology: each row already says all of it. */}
                <div aria-hidden="true" className="hidden pb-2 text-xs text-ink-muted md:flex">
                  <div className={`${QUEUE_ROW_GRID} flex-1 px-[17px]`}>
                    <span title={RULING_SOURCE}>AI ruling</span>
                    <span>Ticket</span>
                    <span>Who has it</span>
                    <span className="text-right">Updated</span>
                  </div>
                  <span className={`${QUEUE_ACTION_COLUMN} shrink-0`} />
                </div>

                <WindowedList
                  items={matching}
                  label="Tickets"
                  keyOf={(ticket) => ticket.id}
                  estimateRowPx={64}
                  // Where the reader was standing, so a row scrolled out of the
                  // window is brought back before the focus below reaches for it.
                  ensureVisible={matching.findIndex((ticket) => ticket.id === returningFrom)}
                >
                  {(ticket) => {
                    const claimable = Boolean(principal) && needsPerson(ticket);

                    return (
                      <div className="flex flex-wrap items-center md:flex-nowrap">
                        {/* The whole row, so what a keyboard reaches and what a
                            pointer hits are the same target — and one control
                            per Ticket rather than a link on the subject beside
                            a summary that is not part of it. */}
                        <button
                          type="button"
                          ref={ticket.id === returningFrom ? returnTo : undefined}
                          onClick={() => onOpen(ticket)}
                          className={`${QUEUE_ROW_GRID} min-w-0 flex-1 basis-full px-4 py-3 text-left transition-colors duration-150 hover:bg-sunken focus-visible:-outline-offset-3 md:basis-auto`}
                        >
                          <QueueRow ticket={ticket} me={principal?.userId} />
                        </button>

                        {/* The row's one action, where it has one: claiming a
                            ticket nobody has. Beside the row, not inside it. */}
                        <span
                          className={`${QUEUE_ACTION_COLUMN} shrink-0 justify-end px-4 pb-3 md:px-3 md:pb-0 ${
                            claimable ? "flex w-full" : "hidden md:flex"
                          }`}
                        >
                          {claimable && principal ? (
                            <AssignToMe ticket={ticket} me={principal.userId} />
                          ) : null}
                        </span>
                      </div>
                    );
                  }}
                </WindowedList>
              </div>
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

/** The slice that answers "what is waiting on a person": open or pending, and unclaimed. */
const WAITING_ON_A_PERSON: Pick<QueueSlice, "state" | "assignee"> = {
  state: ["open", "pending"],
  assignee: { kind: "unassigned" },
};

function isWaitingSlice(slice: QueueSlice): boolean {
  return (
    slice.assignee.kind === "unassigned" &&
    slice.state.length === 2 &&
    slice.state.includes("open") &&
    slice.state.includes("pending") &&
    slice.priority.length === 0 &&
    slice.source.length === 0 &&
    slice.contactId.trim() === "" &&
    slice.createdAfter === "" &&
    slice.createdBefore === ""
  );
}

/**
 * The screen's finding: how many of the Tickets in hand are waiting on a
 * person, with the one control that shows only those.
 *
 * Counted over what is loaded, and it says so whenever there is more to load:
 * the API pages by cursor and returns no total, so "4 of 25" is a fact about
 * the pages in hand and is never written as though it were the tenant's.
 * Beside it, the key to the strip at the head of every row.
 */
function Waiting({
  items,
  complete,
  shown,
  slice,
  onChange,
}: {
  items: Ticket[];
  /** Every page of this slice is in hand, so the count is the slice's. */
  complete: boolean;
  /** Whether the list has answered at all; until it has there is nothing to count. */
  shown: boolean;
  slice: QueueSlice;
  onChange: (slice: QueueSlice) => void;
}) {
  const waiting = items.filter(needsPerson).length;
  const only = isWaitingSlice(slice);
  const of = complete ? `${items.length}` : `the ${items.length} loaded`;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3">
      {shown ? (
        only ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>
              Showing only tickets that need a person and that nobody has claimed.
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...EVERYTHING, sort: slice.sort })}
              className="link text-sm"
            >
              Show every ticket
            </button>
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span>
              {waiting === 0 ? (
                <>None of {of} tickets is waiting on a person.</>
              ) : (
                <>
                  <span className="chip chip-over num">{waiting}</span> of {of} tickets{" "}
                  {waiting === 1 ? "needs" : "need"} a person, and nobody has claimed{" "}
                  {waiting === 1 ? "it" : "them"}.
                </>
              )}
            </span>
            {waiting > 0 ? (
              <button
                type="button"
                onClick={() => onChange({ ...EVERYTHING, ...WAITING_ON_A_PERSON, sort: slice.sort })}
                className="btn btn-ink !min-h-8 px-3 text-[0.8125rem]"
              >
                Show only these
              </button>
            ) : null}
          </p>
        )
      ) : null}

    </div>
  );
}


/**
 * What the AI did across the loaded tickets, as one wide ruling bar.
 *
 * The same three parts in the same order as each row's strip, each as wide as
 * its share of the rulings read so far. Rows read their ruling when they come
 * on screen, so the bar fills in as the list is scrolled, and it says how many
 * are still to be read rather than guessing at them. It is the key to the
 * strips below, too: each part is the mark it counts.
 */
function Tally({ tickets, more }: { tickets: Ticket[]; more: boolean }) {
  const read = useReadRulings(tickets);
  const counts: Record<Ruling, number> = { answer: 0, clarify: 0, escalate: 0 };
  let unread = 0;
  tickets.forEach((ticket, index) => {
    const ruling = read[index];
    if (ruling) counts[ruling] += 1;
    else if (ruling === undefined && ticket.source === "widget") unread += 1;
  });
  const total = counts.answer + counts.clarify + counts.escalate;

  return (
    <figure className="space-y-2">
      <div aria-hidden="true" className="flex h-3 gap-0.5 rounded-[5px] bg-sunken p-0.5">
        {total > 0
          ? RULINGS.map((ruling) =>
              counts[ruling] > 0 ? (
                <i
                  key={ruling}
                  className={`block rounded-[3px] ${RULING_FILL[ruling]}`}
                  style={{ flexGrow: counts[ruling], flexBasis: 0 }}
                />
              ) : null,
            )
          : null}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
        {RULINGS.map((ruling) => (
          <span key={ruling} className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className={`block size-2 rounded-[2px] ${RULING_FILL[ruling]}`} />
            <span className="num font-medium">{counts[ruling]}</span>
            {RULING_OUTCOMES[ruling].toLowerCase()}
          </span>
        ))}
        <span className="hidden text-ink-muted sm:inline">
          of the {tickets.length}
          {more ? " loaded" : ""} tickets{unread > 0 ? `, ${unread} still to read` : ""}.{" "}
          {RULING_SOURCE}.
        </span>
      </figcaption>
    </figure>
  );
}
