"use client";

import { useMemo } from "react";

import { useCursorCollection, type Collection } from "@/api/use-collection";
import type { Message } from "@/tickets/message";
import type { Ticket } from "@/tickets/ticket";

import { portalKeys } from "./portal-keys";
import { createPortalTickets } from "./portal-tickets";
import { usePortalSession } from "./portal-session-context";

export function usePortalTicketList(): Collection<Ticket> {
  const reads = usePortalApi();

  return useCursorCollection({
    queryKey: portalKeys.tickets,
    read: (cursor) => reads.list(cursor),
  });
}

export function usePortalThread(ticketId: string): Collection<Message> {
  const reads = usePortalApi();

  return useCursorCollection({
    queryKey: portalKeys.thread(ticketId),
    read: (cursor) => reads.thread(ticketId, cursor),
  });
}

function usePortalApi() {
  const session = usePortalSession();
  return useMemo(() => createPortalTickets(session), [session]);
}
