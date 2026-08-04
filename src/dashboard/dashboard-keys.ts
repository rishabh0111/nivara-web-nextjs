/**
 * Where the Dashboard's server state is held in the cache.
 *
 * Written once and shared, because a key is a name two pieces of code have to
 * agree on: the read that files something under it and the write that says it
 * has changed. Two array literals that must match and are never compared is how
 * an invalidation quietly stops invalidating anything.
 *
 * Everything is filed under one prefix so that signing out can drop all of it
 * without naming each read — what was read with a credential goes when the
 * credential does.
 */
import {
  toReportQuery,
  type AnalyticsCut,
  type AnalyticsWindow,
} from "@/analytics/analytics-window";

import { toTicketQuery, type QueueSlice } from "./queue-slice";

const SURFACE = ["dashboard"] as const;
const QUEUE = [...SURFACE, "tickets"] as const;

/**
 * One Ticket's own reads, filed away from the queue rather than under it.
 *
 * `["dashboard", "tickets", …]` would have read more naturally and would have
 * been wrong: the queue's prefix is what a change to any Ticket invalidates, and
 * nesting a Ticket's thread inside it would throw away a conversation someone is
 * reading every time an unrelated Ticket moved.
 */
const TICKET = [...SURFACE, "ticket"] as const;
const ticket = (ticketId: string) => [...TICKET, ticketId] as const;

export const dashboardKeys = {
  /** Everything read with the Dashboard's credential. */
  surface: SURFACE,
  /**
   * Every slice of the Ticket queue — the prefix a change to any Ticket
   * invalidates, whichever slices happen to be held. Not keyed by tenant: the
   * credential decides that.
   */
  queue: QUEUE,
  /**
   * One slice of the queue.
   *
   * Keyed by the query that was actually sent rather than by the slice the
   * controls hold, so two slices that ask the API the same question share one
   * cache entry — and a control that changes without changing the request does
   * not throw away pages already loaded.
   */
  queueSlice: (slice: QueueSlice) => [...QUEUE, toTicketQuery(slice)] as const,
  /** Everything read about one Ticket. */
  ticket,
  /** The chain of Tickets one conversation has run through. */
  conversation: (ticketId: string) => [...ticket(ticketId), "conversation"] as const,
  /** The customer-visible thread on one Ticket. */
  thread: (ticketId: string) => [...ticket(ticketId), "messages"] as const,
  /** The internal Notes on one Ticket. */
  notes: (ticketId: string) => [...ticket(ticketId), "notes"] as const,
  /** The audit timeline of one Ticket. */
  audit: (ticketId: string) => [...ticket(ticketId), "audit"] as const,
  /** Who is holding the credential. */
  principal: [...SURFACE, "principal"] as const,
  /**
   * One reading of the analytics report.
   *
   * Takes the window and the cut and converts them here, exactly as `queueSlice`
   * takes a slice: keyed by the query that was actually sent, so two windows
   * that ask the API the same question share one entry — and a caller never
   * converts a second time to name what it just asked for.
   *
   * Under the Dashboard's prefix, so signing out drops the report with
   * everything else read on that credential.
   */
  report: (window: AnalyticsWindow, cut?: AnalyticsCut) =>
    [...SURFACE, "analytics", toReportQuery(window, cut)] as const,
};
