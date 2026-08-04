"use client";

import { useMemo } from "react";

import { useCursorCollection, type Collection } from "@/api/use-collection";
import type { Ticket } from "@/tickets/ticket";

import { dashboardKeys } from "./dashboard-keys";
import { createDashboardQueue } from "./dashboard-queue";
import { useDashboardSession } from "./dashboard-session-context";
import type { QueueSlice } from "./queue-slice";

export function useTicketQueue(slice: QueueSlice): Collection<Ticket> {
  const session = useDashboardSession();
  const queue = useMemo(() => createDashboardQueue(session), [session]);

  return useCursorCollection({
    queryKey: dashboardKeys.queueSlice(slice),
    read: (cursor) => queue.list(slice, cursor),
  });
}
