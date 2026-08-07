/**
 * Keeping a Visitor's session alive, ahead of its own expiry.
 *
 * This is the one Surface that renews on a clock, and the reason is in what it
 * has to renew *with*. The Portal and the Dashboard present an httpOnly refresh
 * cookie the API set on a first-party origin; that cookie outlives the access
 * token, so a refused request is a recoverable moment and reacting to one is
 * both correct and cheaper than guessing at a lifetime. A Widget session
 * renews by presenting the credential it holds. There is no grace period and
 * nothing behind it, so a credential that has lapsed cannot be exchanged for
 * another — the refusal is the end, not a prompt.
 *
 * So this is not a second renewal policy competing with the reactive one. The
 * reactive path is still there and still single-flight; this only makes sure
 * the moment it exists for does not arrive.
 */
import type { WidgetSession } from "./widget-session";

/**
 * How long before expiry the credential is replaced.
 *
 * A minute, against a thirty-minute credential. Long enough to cover a
 * renewal on a bad connection, a sleeping API answering slowly, and the
 * request that started while the old one was still fine; short enough that a
 * Visitor who asks one question and leaves costs the API one renewal at most.
 */
export const RENEW_LEAD_MS = 60_000;

/**
 * Renews this session for as long as it is held, and stops when it is not.
 *
 * Driven off the session changing rather than off a loop, so one arrangement
 * covers every way the credential can move: minted by the Launcher, taken back
 * up from the host page's storage with whatever life it has left, replaced by
 * this renewal, or replaced by the reactive one underneath a request.
 */
export function keepWidgetSessionFresh(session: WidgetSession): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  /**
   * The expiry the pending renewal is for.
   *
   * The store announces every change on every Surface, most of which say
   * nothing about when this credential runs out. Without this, a Visitor
   * signed into the Portal in the same browser would push the Widget's renewal
   * further away with every one of their own.
   */
  let scheduledFor: number | undefined;

  function cancel(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    scheduledFor = undefined;
  }

  function schedule(): void {
    const held = session.current();

    // No session is nothing to keep. This is also how a renewal that was
    // refused stops the next one: the session client clears the credential, and
    // what arrives here is the change that says so.
    if (!held) return cancel();
    if (held.expiresAt === scheduledFor) return;

    cancel();
    scheduledFor = held.expiresAt;

    // Never negative, and zero is a real answer: a session resumed from the
    // host page's storage can already be inside the window, and a Visitor who
    // came back to the tab should not wait to find that out.
    timer = setTimeout(
      () => {
        timer = undefined;
        scheduledFor = undefined;

        // Not awaited and its answer not read. Success is a credential in the
        // store, which brings this function back round; failure is the store
        // cleared, which is the same route. Both are already handled by being
        // changes to the session.
        void session.renew();
      },
      Math.max(0, held.expiresAt - RENEW_LEAD_MS - Date.now()),
    );
  }

  schedule();
  const unsubscribe = session.subscribe(schedule);

  return () => {
    unsubscribe();
    cancel();
  };
}
