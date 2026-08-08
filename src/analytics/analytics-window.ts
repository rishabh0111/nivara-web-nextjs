/**
 * The window an admin is reading over, and the query that asks for it.
 *
 * The same two shapes the queue keeps apart, kept apart for the same reason. The
 * window is what the controls edit — two calendar days, as a date control gives
 * them. The query is what goes on the wire: ISO-8601 instants, and a `groupBy`
 * naming one axis. Converting between them once, here, is what keeps a control
 * from having to know that `to` is exclusive.
 *
 * Unchosen is empty rather than a computed default. The API's own window is the
 * last thirty days, and a client that worked that out for itself would be
 * guessing at a rule the server owns — and would go on guessing it after the
 * server changed its mind. What the report covers is read off the answer, which
 * carries the window it was computed over, rather than off the controls that did
 * not ask for one.
 */
import type { Operation, QueryOf } from "@/api/operations";
import { startOfDay, startOfNextDay } from "@/time/calendar-day";

/** Every query parameter `GET /analytics` defines, and no others. */
export type ReportQuery = Exclude<QueryOf<Operation<"/analytics", "get">>, undefined>;

/** The axes the API will break the figures down by. */
export type AnalyticsCut = Exclude<ReportQuery["groupBy"], undefined>;

/** A calendar day, `YYYY-MM-DD`, or empty for whichever end the API defaults to. */
export type AnalyticsWindow = { from: string; to: string };

/** Neither end chosen — the API's own window, whatever it currently is. */
export const EVER_SINCE: AnalyticsWindow = { from: "", to: "" };

export function toReportQuery(window: AnalyticsWindow, cut?: AnalyticsCut): ReportQuery {
  const query: ReportQuery = {};

  if (window.from !== "") query.from = startOfDay(window.from);

  // The cohort is Tickets created *strictly before* `to`, and a reader naming a
  // last day means that day is in the window. So the bound is the instant the
  // day after begins — not the last instant of the day named, which is the
  // other end of the same day and what the queue's inclusive `createdBefore`
  // takes.
  if (window.to !== "") query.to = startOfNextDay(window.to);

  if (cut) query.groupBy = cut;

  return query;
}

/**
 * The window a report was computed over, in the reader's own days.
 *
 * Read off the answer rather than off the controls, so it says what the figures
 * actually cover — including when nothing was asked and the API applied its own
 * window. The last day is the last day *inside* the window: `to` is exclusive,
 * so an instant a hair before it is in the range and the day containing that
 * instant is the one to name. Printing the day `to` falls on would claim a day
 * the cohort does not include, which for a window ending at midnight is a whole
 * day of Tickets a reader would go looking for.
 */
export function describeCoveredWindow(from: string, to: string): string {
  const lastDay = new Date(new Date(to).getTime() - 1);

  return `${asDay(new Date(from))} – ${asDay(lastDay)}`;
}

/**
 * A fixed spelling rather than the reader's locale. The day is already theirs —
 * these are local instants — and a format that shifted with the machine would
 * make one screenshot of this screen disagree with another for no reason a
 * reader could see.
 */
function asDay(at: Date): string {
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
