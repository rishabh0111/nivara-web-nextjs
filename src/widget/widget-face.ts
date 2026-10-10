/**
 * Work Sans, for a Widget on a page that has never heard of it.
 *
 * The Widget has to look like Nivara on a stranger's site, and the one face
 * the system uses cannot be assumed there. Two obvious routes are closed:
 *
 * - An `@font-face` rule in the shadow root's stylesheet is ignored by Chrome,
 *   which only honours font faces declared in the document.
 * - Shipping the face inside the bundle would cost every visitor of every
 *   Tenant 50 kB before anybody asked for support. The bundle's budget
 *   (`scripts/check-widget-size.ts`) exists to stop exactly that.
 *
 * So the face is registered through the CSS Font Loading API, under a family
 * name nobody else will use, from this application's own origin (the one the
 * Snippet's `src` points at), and only once the Visitor has asked for support:
 * on the first press of the Launcher, or at boot when a session from an
 * earlier page is already held. Before that the Launcher is set in the system
 * face named after it in `widget-styles.ts`, which is a deliberate fallback,
 * and a host page whose Content Security Policy refuses the font keeps that
 * fallback everywhere. Nothing breaks either way: the family only lists a face
 * that may or may not arrive.
 *
 * This is the one thing the Widget adds to the host document outside its own
 * element, and it adds nothing a host page's own rules could select.
 */

/** The family the Widget's stylesheet asks for. Prefixed so no host page has one. */
export const WIDGET_FACE = "Nivara Work Sans";

/** Served from `public/fonts/`, beside the OFL licence it is distributed under. */
const FACE_PATH = "/fonts/work-sans-latin.woff2";

/** The latin subset's range, as Google Fonts serves this file. */
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

export type WidgetFace = {
  /** Fetches the face, once. Safe to call on every press. */
  wanted(): void;
};

export function widgetFace(script: HTMLScriptElement | null): WidgetFace {
  let asked = false;

  return {
    wanted() {
      if (asked) return;
      asked = true;

      // No `src` (a test's detached Snippet) or no Font Loading API (jsdom, a
      // very old browser): the fallback face is the whole answer.
      const src = script?.src;
      if (!src || typeof FontFace === "undefined" || !document.fonts) return;

      let url: string;
      try {
        url = new URL(FACE_PATH, src).href;
      } catch {
        return;
      }

      const face = new FontFace(WIDGET_FACE, `url("${url}") format("woff2")`, {
        weight: "300 500",
        style: "normal",
        display: "swap",
        unicodeRange: LATIN,
      });
      document.fonts.add(face);
      // A refusal (CSP, offline) is the fallback face, not an error on
      // somebody else's console.
      face.load().catch(() => {});
    },
  };
}
