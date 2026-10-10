"use client";

/**
 * The AI's ruling on one queue row, read from what Automation wrote.
 *
 * The queue's own read carries no ruling — a Ticket has none as a field — so a
 * row reads it, as cheaply as it can:
 *
 * - **Only rows that have been on screen read.** The caller passes `seen`, from
 *   an `IntersectionObserver`; a row nobody has scrolled to asks nothing.
 * - **Only widget rows read.** A Turn is only ever run from the Widget, so a
 *   portal or Slack ticket is "no AI turn" without asking.
 * - **Notes first.** The newest few Notes, newest first. An escalation Note
 *   settles it as a hand-over and the messages are never asked for. Only
 *   without one are the newest few messages read, to tell an answer from a
 *   question. (So on a row, a later answer after a hand-over shows as the
 *   hand-over; the ticket view reads both and compares.)
 * - **At most four reads in flight** across every row, so a fast scroll does
 *   not put fifty requests on the wire at once.
 * - **Read once per version.** Keyed on the Ticket's id and `updatedAt`, never
 *   stale under that key, and kept in `sessionStorage` so a reload in the same
 *   tab asks nothing again. A Ticket that changes has a new `updatedAt`, and so
 *   a new key.
 *
 * A read that fails leaves the row without a ruling rather than with an
 * error: the ruling is a reading aid, and the Ticket itself is still there to
 * open. Every ruling read is also put in a small shared store, which is what
 * the tally above the list counts.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { unwrap } from "@/api/query";
import { isEscalation, rulingOf, type Ruling } from "@/tickets/ruling";
import type { Ticket } from "@/tickets/ticket";

import { dashboardKeys } from "./dashboard-keys";
import { createDashboardTicket, type DashboardTicket } from "./dashboard-ticket";
import { useDashboardSession } from "./dashboard-session-context";

export type RowRuling = { reading: boolean; ruling: Ruling | undefined };

/** What one read settles: a ruling, or that there was none. */
type Settled = { ruling: Ruling | null };

const NEWEST = 5;
const IN_FLIGHT = 4;
const STORE_KEY = "nivara.rulings.v1";

/* -------------------------------------------------------------- the store */

const settled = new Map<string, Settled>();
const listeners = new Set<() => void>();
let version = 0;

const keyOf = (ticket: Pick<Ticket, "id" | "updatedAt">) => `${ticket.id}@${ticket.updatedAt}`;

function load(): void {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    if (!raw) return;
    for (const [key, value] of Object.entries(JSON.parse(raw) as Record<string, Settled>)) {
      settled.set(key, value);
    }
  } catch {
    // Storage refused or held something unreadable: read again, which is harmless.
  }
}

function save(): void {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(settled)));
  } catch {
    // Storage refused (a private window, a full quota). Kept for this page only.
  }
}

let loaded = false;
function held(key: string): Settled | undefined {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    load();
  }
  return settled.get(key);
}

function settle(key: string, value: Settled): void {
  settled.set(key, value);
  version += 1;
  save();
  for (const listener of listeners) listener();
}

/** The rulings read so far for these Tickets, for the tally. Re-renders as rows read. */
export function useReadRulings(tickets: readonly Ticket[]): (Ruling | null | undefined)[] {
  const at = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => 0,
  );

  return useMemo(
    () => tickets.map((ticket) => held(keyOf(ticket))?.ruling),
    // `at` is the store's version: the list is recomputed when a row settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickets, at],
  );
}

/* -------------------------------------------------------- the throttle */

let flying = 0;
const queued: (() => void)[] = [];

async function throttled<T>(read: () => Promise<T>): Promise<T> {
  if (flying >= IN_FLIGHT) await new Promise<void>((go) => queued.push(go));
  flying += 1;
  try {
    return await read();
  } finally {
    flying -= 1;
    queued.shift()?.();
  }
}

async function readRuling(reads: DashboardTicket, ticket: Ticket): Promise<Settled> {
  const notes = unwrap(await throttled(() => reads.latestNotes(ticket.id, NEWEST))).items;
  if (notes.some(isEscalation)) return { ruling: "escalate" };

  const messages = unwrap(await throttled(() => reads.latestMessages(ticket.id, NEWEST))).items;
  return { ruling: rulingOf(ticket.state, messages, notes) ?? null };
}

/* ------------------------------------------------------------- the hook */

export function useAiRuling(ticket: Ticket, seen: boolean): RowRuling {
  const session = useDashboardSession();
  const reads = useMemo(() => createDashboardTicket(session), [session]);
  const asked = ticket.source === "widget";
  const key = keyOf(ticket);
  const kept = asked ? held(key) : undefined;

  const query = useQuery({
    queryKey: [...dashboardKeys.ticket(ticket.id), "ruling", ticket.updatedAt],
    queryFn: () => readRuling(reads, ticket),
    enabled: asked && seen && !kept,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (query.data && !held(key)) settle(key, query.data);
  }, [query.data, key]);

  if (!asked) return { reading: false, ruling: undefined };
  const value = kept ?? query.data;
  if (value) return { reading: false, ruling: value.ruling ?? undefined };
  if (query.isError) return { reading: false, ruling: undefined };
  return { reading: true, ruling: undefined };
}
