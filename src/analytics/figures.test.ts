/**
 * The two places a number can lie about itself.
 *
 * A rate over an empty cohort read as 0% is read as perfect or catastrophic
 * performance, and it is neither. A rate that is merely small rounded to 0% is
 * the same lie told by arithmetic rather than by a missing answer.
 */
import { describe, expect, it } from "vitest";

import { formatCohort, formatDuration, formatRate } from "./figures";

describe("a rate", () => {
  it("is a whole percentage of the cohort", () => {
    expect(formatRate({ count: 26, rate: 0.26 })).toBe("26%");
    expect(formatRate({ count: 0, rate: 0 })).toBe("0%");
    expect(formatRate({ count: 4, rate: 1 })).toBe("100%");
  });

  /**
   * Nothing, rather than a dash. There is no answer to put into words, and a
   * formatter that invented one would be deciding how the absence is drawn — a
   * decision that belongs to the one component that draws it.
   */
  it("has no answer over an empty cohort, rather than an answer of zero", () => {
    expect(formatRate({ count: 0, rate: null })).toBeNull();
  });

  /**
   * One Ticket in three hundred is not none of them. Rounding it away would say
   * the thing never happens, which is the same claim as the empty cohort's — and
   * it would be wrong rather than merely unanswered.
   */
  it("says a rate is under a percent rather than rounding it to none", () => {
    expect(formatRate({ count: 1, rate: 1 / 300 })).toBe("<1%");
  });

  /** And the same at the top: 299 of 300 is not all of them. */
  it("says a rate is over ninety-nine percent rather than rounding it to all", () => {
    expect(formatRate({ count: 299, rate: 299 / 300 })).toBe(">99%");
  });
});

describe("the count behind a rate", () => {
  it("names the numerator and the cohort it is over", () => {
    expect(formatCohort({ count: 26, rate: 0.26 }, 100)).toBe("26 of 100 Tickets");
  });

  it("groups thousands, so a big cohort is read at a glance", () => {
    expect(formatCohort({ count: 312, rate: 0.259 }, 1204)).toBe("312 of 1,204 Tickets");
  });

  it("counts one Ticket as one Ticket", () => {
    expect(formatCohort({ count: 1, rate: 1 }, 1)).toBe("1 of 1 Ticket");
  });

  /** Stated even over an empty cohort — it is the explanation for the dash. */
  it("says the cohort is empty rather than saying nothing", () => {
    expect(formatCohort({ count: 0, rate: null }, 0)).toBe("No Tickets in this window");
  });
});

describe("a duration", () => {
  it("reads in the two largest units it has", () => {
    expect(formatDuration(2 * 86_400_000 + 3 * 3_600_000)).toBe("2d 3h");
    expect(formatDuration(4 * 3_600_000 + 12 * 60_000)).toBe("4h 12m");
    expect(formatDuration(12 * 60_000 + 30_000)).toBe("12m 30s");
    expect(formatDuration(42_000)).toBe("42s");
  });

  it("drops an empty smaller unit rather than writing a zero into it", () => {
    expect(formatDuration(4 * 3_600_000)).toBe("4h");
    expect(formatDuration(2 * 86_400_000)).toBe("2d");
  });

  /** Sub-second is real — a bot answering immediately — and is not "0s". */
  it("reads under a second as under a second", () => {
    expect(formatDuration(400)).toBe("<1s");
    expect(formatDuration(0)).toBe("<1s");
  });
});
