"use client";

import { useQuery } from "@tanstack/react-query";

import { unwrap } from "@/api/query";
import { dashboardKeys } from "@/dashboard/dashboard-keys";
import { useDashboardSession } from "@/dashboard/dashboard-session-context";

import { readAnalyticsReport, type AnalyticsReport } from "./analytics-report";
import type { AnalyticsCut, AnalyticsWindow } from "./analytics-window";

export type ReportRead = { value: AnalyticsReport | undefined; isPending: boolean; error: unknown };

/**
 * One reading of the report — the whole cohort, or one cut of it.
 *
 * A plain query rather than a collection: the report is one computed answer with
 * no cursor, and there is no more of it to ask for.
 */
export function useAnalyticsReport(window: AnalyticsWindow, cut?: AnalyticsCut): ReportRead {
  const session = useDashboardSession();

  const query = useQuery({
    queryKey: dashboardKeys.report(window, cut),
    queryFn: async () => unwrap(await readAnalyticsReport(session, window, cut)),
  });

  return { value: query.data, isPending: query.isPending, error: query.error };
}
