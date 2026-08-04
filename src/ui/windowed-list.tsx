"use client";

/**
 * A list that stops mounting rows nobody is looking at.
 *
 * The queue pages itself in as the reader scrolls, and nothing was capping what
 * that accumulates: a busy tenant worked for an hour leaves several thousand
 * rows in the document, each with its own button, chip and time element. This
 * renders the ones in view and a margin either side.
 *
 * Two decisions worth defending:
 *
 * **It virtualises the window, not a box.** The obvious implementation puts the
 * list in a fixed-height `overflow-y: auto` container, which is also the one
 * that puts a second scrollbar inside the page and breaks the reader's scroll
 * wheel, their space bar, and the browser's own find-on-page position. Here the
 * page scrolls as it always did and only the rows are windowed.
 *
 * **It does nothing at all until the list is long.** Below the threshold every
 * row is rendered exactly as before — no absolute positioning, no measured
 * heights, no transform. Windowing thirty rows costs more than it saves, and it
 * would mean the common case runs the complicated path for no reason.
 */
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

/**
 * Where windowing starts paying for itself.
 *
 * Four pages of the API's default twenty-five. Under this a list is a couple of
 * screens and the browser handles it without help.
 */
const VIRTUALISE_FROM = 100;

export function WindowedList<Item>({
  items,
  label,
  keyOf,
  children,
  estimateRowPx = 74,
  ensureVisible,
}: {
  items: Item[];
  /** Names the list, for whoever is hearing it rather than seeing it. */
  label: string;
  keyOf: (item: Item) => string;
  children: (item: Item) => React.ReactNode;
  /** A row's height before one has been measured. Only a starting guess. */
  estimateRowPx?: number;
  /**
   * A row that must be rendered even if it is out of view.
   *
   * The queue uses it to put a reader back where they left when they come out of
   * a Ticket. Without it the row they were standing on may be one the window has
   * unmounted, and the focus that was meant for it lands nowhere.
   */
  ensureVisible?: number;
}) {
  const list = useRef<HTMLUListElement>(null);
  const windowed = items.length >= VIRTUALISE_FROM;

  // Called unconditionally — it is a hook — but counted at zero when the list
  // is short, so it measures nothing and renders nothing on the common path.
  const virtualiser = useWindowVirtualizer({
    count: windowed ? items.length : 0,
    estimateSize: () => estimateRowPx,
    overscan: 10,
    // The list does not start at the top of the document. Without this the
    // window's scroll offset and the list's own coordinates disagree by exactly
    // the height of everything above it, and the rows render off-screen.
    scrollMargin: list.current?.offsetTop ?? 0,
    /**
     * A row that measures nothing has not been laid out, and is not a row that
     * is nothing tall.
     *
     * Taking the zero at face value is an infinite loop, and not a theoretical
     * one — it is what this component did before the test below caught it. The
     * total height collapses, the collapsed height changes which rows are in
     * range, the newly mounted rows measure zero on the frame they attach, and
     * the whole thing goes round again until React gives up with "maximum
     * update depth exceeded".
     *
     * It bites hardest where there is no layout engine at all, which is every
     * test in this repository. It is also reachable in a real browser on the
     * frame a row attaches before style has been resolved. Falling back to the
     * estimate makes the measurement monotonic, which is what stops the cycle.
     */
    measureElement: (element) => {
      const measured = element.getBoundingClientRect().height;
      return measured > 0 ? measured : estimateRowPx;
    },
  });

  const scrollToIndex = virtualiser.scrollToIndex;
  useEffect(() => {
    if (!windowed || ensureVisible === undefined || ensureVisible < 0) return;

    scrollToIndex(ensureVisible, { align: "center" });
  }, [windowed, ensureVisible, scrollToIndex]);

  if (!windowed) {
    return (
      <ul ref={list} aria-label={label} className="card divide-y divide-line overflow-hidden">
        {items.map((item) => (
          <li key={keyOf(item)}>{children(item)}</li>
        ))}
      </ul>
    );
  }

  const rows = virtualiser.getVirtualItems();

  return (
    <ul
      ref={list}
      aria-label={label}
      className="card relative overflow-hidden"
      style={{ height: virtualiser.getTotalSize() }}
    >
      {rows.map((row) => {
        const item = items[row.index];
        if (item === undefined) return null;

        return (
          <li
            key={keyOf(item)}
            data-index={row.index}
            ref={virtualiser.measureElement}
            /*
              Told how long the list really is, and where in it this row sits.
              A screen reader can only count what is in the document, so a
              windowed list without these announces "row 3 of 20" to somebody
              scrolling through four thousand.
            */
            aria-setsize={items.length}
            aria-posinset={row.index + 1}
            className="absolute top-0 left-0 w-full border-b border-line"
            style={{ transform: `translateY(${row.start - virtualiser.options.scrollMargin}px)` }}
          >
            {children(item)}
          </li>
        );
      })}
    </ul>
  );
}
