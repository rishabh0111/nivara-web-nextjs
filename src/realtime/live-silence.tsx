"use client";

/**
 * A Surface saying, in words, that it has stopped being kept current.
 *
 * This is the last thing recovery is for. Everything else about a dropped
 * connection is arranged so that a User never learns it happened — the Rooms
 * come back on their own, from their own resume points, and what was missed
 * arrives. This is what is said when that has been tried and has failed, and it
 * exists because the alternative is a screen that looks exactly like a working
 * one and is quietly hours out of date. A User acting on that is the worst
 * outcome this application has.
 *
 * Held by the Surface rather than by the screen that happens to be open, for the
 * same reason the notice log is: the connection is one thing, and what has
 * stopped is every live view on it.
 *
 * Rendered whether or not it has anything to say. A live region inserted at the
 * same moment as its content is frequently never announced at all — and the
 * reader who cannot see the screen stop moving is exactly the reader this is
 * for. It says nothing, rather than saying the connection is fine, because a
 * connection is fine constantly and saying so is noise a reader learns to skip.
 */
import { useCallback, useSyncExternalStore } from "react";

import type { LiveHealth } from "./connection";
import type { LiveConnection } from "./live-connection";

/** Whether this Surface is still being kept current, as it changes. */
export function useLiveHealth(live: LiveConnection): LiveHealth {
  const subscribe = useCallback((changed: () => void) => live.watch(changed), [live]);
  const health = useCallback(() => live.health(), [live]);

  // Nothing is claimed on the server: there is no connection there to have
  // failed, and a page that rendered this banner before hydration would be
  // reporting a browser it does not have.
  return useSyncExternalStore(subscribe, health, () => "live");
}

export function LiveSilence({ live }: { live: LiveConnection }) {
  const health = useLiveHealth(live);

  return (
    <p
      role="status"
      aria-label="Whether this screen is receiving updates"
      className="text-sm text-urgent"
    >
      {health === "silent"
        ? // No instruction to reload. The browser is still trying, and it comes
          // back on its own the moment it can — what a User needs is to know
          // not to trust what is in front of them until it does.
          "This screen has stopped receiving updates, so what it shows may be out of date."
        : null}
    </p>
  );
}
