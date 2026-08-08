import { describe, expect, it } from "vitest";

import { startOfDay } from "@/time/calendar-day";

import {
  describeCoveredWindow,
  EVER_SINCE,
  toReportQuery,
  type AnalyticsWindow,
} from "./analytics-window";

const window = (overrides: Partial<AnalyticsWindow> = {}): AnalyticsWindow => ({
  ...EVER_SINCE,
  ...overrides,
});

describe("the window on the wire", () => {
  it("asks nothing about the window until the reader chooses one", () => {
    expect(toReportQuery(EVER_SINCE)).toEqual({});
  });

  it("begins the cohort at the start of the reader's chosen first day", () => {
    expect(toReportQuery(window({ from: "2026-07-01" }))).toEqual({
      from: "2026-06-30T18:30:00.000Z",
    });
  });

  /**
   * `to` is exclusive, and a reader naming a last day means that day counts —
   * so the bound is where the day after begins. The queue's `createdBefore` is
   * inclusive and takes the other end of the same day; the two must not be
   * confused, which is why neither spells the arithmetic itself.
   */
  it("ends the cohort where the day after the reader's last day begins", () => {
    expect(toReportQuery(window({ to: "2026-07-31" }))).toEqual({ to: startOfDay("2026-08-01") });
  });

  it("carries both ends when both are chosen", () => {
    expect(toReportQuery(window({ from: "2026-07-01", to: "2026-07-31" }))).toEqual({
      from: "2026-06-30T18:30:00.000Z",
      to: "2026-07-31T18:30:00.000Z",
    });
  });

  /** A single day is a window: it begins at its own start and ends at the next. */
  it("takes one day as a window over that day", () => {
    expect(toReportQuery(window({ from: "2026-07-01", to: "2026-07-01" }))).toEqual({
      from: startOfDay("2026-07-01"),
      to: startOfDay("2026-07-02"),
    });
  });
});

describe("the window a report covers", () => {
  /**
   * The exclusive end is a hair after the last day, not on it. Naming the day
   * `to` falls on would claim a day whose Tickets are not in the cohort.
   */
  it("names the last day inside the window rather than the one it stops at", () => {
    expect(describeCoveredWindow(startOfDay("2026-07-01"), startOfDay("2026-08-01"))).toBe(
      "1 Jul 2026 – 31 Jul 2026",
    );
  });

  it("names one day at both ends of a window over that day", () => {
    expect(describeCoveredWindow(startOfDay("2026-07-01"), startOfDay("2026-07-02"))).toBe(
      "1 Jul 2026 – 1 Jul 2026",
    );
  });

  /** The API's own window ends at "now", which is not a day boundary. */
  it("names the day an open-ended window is still inside", () => {
    expect(describeCoveredWindow("2026-07-01T12:00:00.000Z", "2026-07-31T12:00:00.000Z")).toBe(
      "1 Jul 2026 – 31 Jul 2026",
    );
  });
});

describe("the cut", () => {
  it("is left off entirely for the report over everything", () => {
    expect(toReportQuery(EVER_SINCE)).not.toHaveProperty("groupBy");
  });

  it("names the axis the figures are broken down by", () => {
    expect(toReportQuery(EVER_SINCE, "assignee").groupBy).toBe("assignee");
    expect(toReportQuery(window({ from: "2026-07-01" }), "day")).toEqual({
      from: startOfDay("2026-07-01"),
      groupBy: "day",
    });
  });
});
