/**
 * The Ticket queue, as the Dashboard reads it.
 *
 * Nothing here narrows by who is asking. The API returns a User every Ticket in
 * their tenant whatever their role, and an interface that filtered to the ones
 * an agent owns would be inventing a rule the server does not have — one that
 * shows an agent a smaller queue than the work that exists. Choosing a slice is
 * the reader's to make, not this module's — so a slice arrives as an argument
 * and is never derived from the credential.
 *
 * Each read answers one page. Following the cursor is the query cache's job, and
 * the interface offers "load more" rather than a count the API does not return.
 */
import type { ApiResult, Page } from "@/api/client";
import type { SessionClient } from "@/session/session-client";
import type { Ticket } from "@/tickets/ticket";

import { toTicketQuery, type QueueSlice } from "./queue-slice";

export type DashboardQueue = {
  /** One page of the slice the reader asked for. */
  list(slice: QueueSlice, cursor?: string): Promise<ApiResult<Page<Ticket>>>;
};

export function createDashboardQueue(session: SessionClient): DashboardQueue {
  return {
    list(slice, cursor) {
      // The cursor rides alongside the slice rather than replacing it: the API
      // says changing `sort` invalidates a cursor, so the two always describe
      // the same question, and a new slice starts from no cursor at all.
      return session.page("/tickets", "get", { query: { ...toTicketQuery(slice), cursor } });
    },
  };
}
