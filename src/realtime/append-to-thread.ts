/**
 * Adding a thread entry the socket carried to a collection already read.
 *
 * This is the half of ADR-0002 the rule was written for: a thread is
 * append-only, the envelope carries the server's own record of the row rather
 * than a description of it, and refetching a cursor-paginated conversation to
 * learn one line would be slower and no more correct.
 *
 * Written once, because both customer-facing readings of a thread need exactly
 * this and the part that is easy to get wrong is the same part on both — the
 * identity check. It is the record's own id, never the sequence number it
 * arrived under, which is what makes a redelivered envelope harmless before the
 * wire layer has dropped it and what makes the Widget's rebuilt connection
 * invisible when it hears a whole buffer again.
 *
 * What differs between the callers is only which end. That is not a detail of
 * this function so much as a consequence of how each Surface asked: the
 * Dashboard reads a thread oldest-first and renders it as it arrived, so the
 * newest row belongs at the end; the Widget reads newest-first and reverses the
 * whole concatenation, so the newest row belongs at the start. Position in the
 * array is not position on the screen, and this is the one place that is true
 * in two different directions.
 */
import type { Page } from "@/api/client";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type { ThreadEntry } from "./envelope";

/** Where the newest row goes in the pages held, which is not where it reads. */
export type ThreadEnd = "first" | "last";

export function appendToThread(
  cache: QueryClient,
  key: readonly unknown[],
  entry: ThreadEntry,
  end: ThreadEnd,
): void {
  cache.setQueryData<InfiniteData<Page<ThreadEntry>>>(key, (held) => {
    // Nothing read is nothing to append to, and nothing is done: the read that
    // follows brings this row with it.
    if (!held) return held;
    // Already held is left alone. Identity is the row's, not the delivery's.
    if (held.pages.some((page) => page.items.some((item) => item.id === entry.id))) return held;

    const at = end === "first" ? 0 : held.pages.length - 1;

    return {
      ...held,
      pages: held.pages.map((page, index) =>
        index === at
          ? { ...page, items: end === "first" ? [entry, ...page.items] : [...page.items, entry] }
          : page,
      ),
    };
  });
}
