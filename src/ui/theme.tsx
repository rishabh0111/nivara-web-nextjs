"use client";

/**
 * Light, dark, or whatever the machine says.
 *
 * Three settings rather than a switch, because "follow my system" is a real
 * answer and the commonest one — a two-state toggle silently converts every
 * reader into someone who has made a decision, and then keeps them on last
 * spring's choice when their laptop starts going dark at sunset.
 *
 * The choice is written to the document element as `data-theme` and to local
 * storage. The stylesheet does the rest: the media query applies the dark
 * palette to anyone who has not chosen, and the attribute overrides it in
 * either direction for anyone who has.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

const KEY = "nivara-theme";

/** Runs before first paint. See `themeScript` below for why this is a string. */
function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * The one line that has to run before the browser paints anything.
 *
 * Injected into the document head as a blocking inline script, because the
 * alternative is a flash: the server has no idea what this reader chose, so the
 * first paint is the light palette and a `useEffect` correction arrives one
 * frame later as a white flare on a dark screen.
 *
 * Deliberately tiny, and deliberately wrapped in a `try` — private-mode
 * browsers throw on `localStorage` access, and a theme preference is not worth
 * taking the page down for.
 */
export const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(KEY)});if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

function apply(theme: Theme) {
  const root = document.documentElement;

  // Removed rather than set to "system": the attribute's absence is what hands
  // the decision back to the media query, and `data-theme="system"` would match
  // neither rule and quietly strand the reader in light.
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  // Starts as "system" on both server and client so the first client render
  // matches the HTML the server sent. The stored value is read in the effect
  // below; the pre-paint script has already applied it to the document, so
  // there is nothing visible waiting on this.
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (isTheme(stored)) setTheme(stored);
    } catch {
      // No storage available. The control still works for this page's life.
    }
  }, []);

  const choose = useCallback((next: Theme) => {
    setTheme(next);
    apply(next);

    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Same as above: not worth failing the interaction over.
    }
  }, []);

  return [theme, choose];
}

const ORDER: Theme[] = ["system", "light", "dark"];

const LABELS: Record<Theme, string> = { system: "Match system", light: "Light", dark: "Dark" };

const ICONS: Record<Theme, React.ReactNode> = {
  system: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
};

/**
 * One button that cycles the three.
 *
 * A cycle rather than three radio buttons, because this is a preference nobody
 * came here to set — it should cost one press and no reading. The accessible
 * name carries both the state and what pressing does, so it is never a mystery
 * icon: a reader hears "Theme: match system. Switch to light."
 */
export function ThemeToggle() {
  const [theme, choose] = useTheme();

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? "system";

  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={`Theme: ${LABELS[theme].toLowerCase()}. Switch to ${LABELS[next].toLowerCase()}.`}
      title={LABELS[theme]}
      className="btn btn-quiet !min-h-0 px-2 py-1.5"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        {ICONS[theme]}
      </svg>
    </button>
  );
}
