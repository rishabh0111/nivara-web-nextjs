"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { ApiResult } from "@/api/client";
import type { Message } from "@/tickets/message";
import type { Note } from "@/tickets/note";
import type { Ticket, TicketPriority, TicketState } from "@/tickets/ticket";

import { dashboardKeys } from "./dashboard-keys";
import { createDashboardTicket, type DashboardTicket } from "./dashboard-ticket";
import { useDashboardSession } from "./dashboard-session-context";

/**
 * Everything a User can do to the Ticket they have open, and what each of those
 * makes stale.
 *
 * Bound to one Ticket rather than taking an id per call, because that is the
 * truth of the screen: the controls act on the Ticket in front of the reader,
 * and a write that could name any Ticket would be an invitation to act on the
 * wrong one from a chain that has several.
 *
 * The three edits are applied before the API answers; the two writes that add
 * something are not. That split is the whole design, and it used to be a flat
 * "nothing here is optimistic".
 *
 * What changed is that a refusal is now impossible to miss. The original
 * argument against predicting a write was the failure mode, not the latency: a
 * User who saw a state move, looked away, and never learned it had been refused
 * would carry on believing a Ticket was resolved. That reasoning was sound while
 * the only report of a refusal was a line of text beside the control — which on
 * a Ticket screen is frequently below the fold. It is answered by a rollback the
 * reader can see and an alert that interrupts them, which is what the toaster
 * handed to these writes is for.
 *
 * So `transition`, `setPriority` and `setAssignee` show the change at once,
 * because each is one field on a record already in hand and its previous value
 * is right there to restore. The server's answer still overwrites the guess when
 * it lands — the prediction is what the reader looks at for 200ms, never what is
 * kept.
 *
 * `reply` and `writeNote` stay honest and stay slow. Neither edits a record: both
 * create one, with an id and a timestamp only the server can issue, and the
 * ordering the thread is merged by is computed from exactly those. A predicted
 * Message is a row with an invented identity that has to be reconciled against
 * the real one when it arrives, and a reply can land on a *different Ticket*
 * than the one it addressed — which no client can predict at all.
 */
export type TicketWrites = {
  transition(state: TicketState): Promise<ApiResult<Ticket>>;
  setPriority(priority: TicketPriority): Promise<ApiResult<Ticket>>;
  setAssignee(assigneeId: string | null): Promise<ApiResult<Ticket>>;
  /** Answers the Contact, on whichever Ticket the API put the Message. */
  reply(body: string): Promise<ApiResult<Message>>;
  /** Coordinates with colleagues. Never reaches the Contact, by table rather than by flag. */
  writeNote(body: string): Promise<ApiResult<Note>>;
};

export function useTicketWrites(ticketId: string): TicketWrites {
  const session = useDashboardSession();
  const cache = useQueryClient();
  return useMemo(
    () => createTicketWrites(createDashboardTicket(session), cache, ticketId),
    [session, cache, ticketId],
  );
}

