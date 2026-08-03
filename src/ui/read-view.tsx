"use client";

import { describeError } from "@/api/query";

/**
 * The three things any read on a screen can be: still arriving, refused, or
 * answered.
 *
 * Written once because every surface needs exactly this, and because what a
 * reader is told while they wait and what they are told when it fails are
 * decisions this application makes in one place — announced rather than merely
 * shown, and a refusal in the API's own words rather than a shrug.
 *
 * Per read rather than per screen: a section that failed takes down its own
 * contents and leaves the rest of the page readable.
 *
 * A Cold start is not handled here — it is named once, for the whole
 * application, from the request layer's own record of what is outstanding.
 */
export function ReadView<Value>({
  read,
  waiting,
  children,
}: {
  read: { value: Value | undefined; isPending: boolean; error: unknown };
  /** What is being waited for, in the reader's words. */
  waiting: string;
  children: (value: Value) => React.ReactNode;
}) {
  if (read.isPending) {
    return (
      <p role="status" className="flex items-center gap-2.5 text-sm text-ink-muted">
        {/*
          Decorative, and marked as such. The sentence beside it already says
          what is happening; a screen reader announcing a spinner as well would
          be telling the reader twice.
        */}
        <span
          aria-hidden="true"
          className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-accent"
        />
        {waiting}
      </p>
    );
  }

  // A read that is neither pending nor errored and has nothing is not a state
  // the cache produces; treating it as a failure is the only honest thing left,
  // and it keeps the caller from having to handle a fourth case that cannot
  // happen.
  if (read.error || read.value === undefined) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger-wash px-3.5 py-3 text-sm leading-relaxed text-danger"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="mt-0.5 size-4 shrink-0"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5M12 16h.01" />
        </svg>
        {describeError(read.error)}
      </p>
    );
  }

  return <>{children(read.value)}</>;
}
