"use client";

/**
 * The last resort: the root layout itself threw.
 *
 * This replaces the whole document, which is why it renders its own `<html>`
 * and `<body>` — at this point the layout that would have provided them is the
 * thing that failed. That is also why it carries its own colours inline rather
 * than in classes: the stylesheet is imported by the layout, and a page that
 * only appears when the layout is broken cannot assume the layout's stylesheet
 * arrived.
 *
 * Deliberately plain. Everything in `error.tsx` is available at the segment
 * level; the only job here is to be readable with no CSS, no fonts, and no
 * providers.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          lineHeight: 1.5,
          color: "#131a26",
          background: "#f6f7f9",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem", letterSpacing: "-0.02em" }}>
            Nivara Desk could not start
          </h1>

          <p style={{ margin: "0 0 1.75rem", color: "#5a6675" }}>
            Something failed before the application could load. Reloading usually clears it.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              font: "inherit",
              fontWeight: 600,
              color: "#ffffff",
              background: "#1d63c4",
              border: 0,
              borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem",
              cursor: "pointer",
            }}
          >
            Reload
          </button>

          {error.digest ? (
            <p style={{ marginTop: "1.75rem", fontSize: "0.75rem", color: "#8b95a3" }}>
              Reference {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
