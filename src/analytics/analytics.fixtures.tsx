/**
 * What an Analytics test needs to stand the screen up against a fake wire.
 *
 * Typed as the document types the report, so a handler cannot answer with a
 * shape the API could not have sent — in particular it cannot answer a rate
 * without its count, or a duration that is present when the cohort is empty.
 */
import { render } from "@testing-library/react";

import { createApiClient } from "@/api/client";
import { QueryProvider } from "@/api/query-client";
import { createDashboardSession } from "@/dashboard/dashboard-session";
import { DashboardSessionProvider } from "@/dashboard/dashboard-session-context";
import type { SessionStore } from "@/session/store";

import { Analytics } from "./analytics";
import type { AnalyticsReport, GroupMetrics, Metrics } from "./analytics-report";

export { baseUrl, dashboardApi, principal, signedInStore } from "@/dashboard/dashboard.fixtures";

/** No live connection is opened here — the report is a read, not a Room. */
const NOWHERE = "http://127.0.0.1:1/rt";

const HOURS = 3_600_000;
const DAYS = 86_400_000;

export function metrics(overrides: Partial<Metrics> = {}): Metrics {
  return {
    cohortSize: 1204,
    deflection: { count: 312, rate: 312 / 1204 },
    resolution: { count: 900, rate: 900 / 1204 },
    firstResponseBreach: { count: 60, rate: 60 / 1204 },
    resolutionBreach: { count: 24, rate: 24 / 1204 },
    firstResponseMs: { p50: 4 * HOURS + 12 * 60_000, p90: 9 * HOURS },
    resolutionMs: { p50: 2 * DAYS + 3 * HOURS, p90: 5 * DAYS },
    ...overrides,
  };
}

/**
 * A cohort with nothing in it — every rate unanswered rather than zero, and no
 * durations at all, which is the shape the API actually sends.
 */
export function emptyMetrics(): Metrics {
  const none = { count: 0, rate: null };

  return {
    cohortSize: 0,
    deflection: none,
    resolution: none,
    firstResponseBreach: none,
    resolutionBreach: none,
    firstResponseMs: null,
    resolutionMs: null,
  };
}

export function group(key: string, overrides: Partial<Metrics> = {}): GroupMetrics {
  return { ...metrics(overrides), key };
}

/** July, as a window whose last included day is the 31st. */
export function report(overrides: Partial<AnalyticsReport> = {}): AnalyticsReport {
  return {
    from: "2026-06-30T18:30:00.000Z",
    to: "2026-07-31T18:30:00.000Z",
    groupBy: null,
    overall: metrics(),
    groups: null,
    ...overrides,
  };
}

export function renderAnalytics(store: SessionStore): void {
  const session = createDashboardSession(
    createApiClient({ baseUrl: "https://api.test" }),
    store,
    NOWHERE,
  );

  render(
    <QueryProvider>
      <DashboardSessionProvider session={session}>
        <Analytics />
      </DashboardSessionProvider>
    </QueryProvider>,
  );
}
