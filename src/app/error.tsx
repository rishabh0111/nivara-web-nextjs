"use client";

/**
 * The screen a thrown render lands on.
 *
 * Everything authenticated here is client-rendered off live data, so a
 * component that throws while rendering takes its whole tree with it — and
 * without this the reader gets a blank white page and no way back. `ReadView`
 * already handles the read that was *refused*; this is the one that was never
 * meant to happen.
 *
 * What it deliberately does not do is show the reader the error. A message
 * thrown from a component is written for whoever is reading the stack, not for
 * whoever is trying to answer a ticket, and in production Next replaces it with
 * a digest anyway. The digest is shown, because it is the one string that ties
 * what the reader saw to what the server logged.
 */
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The one place this application would wire up a reporter. Left as the
    // console until there is somewhere to send it — a seam, not a stub.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-danger-wash text-danger"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
          >
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </span>

        <h1 className="text-2xl font-bold tracking-tight">This screen stopped working</h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Something went wrong rendering this page. Nothing you did caused it and nothing you had
          open was sent anywhere.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {/* Re-renders the segment that threw rather than reloading the
              document, so a reader who was signed in still is. */}
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>

          {/*
            A document navigation, not a client one, and the lint rule is
            waived deliberately. This screen exists because the React tree threw;
            routing within that same tree is asking the broken thing to carry
            the reader out of it. A full load discards whatever state caused it.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="btn btn-quiet">
            Start again
          </a>
        </div>

        {error.digest ? (
          <p className="mt-7 border-t border-line pt-5 text-xs text-ink-faint">
            If you report this, quote{" "}
            <code className="font-mono text-ink-muted">{error.digest}</code>
          </p>
        ) : null}
      </div>
    </main>
  );
}
