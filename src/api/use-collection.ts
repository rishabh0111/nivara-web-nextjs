"use client";

/**
 * A cursor-paginated collection, held in the cache and flattened to what a
 * surface renders.
 *
 * Every collection this API serves is read the same way — one page, then the
 * cursor the page came with — so the reading of it is written once here rather
 * than per surface. `nextCursor` is the API's own end-of-list signal, `null` and
 * nothing else, so there is no page count to derive and none is offered.
 */
import { useInfiniteQuery } from "@tanstack/react-query";

import type { ApiResult, Page } from "./client";
import { unwrap } from "./query";

export type Collection<Item> = {
  items: Item[];
  isPending: boolean;
  error: unknown;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  /**
   * How many pages have arrived — not how many there are, which the API does
   * not say. It answers one question: whether this list has ever been paged.
   */
  pages: number;
};

export function useCursorCollection<Item>({
  queryKey,
  read,
}: {
  queryKey: readonly unknown[];
  /** One page, from the cursor the last one ended with. */
  read: (cursor?: string) => Promise<ApiResult<Page<Item>>>;
}): Collection<Item> {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => unwrap(await read(pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  return {
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    isPending: query.isPending,
    error: query.error,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    pages: query.data?.pages.length ?? 0,
  };
}
