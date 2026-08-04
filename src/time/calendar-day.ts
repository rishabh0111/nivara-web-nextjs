/**
 * A calendar day, as a date control gives one, and the instants that bound it.
 *
 * The day is the reader's own, not UTC. A date control offers the days of
 * whatever calendar the reader is looking at, so the instant that begins their
 * 1 July is midnight *where they are* — reading it as midnight UTC shifts the
 * boundary by their offset and silently answers about a different day.
 *
 * Both ends are here because the API spells its ranges two ways and neither is
 * wrong: `GET /tickets` takes `createdBefore` inclusively, and `GET /analytics`
 * takes `to` exclusively. A reader who names a last day means that day is in the
 * range either way, so which end is asked for is the caller's decision — and the
 * offset arithmetic under it stays in one place rather than being derived a
 * second time by whoever needs the other end.
 */

/** The first instant of the reader's day. */
export function startOfDay(day: string): string {
  return atLocalTime(day, 0, 0, 0, 0);
}

/** The last instant of the reader's day, for a range that includes it. */
export function endOfDay(day: string): string {
  return atLocalTime(day, 23, 59, 59, 999);
}

/**
 * The first instant after the reader's day, for a range that excludes its end.
 *
 * A day later rather than a millisecond before midnight, because an exclusive
 * bound set to `23:59:59.999` drops whatever happened in the last millisecond of
 * the day — a rounding error that is invisible until it is not.
 */
export function startOfNextDay(day: string): string {
  return atLocalTime(day, 24, 0, 0, 0);
}

/**
 * `Date` normalises out of range, so hour 24 is midnight tomorrow, and the month
 * and year roll with it. That is what makes the day-after case free of any
 * calendar arithmetic of our own.
 */
function atLocalTime(
  day: string,
  hours: number,
  minutes: number,
  seconds: number,
  milliseconds: number,
): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year!, month! - 1, date!, hours, minutes, seconds, milliseconds).toISOString();
}
