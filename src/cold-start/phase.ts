/**
 * A Cold start, as a state rather than a hang.
 *
 * The API is a free Render instance that sleeps after about fifteen minutes
 * idle, and the keep-warm ping narrows that window without closing it. The first
 * request after a sleep can take tens of seconds. That is a thing to say out
 * loud, in the words that describe it, and not a spinner that never resolves.
 */

/** Long enough that the wait is real, short enough to be an acknowledgement. */
export const ACKNOWLEDGE_AFTER_MS = 2_000;

/** Past this, a wait needs a cause rather than more patience. */
export const EXPLAIN_AFTER_MS = 8_000;

export type ColdStartPhase =
  /** Nothing is waiting, or nothing has waited long enough to mention. */
  | "idle"
  /** Say that we are waiting. */
  | "acknowledged"
  /** Say why. */
  | "explained";

export function coldStartPhase(longestWaitMs: number | undefined): ColdStartPhase {
  if (longestWaitMs === undefined) return "idle";
  if (longestWaitMs >= EXPLAIN_AFTER_MS) return "explained";
  if (longestWaitMs >= ACKNOWLEDGE_AFTER_MS) return "acknowledged";
  return "idle";
}

/**
 * When the phase could next change, given how long we have already waited.
 * `undefined` once there is nothing further to say.
 */
export function msUntilNextPhase(longestWaitMs: number | undefined): number | undefined {
  if (longestWaitMs === undefined) return undefined;
  if (longestWaitMs < ACKNOWLEDGE_AFTER_MS) return ACKNOWLEDGE_AFTER_MS - longestWaitMs;
  if (longestWaitMs < EXPLAIN_AFTER_MS) return EXPLAIN_AFTER_MS - longestWaitMs;
  return undefined;
}
