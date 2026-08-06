"use client";

/**
 * Whether the queue on screen is still what the server would answer, how the
 * reader is told, and how it catches up.
 *
 * One decision, so one module. An event says the queue may have changed; the
 * pages already read are marked as no longer standing, and *nothing is asked
 * for*; the reader is told, and asks when they choose. Invalidating and
 * refetching are two steps here rather than the one step the cache offers, and
 * the gap between them is the affordance ADR-0002 is about — a busy queue that
 * re-asked on every envelope would rearrange itself under a reader's cursor,
 * which is both wasteful and a way to click the wrong Ticket.
 *
 * What the reader is told is read out of the cache rather than remembered
 * beside it. A boolean held here would be a second answer to a question the
 * cache already answers, and the two come apart in both directions: a slice
 * re-read for some other reason — coming back to the queue from a Ticket, which
 * happens constantly — would go on being reported as overtaken while showing the
 * server's latest answer, and clearing the flag would have to happen at every
 * read rather than here.
 *
 * It is read as `isInvalidated` and deliberately not as staleness. The two look
 * alike and mean different things: everything here is stale a moment after it
 * arrives, because time passing is not news. What is being reported is that
 * something happened and the pages in hand have not been re-read since — which
 * is exactly the flag an invalidation sets and a completed read clears.
 */
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState, useSyncExternalStore } from "react";

import type { RealtimeEnvelope } from "@/realtime/envelope";

import { dashboardKeys } from "./dashboard-keys";
import { changesTheQueue } from "./queue-change";

/**
 * Whether the slice being read has been overtaken by something on the wire.
 *
 * Only what is on screen. A slice held in the cache that nobody is reading has
 * nobody to tell, and is re-read by whatever comes back to it — which is a
 * moment when the list is under nobody's cursor.
 */
export function useQueueOvertaken(): boolean {
  const cache = useQueryClient();

  const subscribe = useCallback(
    (changed: () => void) => cache.getQueryCache().subscribe(changed),
    [cache],
  );

  const overtaken = useCallback(
    () =>
      cache
        .getQueryCache()
        .findAll({ queryKey: dashboardKeys.queue, type: "active" })
        .some((query) => query.state.isInvalidated),
    [cache],
  );

  return useSyncExternalStore(subscribe, overtaken, () => false);
}

/**
 * Records that an envelope may have changed the queue, and asks for nothing.
 *
 * `refetchType: "none"` is the whole of it, and what it is protecting is the
 * slice on screen: that one has a reader with a cursor over it, and it stays
 * exactly as it is until they say otherwise. The slices behind it are marked
 * along with it, which costs nothing and says the true thing about them.
 *
 * Written to be handed straight to a Room, beside `useAnnouncing`, so a Room
 * added later cannot quietly decide this differently.
 */
export function useNotingQueueChanges(): (envelope: RealtimeEnvelope) => void {
  const cache = useQueryClient();

  return (envelope) => {
    if (!changesTheQueue(envelope)) return;

    void cache.invalidateQueries({ queryKey: dashboardKeys.queue, refetchType: "none" });
  };
}

/**
 * The one thing that moves the list without being asked: a Gap.
 *
 * Everything else here is built on the reader deciding when the queue moves,
 * and this is not a hole in that rule but the reason it can be held elsewhere.
 * Being *overtaken* is a known quantity — something arrived, and the pages in
 * hand are one read away from being current again, so they are left alone and
 * the reader is told. A Gap is the server saying it cannot account for a stretch
 * of this Room at all: what is on screen may be missing Tickets, showing
 * resolved ones, or in the wrong order, and there is no way to know which. A
 * reader cannot choose sensibly about a list nobody can describe, so it is
 * dropped and read again — waiting treatment, not an error.
 */
export function useDiscardingTheQueue(): () => void {
  const cache = useQueryClient();

  return useCallback(() => {
    void cache.resetQueries({ queryKey: dashboardKeys.queue });
  }, [cache]);
}

/** The reader asking for the list to move. Every slice on screen, re-asked. */
export function useRefreshQueue(): () => void {
  const cache = useQueryClient();

  return useCallback(() => {
    void cache.refetchQueries({ queryKey: dashboardKeys.queue, type: "active" });
  }, [cache]);
}

/**
 * The visible half of ADR-0002's most-argued-with decision.
 *
 * A Ticket arriving, moving state or changing hands does not touch the list.
 * The reader is told it has been overtaken and moves it themselves, so the
 * Ticket they were about to click is still under their cursor when they click
 * it. A reader watching a Ticket's detail update live while this list sits still
 * is the most likely misreading of this application, and it is the decision
 * working.
 *
 * It sits above the list rather than inside it, because an empty queue can be
 * overtaken too — the first Ticket of the morning arrives into a screen that
 * says there is no work, and that reader is owed it just as much.
 *
 * The region is rendered whether or not it has anything to say, for the same
 * reason the notice log is: a live region inserted at the same moment as its
 * content is frequently never announced at all, and a reader who cannot see the
 * list is exactly the reader who cannot tell it has gone behind.
 */
export function QueueFreshness({
  /** Whether the last read of the queue was refused — said by the list itself. */
  failed,
}: {
  failed: boolean;
}) {
  const overtaken = useQueueOvertaken();
  const refresh = useRefreshQueue();
  const rereading = useIsFetching({ queryKey: dashboardKeys.queue }) > 0;
  const [asked, setAsked] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {/*
        "Up to date" is said only once a read has come back, and come back
        without being refused — which is what makes it a claim about the
        server's answer rather than about the click. Said at all because the
        answer to a refresh is very often a list that looks identical, and a
        reader who cannot see the list would otherwise have pressed a button and
        been told nothing.
      */}
      <p
        role="status"
        aria-label="Whether this list is current"
        // The chip only appears once there is something to say. Tinted urgent
        // when the list has been overtaken, because a stale queue is the one
        // state here that costs a reader something, and calm when it is
        // current — the two readings are never the same colour by accident.
        className={
          overtaken
            ? "chip chip-urgent"
            : asked && !rereading && !failed
              ? "chip chip-calm"
              : "text-ink-muted"
        }
      >
        {overtaken ? (
          <>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            The queue has changed since it was loaded.
          </>
        ) : asked && !rereading && !failed ? (
          <>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
            >
              <path d="m20 6-11 11-5-5" />
            </svg>
            The queue is up to date.
          </>
        ) : null}
      </p>

      {/*
        Always here, never only while there is something to catch up on. A
        control that vanished under the reader at the moment they used it would
        drop a keyboard to the top of the document, which is the mistake the end
        of the list is careful not to make — and a reader who simply wants to
        know should not have to be told first before they can ask.
      */}
      <button
        type="button"
        onClick={() => {
          setAsked(true);
          refresh();
        }}
        className="btn btn-quiet !min-h-0 px-3 py-1.5 text-sm"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" />
        </svg>
        Refresh the queue
      </button>
    </div>
  );
}
