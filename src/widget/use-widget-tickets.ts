import { useMemo } from "react";

import { useCursorCollection, type Collection } from "@/api/use-collection";
import type { Message } from "@/tickets/message";
import type { Ticket } from "@/tickets/ticket";

import { widgetKeys } from "./widget-keys";
import { createWidgetTickets, type WidgetTickets } from "./widget-tickets";
import type { WidgetSession } from "./widget-session";

/**
 * The Widget's reads, through the same cursor-paginated store the other
 * Surfaces use.
 *
 * The store is worth its weight here for the same reason the size budget exists
 * to question: a second, hand-rolled way of paging a collection would be a
 * second place for "load more" to go wrong, on the Surface where it is hardest
 * to notice — a Tenant's page, in somebody else's browser.
 */
export function useWidgetConversations(api: WidgetTickets): Collection<Ticket> {
  return useCursorCollection({ queryKey: widgetKeys.tickets, read: (cursor) => api.list(cursor) });
}

export function useWidgetThread(api: WidgetTickets, ticketId: string): Collection<Message> {
  return useCursorCollection({
    queryKey: widgetKeys.thread(ticketId),
    read: (cursor) => api.thread(ticketId, cursor),
  });
}

/**
 * The Widget's client, held for as long as the session is.
 *
 * Passed down rather than pulled from a context the way the Portal's is: the
 * Widget is one tree with one session, handed to it at boot, and a context here
 * would be a provider that exists to serve a single consumer.
 */
export function useWidgetApi(session: WidgetSession): WidgetTickets {
  return useMemo(() => createWidgetTickets(session), [session]);
}
