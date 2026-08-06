"use client";

/**
 * What has happened, as opposed to what has changed.
 *
 * Held for the whole signed-in Dashboard rather than beside the Ticket that
 * raised it, and that is the point of it: a User is told an SLA breached whether
 * they were reading that Ticket, reading another one, or working the queue.
 * Tying the log to the Ticket view would mean the reader who most needed to hear
 * it — the one who is not looking at it — is the one who never does.
 *
 * Announced rather than merely shown, because that is the whole claim: `log` is
 * the live region for a place where things are added in a meaningful order and
 * old ones fall away, which is exactly what this is.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type { RealtimeEnvelope } from "@/realtime/envelope";
import { timeAgo } from "@/tickets/time-ago";

import { noticeFor, type LiveNotice } from "./live-notice";

/**
 * How many are kept.
 *
 * A bound rather than a feature: a Dashboard left open all day on a busy tenant
 * would otherwise accumulate every notice it was ever sent. Past this the oldest
 * go, which are the ones that have been read or have been missed.
 */
const NOTICES_KEPT = 20;

type NoticeBoard = {
  notices: LiveNotice[];
  /** Adds one, or does nothing where this event has already been raised. */
  raise: (notice: LiveNotice) => void;
  dismiss: (id: string) => void;
  /**
   * Puts the whole board down at once.
   *
   * A busy tenant raises these faster than anybody dismisses them one at a
   * time, and a reader who has taken in twelve breaches does not want to press
   * twelve buttons to say so.
   */
  dismissAll: () => void;
};

const NOTHING: NoticeBoard = {
  notices: [],
  raise: () => {},
  dismiss: () => {},
  dismissAll: () => {},
};

const LiveNoticesContext = createContext<NoticeBoard>(NOTHING);

