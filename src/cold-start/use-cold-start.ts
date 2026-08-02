"use client";

import { useEffect, useState } from "react";

import { requestActivity, type RequestActivity } from "@/api/activity";

import { coldStartPhase, msUntilNextPhase, type ColdStartPhase } from "./phase";

/**
 * The Cold-start phase of whatever the request layer is currently waiting on.
 *
 * Timers run only while something is outstanding, and are set to land on the
 * next threshold rather than polling — a permanent tick would be a busy loop
 * asking a question whose answer cannot change.
 */
export function useColdStartPhase(activity: RequestActivity = requestActivity): ColdStartPhase {
  const [phase, setPhase] = useState<ColdStartPhase>("idle");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const evaluate = () => {
      const waited = activity.longestWaitMs();
      setPhase(coldStartPhase(waited));

      if (timer !== undefined) clearTimeout(timer);
      const next = msUntilNextPhase(waited);
      timer = next === undefined ? undefined : setTimeout(evaluate, next);
    };

    const unsubscribe = activity.subscribe(evaluate);
    evaluate();

    return () => {
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [activity]);

  return phase;
}
