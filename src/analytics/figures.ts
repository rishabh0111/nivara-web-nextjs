/**
 * The report's numbers, read into words.
 *
 * One rule runs through all of it: a figure the API declined to answer and a
 * figure that happens to be small are different things, and neither may be
 * rendered as the other. `rate` is `null` over an empty cohort — there is no
 * fraction of nothing — and rendering that as 0% would claim a measured result
 * where there is no measurement at all. A rate of one in three hundred is a
 * measurement, and rounding it to 0% would claim the opposite of what it says.
 *
 * So nothing here has words for the unanswered case. There is no answer to
 * format, and a formatter that returned a dash would be a second place deciding
 * how one is drawn — `NoAnswer` is that place, and it is a rendering rather than
 * a string because the mark and the words that stand in for it are always both.
 */
import type { DurationKey, Rate, RateKey } from "./analytics-report";

/** The value with no answer behind it, in the words the reader gets instead. */
export function formatRate(rate: Rate): string | null {
  if (rate.rate === null) return null;

  const percent = rate.rate * 100;

  // Bounded away from the ends rather than rounded to them. Something that
  // happened is never reported as never, and something that did not always
  // happen is never reported as always.
  if (percent > 0 && percent < 0.5) return "<1%";
  if (percent < 100 && percent >= 99.5) return ">99%";

  return `${Math.round(percent)}%`;
}

/**
 * The count behind a rate, and the cohort it is over.
 *
 * Always beside the rate, never on request. 26% of four Tickets and 26% of four
 * thousand are the same percentage and not remotely the same claim, and a reader
 * shown only the percentage has no way to tell which one they are looking at.
 */
export function formatCohort(rate: Rate, cohortSize: number): string {
  if (cohortSize === 0) return "No Tickets in this window";

  const tickets = cohortSize === 1 ? "Ticket" : "Tickets";
  return `${count(rate.count)} of ${count(cohortSize)} ${tickets}`;
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}

const UNITS = [
  { suffix: "d", ms: 86_400_000 },
  { suffix: "h", ms: 3_600_000 },
  { suffix: "m", ms: 60_000 },
  { suffix: "s", ms: 1_000 },
];

/**
 * A span of milliseconds, in the two largest units it has.
 *
 * Two, because the first says which order of magnitude this is and the second is
 * as much precision as anyone acts on: "2d 3h" is a decision, "2d 3h 14m 52s" is
 * a number to be re-read. An empty smaller unit is dropped rather than written
 * as a zero, so four hours exactly reads as "4h".
 */
export function formatDuration(ms: number): string {
  // Under the smallest unit is still a duration — a bot answering the instant a
  // Ticket arrives — and "0s" would read as no measurement rather than a fast one.
  if (ms < 1_000) return "<1s";

  const parts: string[] = [];
  let left = ms;

  for (const unit of UNITS) {
    const whole = Math.floor(left / unit.ms);
    left -= whole * unit.ms;

    if (whole > 0) parts.push(`${whole}${unit.suffix}`);
    if (parts.length === 2) break;
  }

  return parts.join(" ");
}

/**
 * What the report measures, named once.
 *
 * Two names each, because the same figure is read twice on this screen and the
 * two readings need different lengths: a tile has room to say what it is, a
 * column header has a column. Keyed by the document's own field names, so a
 * figure the API adds and this list has not is a figure nobody renders — and one
 * this list names that the API dropped is a compile error.
 */
export const RATE_FIGURES: { key: RateKey; name: string; column: string }[] = [
  { key: "deflection", name: "Deflection", column: "Deflected" },
  { key: "resolution", name: "Resolution", column: "Resolved" },
  {
    key: "firstResponseBreach",
    name: "First-response SLA breaches",
    column: "First-response breach",
  },
  { key: "resolutionBreach", name: "Resolution SLA breaches", column: "Resolution breach" },
];

/**
 * The durations, and what their absence means.
 *
 * A duration is `null` when nothing was measured rather than when the answer was
 * zero, and the two are different sentences: a cohort nobody replied to has no
 * first-response time, which is not the same as replying instantly.
 */
export const DURATION_FIGURES: {
  key: DurationKey;
  name: string;
  column: string;
  unmeasured: string;
}[] = [
  {
    key: "firstResponseMs",
    name: "First response time",
    column: "First response",
    unmeasured: "No Ticket in this window was replied to",
  },
  {
    key: "resolutionMs",
    name: "Resolution time",
    column: "Time to resolve",
    unmeasured: "No Ticket in this window reached a terminal state",
  },
];