export function LiveNoticesProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<LiveNotice[]>([]);

  const raise = useCallback((notice: LiveNotice) => {
    setNotices((held) => {
      // Keyed by what the event is, so the same event announced into two Rooms
      // is one notice — and the one already held is kept rather than replaced,
      // so a second delivery does not move it under a reader's eyes.
      if (held.some((one) => one.id === notice.id)) return held;

      return [notice, ...held].slice(0, NOTICES_KEPT);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotices((held) => held.filter((one) => one.id !== id));
  }, []);

  const dismissAll = useCallback(() => setNotices([]), []);

  const board = useMemo(
    () => ({ notices, raise, dismiss, dismissAll }),
    [notices, raise, dismiss, dismissAll],
  );

  return <LiveNoticesContext.Provider value={board}>{children}</LiveNoticesContext.Provider>;
}

/** Where a live event that changed nothing is announced. */
export function useLiveNotices(): NoticeBoard {
  return useContext(LiveNoticesContext);
}

/**
 * Announces whatever an envelope is worth announcing, and nothing otherwise.
 *
 * Every Room a Surface reads does this, and does it the same way — the two that
 * carry notification events carry them for two different reasons and there is
 * one thing to do with either. Written once so that a Room added later cannot
 * quietly do it differently.
 */
export function useAnnouncing(): (envelope: RealtimeEnvelope) => void {
  const { raise } = useLiveNotices();

  return (envelope) => {
    const notice = noticeFor(envelope);
    if (notice) raise(notice);
  };
}

/**
 * The bell, its count, and the panel behind it.
 *
 * These used to be a stack of full-width rows above the queue, which is the
 * wrong place twice over: they are not part of the work, and on a busy tenant
 * twenty of them pushed the work off the screen entirely. A notification centre
 * is where a reader expects to find "things that happened, which I have not
 * dealt with", and it costs the page no room until they ask.
 *
 * ## The part that is not decoration
 *
 * The announcement and the panel are deliberately two different things.
 *
 * A `log` inside a closed panel is not in the document, and a region that is
 * not in the document announces nothing — so a breach arriving while the bell
 * is shut would be reported to nobody, which is the one job this component
 * has. The live region therefore lives *outside* the panel, is always mounted,
 * and is hidden visually rather than removed.
 *
 * The panel is then plainly not a live region. It holds the same sentences, but
 * it is something a reader opens and browses, not something that speaks. One
 * announcer, one browsable copy — announced once, readable whenever.
 */
export function NoticeBell() {
  const { notices, dismiss, dismissAll } = useLiveNotices();
  const [open, setOpen] = useState(false);
  const bell = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Nothing to say and nothing to open. The announcer below stays mounted
  // regardless — it is the thing that must be watching before the first one
  // arrives — but the panel cannot be left open over an empty list.
  useEffect(() => {
    if (notices.length === 0) setOpen(false);
  }, [notices.length]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      setOpen(false);
      // Focus goes back to what opened it. Closing a panel and leaving the
      // caret at the top of the document is how a keyboard reader loses their
      // place on a screen they had not finished with.
      bell.current?.focus();
    };

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || bell.current?.contains(target)) return;

      setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const count = notices.length;

  /*
    Rung on arrival, never on dismissal. A bell that swings as the reader is
    clearing the panel is the interface celebrating them putting work down.
    The key is what restarts the animation: React replaces the element, and a
    replaced element plays its animation from the beginning.
  */
  const [rung, setRung] = useState(0);
  const seen = useRef(count);
  useEffect(() => {
    if (count > seen.current) setRung((rings) => rings + 1);
    seen.current = count;
  }, [count]);

  return (
    <div className="relative">
      {/*
        Outside the panel and always mounted, which is the whole point of it
        being separate. Hidden with the same clip as any other visually hidden
        text — not `display: none`, which would take it out of the
        accessibility tree along with the pixels and silence it.
      */}
      <ul role="log" aria-label="What has happened" className="sr-only">
        {notices.map((notice) => (
          <li key={notice.id}>{notice.what}</li>
        ))}
      </ul>

      <button
        type="button"
        ref={bell}
        onClick={() => setOpen((was) => !was)}
        disabled={count === 0}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        // The count is in the name rather than only in the badge, because the
        // badge is a coloured circle with a number in it and that is a thing
        // you can see or not see.
        aria-label={
          count === 0
            ? "What has happened. Nothing to report."
            : `What has happened. ${count === 1 ? "1 notice" : `${count} notices`}.`
        }
        className="btn btn-quiet relative !min-h-0 px-2 py-1.5 disabled:opacity-40"
      >
        <svg
          key={rung}
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-4 origin-top ${rung > 0 ? "animate-chime" : ""}`}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>

        {count > 0 ? (
          <span
            aria-hidden="true"
            className="animate-pop absolute -top-1.5 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[10px] leading-4 font-bold text-white"
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panel}
          id={panelId}
          className="card animate-pop absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden shadow-lift-high"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line bg-sunken px-3 py-2">
            <p className="text-sm font-semibold tracking-tight">
              {count === 1 ? "1 notice" : `${count} notices`}
            </p>

            {count > 1 ? (
              <button type="button" onClick={dismissAll} className="link text-sm">
                Dismiss all
              </button>
            ) : null}
          </div>

          {/* Bounded, so twenty of them are a scrollable panel rather than a
              column taller than the window. */}
          <ul className="max-h-72 overflow-y-auto">
            {notices.map((notice) => (
              <li
                key={notice.id}
                className="flex items-start justify-between gap-3 border-b border-line px-3 py-2.5 text-sm last:border-0"
              >
                <p className="min-w-0 flex-1 leading-relaxed">
                  <span className="text-ink">{notice.what}</span>{" "}
                  <time dateTime={notice.at} className="text-ink-muted">
                    {timeAgo(notice.at)}
                  </time>
                </p>

                {/* Dismissable, because a notice reports something that happened
                    rather than something to do, and a reader who has taken it in
                    has no other way to put it down. */}
                <button
                  type="button"
                  onClick={() => dismiss(notice.id)}
                  className="link shrink-0 text-xs"
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
