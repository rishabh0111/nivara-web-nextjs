"use client";

/**
 * What just happened, said where the reader is looking.
 *
 * This exists because of one specific failure: the outcome of a write was
 * announced beside the control that made it, and on a Ticket screen that
 * control can be most of a page below what the reader is reading. A reply that
 * landed, a state that moved, an assignment that was refused — all correctly
 * reported, all off-screen.
 *
 * It does **not** replace the inline regions wholesale. Where the outcome is
 * about the thing under the reader's cursor — a field that was rejected, a form
 * that refused — beside the control is still the right place, and moving it into
 * a corner would be worse. What comes here is what the reader has already
 * scrolled away from.
 *
 * ## Announcing it exactly once
 *
 * The rule this file is built around: a message that appears here must not also
 * be a live region somewhere else. Two live regions carrying the same sentence
 * is a screen reader saying it twice, which is more confusing than saying it in
 * the wrong place. Callers that toast an outcome render their inline copy as
 * plain text.
 *
 * A failure takes `role="alert"`, which interrupts; an outcome takes the polite
 * region and waits its turn. That is the actual difference between them — one
 * means the reader's next action is wrong, the other is a receipt.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type ToastKind = "outcome" | "failure";

type Toast = { id: number; kind: ToastKind; text: string };

/** How long a receipt stays. A failure does not leave on its own. */
const OUTCOME_MS = 6000;

export type Toaster = {
  /** Says something happened. Returns nothing — a toast is not a handle. */
  show: (kind: ToastKind, text: string) => void;
};

const SILENT: Toaster = { show: () => {} };

const ToastContext = createContext<Toaster>(SILENT);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((held) => held.filter((one) => one.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, text: string) => {
      const id = (next.current += 1);

      setToasts((held) => {
        // The same sentence twice in a row is one event reported twice — a
        // retry, or two controls reporting the same write. Replacing rather
        // than stacking keeps the corner from filling with duplicates.
        const withoutTwin = held.filter((one) => one.text !== text);
        return [...withoutTwin, { id, kind, text }];
      });

      // A failure stays until it is dismissed. It is the only thing here that
      // says the reader's understanding of the screen is wrong, and a sentence
      // like that should not time out while they are reading something else.
      if (kind === "outcome") setTimeout(() => dismiss(id), OUTCOME_MS);
    },
    [dismiss],
  );

  const toaster = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={toaster}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToaster(): Toaster {
  return useContext(ToastContext);
}

function ToastRegion({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    /*
      Bottom right, and above the cold-start notice rather than under it — that
      one is pinned across the foot of the window and would otherwise cover
      whatever landed here last.

      `pointer-events-none` on the stack with it restored on each toast, so the
      empty region never swallows a click aimed at the page behind it.
    */
    <div
      // Lifted clear of the bottom tab bar on a narrow viewport — that bar is
      // fixed to the same edge, and a toast landing under it would be a toast
      // nobody saw. `env(safe-area-inset-bottom)` on top of that for a phone
      // with a home indicator, which the tab bar already accounts for but a
      // toast reaching past it would not.
      className="pointer-events-none fixed right-4 bottom-20 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 sm:bottom-4"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      // Rendered whether or not it holds anything, so a screen reader is
      // watching before the first one arrives. A live region inserted at the
      // same moment as its content is frequently never announced.
      aria-live="polite"
      aria-label="What just happened"
      role="region"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          // A failure interrupts; a receipt waits its turn. `role="alert"`
          // carries its own assertive live semantics, which is why it is not
          // also wrapped in one.
          role={toast.kind === "failure" ? "alert" : undefined}
          className={`animate-rise pointer-events-auto flex items-start gap-2.5 rounded-card border px-3.5 py-3 text-sm shadow-lift-high ${
            toast.kind === "failure"
              ? "border-danger/40 bg-danger-wash text-danger"
              : "border-line bg-surface text-ink"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`mt-0.5 size-4 shrink-0 ${toast.kind === "failure" ? "" : "text-calm"}`}
          >
            {toast.kind === "failure" ? (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5M12 16h.01" />
              </>
            ) : (
              <path d="m20 6-11 11-5-5" />
            )}
          </svg>

          <p className="min-w-0 flex-1 leading-relaxed">{toast.text}</p>

          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss"
            className="-m-1 shrink-0 rounded p-1 text-ink-faint transition-colors hover:text-ink"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="size-4"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
