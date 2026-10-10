"use client";

/**
 * The tickets created in the window the figures cover, for the ruling cells.
 *
 * The report counts a cohort; it does not list it, and it says nothing about
 * what the AI did with each ticket. So the cohort is read from `GET /tickets`
 * over the same window — `createdAfter` its start and `createdBefore` the last
 * instant before its exclusive end — and each cell reads its own ruling. The
 * first hundred, newest first; a window with more says so.
 */
import { useQuery } from "@tanstack/react-query";

import { unwrap } from "@/api/query";
import { dashboardKeys } from "@/dashboard/dashboard-keys";
import { useDashboardSession } from "@/dashboard/dashboard-session-context";
import type { Ticket } from "@/tickets/ticket";

const FIRST = 100;

export function useWindowTickets(
  covering: { from: string; to: string } | undefined,
): { tickets: Ticket[]; more: boolean } | undefined {
  const session = useDashboardSession();

  const query = useQuery({
    queryKey: [...dashboardKeys.surface, "analytics", "tickets", covering?.from, covering?.to],
    enabled: covering !== undefined,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const last = new Date(new Date(covering!.to).getTime() - 1).toISOString();
      const page = unwrap(
        await session.page("/tickets", "get", {
          query: {
            createdAfter: covering!.from,
            createdBefore: last,
            sort: "-createdAt",
            limit: FIRST,
          },
        }),
      );
      return { tickets: page.items, more: page.nextCursor !== null };
    },
  });

  return query.data;
}
