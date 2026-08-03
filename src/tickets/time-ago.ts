/**
 * An instant off the wire, read as how long ago it was.
 *
 * Single locale, per the scope — there is nothing to negotiate, so the locale
 * is named rather than left to whatever the machine running this happens to be
 * set to. That also makes what this returns something a test can assert.
 */
const LOCALE = "en-GB";

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
const absolute = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Past this, "27 days ago" is arithmetic the reader has to do. Name the day. */
const OLDEST_RELATIVE = 30 * DAY;

const UNITS: { limit: number; size: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: HOUR, size: MINUTE, unit: "minute" },
  { limit: DAY, size: HOUR, unit: "hour" },
  { limit: OLDEST_RELATIVE, size: DAY, unit: "day" },
];

export function timeAgo(iso: string, now: number = Date.now()): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;

  // Clamped at zero: the API stamps these and the browser's clock may sit a
  // little behind it, which is skew rather than a Ticket updated in the future.
  const elapsed = Math.max(0, now - at);

  if (elapsed < MINUTE) return "just now";

  for (const { limit, size, unit } of UNITS) {
    if (elapsed < limit) return relative.format(-Math.floor(elapsed / size), unit);
  }

  return absolute.format(at);
}
