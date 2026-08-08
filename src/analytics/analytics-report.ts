/**
 * The report, as the Dashboard reads it.
 *
 * One endpoint and one question at a time. Every cut carries `overall` as well
 * as its groups, so the headline figures could have been lifted off whichever
 * cut answered first and a request saved — and then the headline would vanish
 * whenever that one cut failed, and which cut that was would depend on the
 * order the answers happened to arrive in. Each question is asked and answered
 * on its own, so a cut that fails takes down its own table and nothing else.
 */
import type { ApiResult } from "@/api/client";
import type { components } from "@/api/generated/openapi";
import type { SessionClient } from "@/session/session-client";

import { toReportQuery, type AnalyticsCut, type AnalyticsWindow } from "./analytics-window";

export type AnalyticsReport = components["schemas"]["AnalyticsReportDto"];
export type Metrics = components["schemas"]["MetricsDto"];
export type GroupMetrics = components["schemas"]["GroupMetricsDto"];
export type Rate = components["schemas"]["RateDto"];
export type Duration = components["schemas"]["DurationDto"];

/** The figures on a cohort that are rates, named by the document's own shapes. */
export type RateKey = { [K in keyof Metrics]: Metrics[K] extends Rate ? K : never }[keyof Metrics];

/** And the ones that are durations, which are absent rather than zero when unmeasured. */
export type DurationKey = {
  [K in keyof Metrics]: Metrics[K] extends Duration | null ? K : never;
}[keyof Metrics];

export function readAnalyticsReport(
  session: SessionClient,
  window: AnalyticsWindow,
  cut?: AnalyticsCut,
): Promise<ApiResult<AnalyticsReport>> {
  return session.resource("/analytics", "get", { query: toReportQuery(window, cut) });
}
