"use client";

/**
 * Whether the viewport is narrow enough for the mobile layout.
 *
 * Read from `matchMedia` rather than a component reaching for `window.innerWidth`
 * on its own, because the number that matters already lives in exactly one
 * place — Tailwind's `sm` utility, 640px — and a second constant here is where
 * the two quietly drift apart. `MOBILE_QUERY` names that number once.
 *
 * This exists for the one thing CSS alone cannot do: choosing between two
 * *different* elements — a horizontal nav and a bottom tab bar — rather than
 * showing or hiding one. `hidden sm:flex` answers "is this element on screen";
 * it cannot answer "which of these two should exist at all", and rendering
 * both and hiding one with CSS would leave a fixed-position bottom bar sitting
 * in the layout, and its links in the tab order, on a desktop nobody asked for
 * it on.
 */
import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 639px)";

export function useIsMobileViewport(): boolean {
  // Starts `false` — the desktop shape — so server and first client paint
  // agree, the same reasoning the theme control's `"system"` default follows.
  // A phone corrects itself one effect later rather than flashing the wrong
  // layout first.
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    // `matchMedia` does not exist in every environment this component renders
    // in — a test environment with no viewport to query is the standing one
    // here. Where it is missing, nothing is watched and the desktop shape is
    // what renders, the same fallback this repository already gives an absent
    // `IntersectionObserver`.
    if (typeof window.matchMedia !== "function") return;

    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setNarrow(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return narrow;
}
