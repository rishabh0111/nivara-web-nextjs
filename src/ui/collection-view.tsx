"use client";

import { useEffect, useRef } from "react";

import { ReadView } from "./read-view";

/**
 * The four things any collection on a screen can be: still arriving, refused,
 * empty, or there.
 *
 * Three of them are what any read can be, and come from `ReadView`. The fourth
 * is this component's whole reason to exist: empty is separated from refused
 * deliberately, because "you have not raised a ticket yet" and "we could not
 * ask" look identical if both render as nothing, and one of them is a reason to
 * wait and try again.
 */
export function CollectionView<Item>({
  collection,
  waiting,
  empty,
  children,
}: {
  collection: { items: Item[]; isPending: boolean; error: unknown };
  /** What is being waited for, in the reader's words. */
  waiting: string;
  /** What an empty answer means here. */
  empty: string;
  children: (items: Item[]) => React.ReactNode;
}) {
  return (
    <ReadView read={{ ...collection, value: collection.items }} waiting={waiting}>
      {(items) =>
        // Announced, not merely shown. An empty answer is most often the answer
        // to a question just asked — a filter that matched nothing — and a
        // reader who cannot see the list vanish would otherwise get silence back.
        items.length === 0 ? (
          <div
            role="status"
            className="animate-rise flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-sunken px-4 py-10 text-center"
          >
            {/*
              Decorative, and marked as such — the sentence beneath it is the
              whole message. An empty list is the one screen with room for a
              picture, and a bare line of grey text in a dashed box reads as
              something that failed rather than something that is simply
              finished.
            */}
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-full bg-surface text-ink-faint ring-1 ring-line"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
              >
                <path d="M3 7h18M3 12h18M3 17h9" />
              </svg>
            </span>

            <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{empty}</p>
          </div>
        ) : (
          children(items)
        )
      }
    </ReadView>
  );
}

/**
 * The end of a cursor-paginated list: the next page, asked for by arriving
 * there.
 *
 * No count and no page numbers, because the API returns neither — there is a
 * next cursor or there is not, and an interface offering "page 3 of 12" would be
 * advertising information nothing here has.
 *
 * Reaching the end is the request. The end of the list is watched, and coming
 * into view is what asks for what follows it, so a long list arrives as it is
 * read rather than a page at a time on demand.
 *
 * The button is not a fallback for that — it is the same control, said out loud.
 * It is what a reader tabs to, what says "Loading…" while a page is on its way,
 * and what a reader on a Cold start presses when they would rather ask than
 * wait. It stays for the same reason the observer exists: neither one of them
 * tells a reader who cannot see the list what is happening to it.
 *
 * What happens when the last page arrives is the part worth the code. The
 * control the reader was standing on is the thing that disappears, so a reader
 * who cannot see the list grow would be left holding focus on nothing, having
 * been told nothing. The end is said out loud, and takes the focus the button
 * was holding.
 */
export function LoadMore({
  collection,
  label,
  end,
  counted,
}: {
  collection: {
    hasMore: boolean;
    isLoadingMore: boolean;
    loadMore: () => void;
    pages: number;
    /**
     * What has arrived so far, where the caller has it.
     *
     * Optional because not every list that pages is backed by one: the Ticket
     * conversation merges two endpoints and hands this control a synthesised
     * cursor with no single array behind it. No array, no running count — which
     * is the right answer there rather than a number that would be wrong.
     */
    items?: unknown[];
  };
  label: string;
  /** What the end of this particular list means, in the reader's words. */
  end: string;
  /**
   * What the things in this list are called, for the running count.
   *
   * There are deliberately no page numbers here, and this is the honest
   * substitute for them. The API answers with a cursor and no total, so "page 3
   * of 12" is a sentence this application has no way to write — it would have to
   * invent the 12. What it can say is how much of the list the reader is holding
   * right now, which is the question a page number is usually standing in for.
   *
   * Omitted where a running count would be noise rather than an answer.
   */
  counted?: string;
}) {
  const more = useRef<HTMLButtonElement>(null);
  const ended = useRef<HTMLParagraphElement>(null);
  const heldFocus = useRef(false);

  useReachedBy(more, collection.hasMore && !collection.isLoadingMore, () => {
    // Nothing is recorded about the focus here. A page that arrived because the
    // reader read this far was not asked for from the keyboard, and the end of
    // the list should not steal a focus that was never on the button.
    collection.loadMore();
  });

  useEffect(() => {
    if (collection.hasMore || !heldFocus.current) return;

    heldFocus.current = false;
    ended.current?.focus();
  });

  const items = collection.items;
  const holding =
    counted === undefined || items === undefined ? null : (
      <p className="text-center text-sm text-ink-faint">
        Showing {items.length.toLocaleString("en-US")} {counted}
      </p>
    );

  if (collection.hasMore) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          ref={more}
          onClick={() => {
            if (collection.isLoadingMore) return;

            // Focus is only handed on if it was here to begin with. Yanking it
            // from wherever a reader has since moved it would be the interface
            // deciding where they are looking.
            heldFocus.current = document.activeElement === more.current;
            collection.loadMore();
          }}
          // Marked as refusing rather than disabled, because a disabled button
          // cannot hold focus: a reader who pressed it would be dropped to the
          // top of the document at the exact moment they asked for more.
          aria-disabled={collection.isLoadingMore}
          className="btn btn-quiet w-full"
        >
          {collection.isLoadingMore ? (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-accent"
            />
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          )}
          {collection.isLoadingMore ? "Loading…" : label}
        </button>

        {holding}
      </div>
    );
  }

  // Only where the reader has been through more than one page. Announcing the
  // end of a list that arrived whole tells them where the bottom is, which they
  // can already see — and it is read off the pages that came back rather than
  // remembered here, so a list narrowed to a single page stops claiming it.
  if (collection.pages < 2) return null;

  return (
    <div className="space-y-1 py-2">
      <p ref={ended} role="status" tabIndex={-1} className="text-center text-sm text-ink-faint">
        {end}
      </p>
      {holding}
    </div>
  );
}

/**
 * Calls back when the element is reached, while there is a reason to care.
 *
 * The observer exists only while `active` holds, so a list with nothing left
 * to load is not being watched, and a page already on its way is not asked for
 * twice. Where there is no observer — a browser too old for it, or a test
 * environment with no viewport to intersect — nothing is watched and the button
 * is the whole interface, which is why the button is not optional.
 */
function useReachedBy(
  target: React.RefObject<Element | null>,
  active: boolean,
  reached: () => void,
) {
  const arrive = useRef(reached);
  arrive.current = reached;

  useEffect(() => {
    const element = target.current;
    if (!active || !element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) arrive.current();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [target, active]);
}
