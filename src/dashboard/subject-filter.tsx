"use client";

/**
 * Finding a Ticket by what it is called — and saying plainly what that does and
 * does not cover.
 *
 * **This is not a search.** `GET /tickets` takes a closed allowlist of
 * parameters — state, priority, source, assignee, contact, two dates and a sort
 * — and an unknown one is a 400 rather than something quietly ignored. There is
 * no text parameter to send, so nothing here can ask the server about subjects.
 *
 * What it can do is narrow what has already arrived, and the whole design of
 * this control is about not letting that be mistaken for the other thing. It is
 * labelled "filter" rather than "search"; the count it reports is of loaded
 * tickets rather than of tickets; and when there are pages that have not been
 * fetched it says so, every time, beside the result. A reader who types a
 * subject they know exists and gets nothing back has to be told the difference
 * between "no such ticket" and "not on the pages you are holding".
 *
 * The honest fix is a `q` parameter on the API. Until then this is the most a
 * client can offer without lying about what it looked at.
 */
import { useId } from "react";

export function SubjectFilter({
  value,
  onChange,
  /** How many have arrived so far, across every page fetched. */
  loaded,
  /** How many of those the current text matches. */
  matched,
  /** Whether the API says there are pages nobody has asked for yet. */
  more,
}: {
  value: string;
  onChange: (value: string) => void;
  loaded: number;
  matched: number;
  more: boolean;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const filtering = value.trim() !== "";

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="sr-only">
        Filter loaded tickets by subject
      </label>

      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>

        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Filter loaded tickets by subject"
          aria-describedby={noteId}
          className="input pl-9"
        />
      </div>

      {/*
        Rendered whether or not it has anything to say, so a screen reader is
        watching it before the first count lands in it — and named, because a
        bare number announced with no context is worse than silence.
      */}
      <p id={noteId} role="status" className="text-xs leading-relaxed text-ink-muted">
        {filtering ? (
          <>
            {matched === 0
              ? `Nothing among the ${loaded.toLocaleString("en-US")} loaded tickets matches.`
              : `${matched.toLocaleString("en-US")} of ${loaded.toLocaleString("en-US")} loaded tickets match.`}
            {/* The part that keeps this honest. Said every time there is more,
                not once on first use — the reader who most needs it is the one
                who has typed a subject they are sure exists. */}
            {more
              ? " This only filters tickets already loaded. Load more to widen the search."
              : null}
          </>
        ) : null}
      </p>
    </div>
  );
}
