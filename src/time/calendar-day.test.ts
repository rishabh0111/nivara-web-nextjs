/**
 * The suite runs at +05:30 on purpose, so a conversion that read a picked day
 * as UTC would land on a different day here and fail rather than pass quietly.
 */
import { describe, expect, it } from "vitest";

import { endOfDay, startOfDay, startOfNextDay } from "./calendar-day";

describe("bounding the reader's day", () => {
  it("begins the day where the reader is, not at midnight UTC", () => {
    expect(startOfDay("2026-07-01")).toBe("2026-06-30T18:30:00.000Z");
  });

  it("ends an inclusive range at the last instant of the day named", () => {
    expect(endOfDay("2026-07-01")).toBe("2026-07-01T18:29:59.999Z");
  });

  /**
   * An exclusive bound a millisecond short of midnight would drop whatever
   * happened in that millisecond. The day after begins where the day named
   * ends, exactly.
   */
  it("ends an exclusive range where the next day begins", () => {
    expect(startOfNextDay("2026-07-01")).toBe(startOfDay("2026-07-02"));
  });

  it("rolls the month and the year over rather than doing calendar arithmetic", () => {
    expect(startOfNextDay("2026-07-31")).toBe(startOfDay("2026-08-01"));
    expect(startOfNextDay("2026-12-31")).toBe(startOfDay("2027-01-01"));
  });
});