function createTicketWrites(
  api: DashboardTicket,
  cache: QueryClient,
  ticketId: string,
): TicketWrites {
  const chainKey = dashboardKeys.conversation(ticketId);

  /**
   * Files the Ticket the API has just answered with, where this screen reads it.
   *
   * The header, the transition table and the assignee line are all read off the
   * conversation chain, so putting the new record there is what makes a change
   * visible — and it is the record the server stored rather than the one the
   * control asked for, which is the difference between showing what happened and
   * showing what was requested.
   *
   * Applied locally rather than invalidated, which is the side of ADR-0002 that
   * needs the argument: the chain is not an append-only collection, and the rule
   * says membership changes are re-asked. It holds anyway, because the reason
   * behind the rule does not apply. What cannot be computed locally is membership
   * of a *cursor-paginated window over a server-side sort* — the queue. The chain
   * is a fixed, unpaginated set that only a reply can grow, and none of these
   * three writes is one. So the set is unchanged and exactly one member of it has
   * been replaced, by the server's own account of it.
   *
   * Where the chain has not arrived yet there is nothing to replace, and the
   * copy on screen is the one the queue handed over before this Ticket was
   * opened. So it is asked for instead: better one extra read than a screen
   * quietly showing the state a write has just moved away from.
   */
  const fileTicket = (updated: Ticket) => {
    let applied = false;

    cache.setQueryData<Ticket[]>(chainKey, (chain) => {
      if (!chain?.some((one) => one.id === updated.id)) return chain;

      applied = true;
      return chain.map((one) => (one.id === updated.id ? updated : one));
    });

    if (!applied) void cache.invalidateQueries({ queryKey: chainKey });
  };

  /**
   * Marks the queue stale, whichever slices are held.
   *
   * ADR-0002's rule that an invalidated list is held still and the reader told,
   * rather than refetched underneath them, is about envelopes arriving from
   * elsewhere. This is the reader's own write, and the queue is not on screen
   * while a Ticket is open — so nothing moves under anybody's cursor, and they
   * find it current when they come back to it.
   *
   * It is invalidated for all three edits, not only the obvious one. State,
   * priority and assignee are all filter vocabulary and all move `updatedAt`,
   * which is a sort key: any of them can change whether this Ticket belongs in
   * the slice a reader is working, or where in it it sits. No client can compute
   * membership in a cursor-paginated window over a server-side sort, so none of
   * them tries.
   */
  const queueChanged = () => void cache.invalidateQueries({ queryKey: dashboardKeys.queue });

  /** The log records exactly these three, and the reader is looking straight at it. */
  const logChanged = () =>
    void cache.invalidateQueries({ queryKey: dashboardKeys.audit(ticketId) });

  /**
   * Shows one field of the open Ticket as changed, and hands back the undo.
   *
   * Only the chain is touched, because the chain is what this screen reads the
   * header, the transition table and the assignee line off. Nothing is guessed
   * about the queue: membership of a cursor-paginated window over a server-side
   * sort is not computable here, which is as true before a write as after one.
   *
   * Returns the exact array it replaced rather than a patch to reverse. Putting
   * back what was there is the only restoration that cannot itself be wrong —
   * an inverse edit has to be derived, and a derivation is a second thing that
   * can have a bug in it.
   */
  const predict = (change: (ticket: Ticket) => Ticket) => {
    const held = cache.getQueryData<Ticket[]>(chainKey);
    if (!held?.some((one) => one.id === ticketId)) return undefined;

    cache.setQueryData<Ticket[]>(chainKey, (chain) =>
      chain?.map((one) => (one.id === ticketId ? change(one) : one)),
    );

    return held;
  };

  /**
   * Runs an edit that has already been shown, and puts it back if it was refused.
   *
   * Rolling back is this layer's job; *saying so* is not. The failure is handed
   * to the caller untouched, because the caller is the only thing that knows
   * what was attempted and the API is the only thing that knows why it was
   * refused — a message invented here would be a worse version of both. What
   * this guarantees is that by the time the caller sees the failure, the screen
   * is already back to what it showed before.
   *
   * The caller is obliged to report it. That obligation is the entire licence
   * for predicting the write in the first place.
   */
  const edit = async (
    change: (ticket: Ticket) => Ticket,
    run: () => Promise<ApiResult<Ticket>>,
  ) => {
    const restore = predict(change);
    const result = await run();

    if (!result.ok) {
      if (restore) cache.setQueryData<Ticket[]>(chainKey, restore);
      return result;
    }

    fileTicket(result.value);
    queueChanged();
    logChanged();
    return result;
  };

  return {
    async transition(state) {
      return edit(
        (ticket) => ({ ...ticket, state }),
        () => api.transition(ticketId, state),
      );
    },

    async setPriority(priority) {
      return edit(
        (ticket) => ({ ...ticket, priority }),
        () => api.setPriority(ticketId, priority),
      );
    },

    async setAssignee(assigneeId) {
      return edit(
        (ticket) => ({ ...ticket, assigneeId }),
        () => api.setAssignee(ticketId, assigneeId),
      );
    },

    async reply(body) {
      const said = await api.reply(ticketId, body);
      if (!said.ok) return said;

      // Where the Message went, read off the response rather than predicted. A
      // reply reopens a `pending` or `resolved` Ticket and does not revive a
      // terminal one at all — it opens a new linked Ticket and lands there — so
      // the thread that changed is not always the one that was addressed.
      void cache.invalidateQueries({ queryKey: dashboardKeys.thread(said.value.ticketId) });

      // The chain is re-read whether or not the reply moved, because either way
      // some Ticket in it is not where it was: a reply reopens the one it lands
      // on, and one that could not land added a Ticket that was not there
      // before. Read back rather than patched — which Ticket changed and how is
      // the server's account to give, and the Message does not carry it.
      void cache.invalidateQueries({ queryKey: chainKey });

      queueChanged();
      return said;
    },

    /**
     * Invalidated rather than appended, and deliberately against ADR-0002's rule
     * that an append-only collection is applied locally: that rule is about
     * envelopes arriving from elsewhere, and this is the reader's own write on
     * the thing they are looking at. Nothing moves under anyone's cursor, and
     * the Note that comes back is the one the server actually stored, timestamp
     * included — which is what the merge orders by.
     */
    async writeNote(body) {
      const written = await api.writeNote(ticketId, body);
      if (written.ok) void cache.invalidateQueries({ queryKey: dashboardKeys.notes(ticketId) });
      return written;
    },
  };
}
