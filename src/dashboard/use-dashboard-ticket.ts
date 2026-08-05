"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { unwrap } from "@/api/query";
import { useCursorCollection, type Collection } from "@/api/use-collection";
import type { Message } from "@/tickets/message";
import type { Note } from "@/tickets/note";

import type { AuditEntry } from "./audit-entry";
import { dashboardKeys } from "./dashboard-keys";
import { createDashboardTicket } from "./dashboard-ticket";
import { useDashboardSession } from "./dashboard-session-context";

/**
 * The chain of Tickets one conversation has run through.
 *
 * A plain query rather than a collection, because the endpoint is never
 * paginated: a chain grows only when a closed Ticket is replied to, and handing
 * back a fragment of a narrative would make reading one a loop. There is no
 * cursor to follow and none is offered.
 */
export function useTicketConversation(ticketId: string) {
  const reads = useDashboardTicketApi();

  const query = useQuery({
    queryKey: dashboardKeys.conversation(ticketId),
    queryFn: async () => unwrap(await reads.conversation(ticketId)).items,
  });

  return { tickets: query.data, isPending: query.isPending, error: query.error };
}

export function useTicketThread(ticketId: string): Collection<Message> {
  const reads = useDashboardTicketApi();

  return useCursorCollection({
    queryKey: dashboardKeys.thread(ticketId),
    read: (cursor) => reads.thread(ticketId, cursor),
  });
}

export function useTicketNotes(ticketId: string): Collection<Note> {
  const reads = useDashboardTicketApi();

  return useCursorCollection({
    queryKey: dashboardKeys.notes(ticketId),
    read: (cursor) => reads.notes(ticketId, cursor),
  });
}

export function useTicketAudit(ticketId: string): Collection<AuditEntry> {
  const reads = useDashboardTicketApi();

  return useCursorCollection({
    queryKey: dashboardKeys.audit(ticketId),
    read: (cursor) => reads.audit(ticketId, cursor),
  });
}

function useDashboardTicketApi() {
  const session = useDashboardSession();
  return useMemo(() => createDashboardTicket(session), [session]);
}
