"use client";

/**
 * The slice a User is working, held where it survives them closing the tab.
 *
 * Component state answers "what is on screen"; the address bar answers "what am
 * I looking at" — and only the second is still there after a reload or in a
 * message to a colleague. So the URL is the record, and the React state is a
 * copy of it kept in step, in that order: what a reader chose is written to the
 * address the moment they choose it, and what an address says is what the queue
 * opens onto.
 *
 * Read straight off `window.location` rather than through the router's hooks.
 * Everything behind a credential is client-rendered here — the browser holds
 * the token and calls the API itself — so this never runs on a server, and the
 * native History API is what the App Router itself defers to for an address
 * that changes without navigating anywhere.
 */
import { useCallback, useEffect, useState } from "react";

import type { QueueSlice } from "./queue-slice";
import { fromQueueSearch, toQueueSearch } from "./queue-url";

export function useQueueSlice(): [QueueSlice, (slice: QueueSlice) => void] {
  // Read once, as the first render — not in an effect afterwards. An effect
  // would let the whole queue be asked for and drawn before the filters landed,
  // which is a request nobody wanted and a flash of work the reader had
  // deliberately narrowed away.
  const [slice, setSlice] = useState<QueueSlice>(() => fromQueueSearch(window.location.search));

  const choose = useCallback((chosen: QueueSlice) => {
    setSlice(chosen);

    // Replaced, not pushed. Narrowing a queue is editing one view rather than
    // visiting a series of them, and a history entry per settled keystroke
    // would bury wherever the reader came from under their own filters.
    window.history.replaceState(null, "", `${window.location.pathname}${toQueueSearch(chosen)}`);
  }, []);

  // The address can also change without this component being rebuilt — a Back
  // out of somewhere else and into a queue this once wrote. Reading it again is
  // what keeps the two from disagreeing about which slice is on screen.
  useEffect(() => {
    const restore = () => setSlice(fromQueueSearch(window.location.search));

    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  return [slice, choose];
}
