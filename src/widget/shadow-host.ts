/**
 * Where the Widget lives on somebody else's page.
 *
 * One element appended to the host document, with a shadow root on it and the
 * Widget's whole appearance inside. Nothing else is added to that document —
 * no stylesheet in its head, no class on its body, no global name — because
 * every one of those is a thing a Tenant's own site could collide with, and the
 * collision would show up on their site rather than in our tests.
 *
 * An iframe would isolate more, and is refused: a frame served from this
 * application's origin presents *this* origin on every request, so the Tenant
 * origin allowlist would have to admit it and would then protect nothing. See
 * `docs/adr/0003-the-widget-renders-in-the-host-document.md`.
 */
import { widgetStyles } from "./widget-styles";

/**
 * A hyphen, so the parser treats it as an unknown custom element: no user-agent
 * styles, no meaning to a screen reader, and no chance of matching a host
 * page's `div` rules.
 */
export const WIDGET_HOST_TAG = "nivara-widget";

export type WidgetHost = {
  /** The element in the host page's document. Everything else is behind it. */
  element: HTMLElement;
  root: ShadowRoot;
  /** Where the Widget renders. Inside the root, never the root itself. */
  container: HTMLElement;
};

export function mountWidgetHost(): WidgetHost {
  const existing = document.querySelector(WIDGET_HOST_TAG);
  if (existing) {
    // Two copies of the Snippet on one page is an install mistake, not a
    // request for two Widgets. Saying so is cheaper than the bug it becomes.
    throw new Error("The Nivara widget is already on this page.");
  }

  const element = document.createElement(WIDGET_HOST_TAG);

  // Open rather than closed. A closed root hides the Widget from the Tenant
  // whose page it is running on, which buys nothing — the script is theirs to
  // read either way — and costs them any chance of debugging it.
  const root = element.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = widgetStyles();
  root.append(style);

  const container = document.createElement("div");
  container.className = "nvw";
  root.append(container);

  document.body.append(element);

  return { element, root, container };
}
