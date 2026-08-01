"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * The one server-state store.
 *
 * Collections are held in its cursor-paginated form, which maps onto the API's
 * `{ data, nextCursor }` exactly — no total, because the API returns none, and
 * so nothing above this can offer a count or a numbered page.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The request layer already retries, and only what is worth retrying:
        // a rate limit, using the interval the server gave. A second retry
        // policy here would re-ask on `not_found` and `forbidden`, which are
        // settled answers, and would multiply the backoff the server asked for.
        retry: false,

        // A live event is what tells this application something changed; the
        // rule is that the list is held still and the reader is told, rather
        // than refetched underneath them. Refetching on focus would be that
        // refetch, arriving from a different direction.
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function QueryProvider({
  children,
  client,
}: {
  children: React.ReactNode;
  /** Supplied by tests, so each gets its own empty cache. */
  client?: QueryClient;
}) {
  const [held] = useState(() => client ?? createQueryClient());

  return <QueryClientProvider client={held}>{children}</QueryClientProvider>;
}
