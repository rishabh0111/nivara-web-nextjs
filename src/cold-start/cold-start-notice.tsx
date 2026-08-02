"use client";

import { useEffect } from "react";

import { getApiClient } from "@/api/client";

import { useColdStartPhase } from "./use-cold-start";

/**
 * Two mechanisms, layered.
 *
 * The probe fires on load, so the very first paint can name a Cold start before
 * anyone has acted. It goes through the request layer like everything else, so
 * its own slowness is the signal — there is no separate Cold-start handler to
 * call and no way for the two to disagree.
 *
 * The phase covers any request outstanding past a threshold, whenever it
 * happens. The API can go back to sleep later in a long session, long after the
 * probe has finished, and that wait deserves the same words.
 *
 * Neither gates anything. This is a banner in the corner: shell, navigation and
 * sign-in stay usable throughout. A blocking wake-up screen is a spinner with
 * better copy.
 */
export function ColdStartNotice() {
  const phase = useColdStartPhase();

  useEffect(() => {
    // Fire and forget. Nothing waits on the answer, and a failure here is not
    // this component's to report — a surface that needs the API will say so.
    void getApiClient().resource("/health", "get", {});
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Sits above the bottom tab bar on a narrow viewport rather than under or
      // behind it — both are fixed to the same edge, and the tab bar is what a
      // reader needs most while the API is waking up, not less.
      className="fixed inset-x-0 bottom-16 z-50 border-t border-urgent/30 bg-urgent-wash px-4 py-3 text-sm text-ink shadow-lift-high sm:bottom-0"
    >
      {phase === "acknowledged" ? (
        <p>Waiting for the API…</p>
      ) : (
        <p>
          <strong className="font-medium">The API is waking up.</strong> It runs on a free instance
          that sleeps when idle, and the first request after that can take up to a minute. Nothing
          is broken — this page stays usable, and the wait ends on its own.
        </p>
      )}
    </div>
  );
}
