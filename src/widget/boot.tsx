/**
 * One script tag, and a Launcher appears.
 *
 * Everything a Tenant has to do is on their side of this function: paste the
 * Snippet. Everything after it is here — read the Tenant off the Snippet, put a
 * shadow root on their page, take up whatever the last page left, and render
 * into it.
 *
 * Nothing is fetched at this point. Booting costs the host page one script; the
 * session is minted when the Visitor presses the Launcher, or resumed from what
 * a previous page on this site wrote down.
 */
import { createRoot, type Root } from "react-dom/client";

import { QueryProvider } from "@/api/query-client";

import { mountWidgetHost, type WidgetHost } from "./shadow-host";
import { resumeWidget, type WidgetMemory } from "./widget-memory";
import { keepWidgetSessionFresh } from "./widget-renewal";
import { readWidgetConfig } from "./widget-config";
import { createWidgetSession, type WidgetSession } from "./widget-session";
import { Widget } from "./widget";

export type BootedWidget = {
  host: WidgetHost;
  session: WidgetSession;
  /** Takes the Widget back off the page. For tests, and for a Tenant's SPA. */
  unmount(): void;
};

export function bootWidget({
  script,
  session,
  memory,
}: {
  /** The Snippet. `document.currentScript`, captured before anything async. */
  script: HTMLScriptElement | null;
  session?: WidgetSession;
  memory?: WidgetMemory;
}): BootedWidget {
  const config = readWidgetConfig(script);
  const host = mountWidgetHost();
  const held = session ?? createWidgetSession(config.tenantId);

  // Before the first render, so the Widget paints where the Visitor left rather
  // than painting a Launcher and then replacing it with their conversation.
  const resumed = resumeWidget(config.tenantId, held, memory);

  // After the resume, so a credential taken back up with minutes left on it is
  // renewed on this page load rather than on the next one. Started here rather
  // than from a view, because the session outlives every view of it: a Visitor
  // with the panel closed still has a conversation to come back to.
  const stopRenewing = keepWidgetSessionFresh(held);

  const root: Root = createRoot(host.container);
  root.render(
    // The Widget's own cache, in its own tree. It is the same store the other
    // Surfaces use — one cursor-paginated read of a collection, not a second
    // hand-rolled one written because this bundle is small.
    <QueryProvider>
      <Widget session={held} resumed={resumed} />
    </QueryProvider>,
  );

  return {
    host,
    session: held,
    unmount() {
      resumed.stop();
      stopRenewing();
      // The connection outlives the tree that opened it, exactly as the staff
      // one outlives a screen — so taking the Widget off the page is what has
      // to close it, or a Tenant's SPA route change leaves a socket behind.
      held.stop();
      root.unmount();
      host.element.remove();
    },
  };
}
