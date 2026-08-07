import { act } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SessionStore } from "@/session/store";

import { bootWidget, type BootedWidget } from "./boot";
import { WIDGET_HOST_TAG } from "./shadow-host";
import {
  baseUrl,
  conversations,
  minted,
  refused,
  snippet as makeSnippet,
  widgetSession,
} from "./widget.fixtures";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
let booted: BootedWidget | undefined;

beforeEach(() => {
  store = new SessionStore();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  // A fresh browser on a fresh page. The Widget writes its session into the
  // host page's storage so a Visitor's conversation survives navigation, and
  // one test's session is not the next one's Visitor.
  sessionStorage.clear();
});

afterEach(() => {
  booted?.unmount();
  booted = undefined;
});

/** The Snippet, pasted where a Tenant would paste it. */
function snippet(attributes?: Record<string, string>) {
  const script = makeSnippet(attributes);
  document.head.append(script);
  return script;
}

function boot(script = snippet()) {
  let widget: BootedWidget;

  // The first paint is flushed here rather than awaited by every caller: a
  // Tenant's page gets a Launcher from one script tag, and nothing about that
  // is asynchronous from their side.
  act(() => {
    widget = bootWidget({ script, session: widgetSession(store) });
  });

  booted = widget!;
  return booted;
}

/** Queries go through the shadow root, because nothing is reachable without it. */
function inside(widget: BootedWidget, selector: string) {
  return widget.host.root.querySelector(selector);
}

function launcher(widget: BootedWidget) {
  const button = inside(widget, ".nvw-launcher");
  if (!(button instanceof HTMLButtonElement)) throw new Error("No launcher was rendered.");
  return button;
}

/**
 * No `userEvent`, and no `screen`: both reach through `document`, and nothing
 * the Widget renders is in the document. Everything here goes through the
 * shadow root, which is the point.
 */
async function press(button: HTMLButtonElement) {
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
}

describe("one script tag on somebody else's page", () => {
  it("puts a Launcher on it", () => {
    const widget = boot();

    expect(launcher(widget).textContent).toMatch(/chat with support/i);
  });

  it("adds exactly one element to the host document and nothing else", () => {
    const before = document.body.childNodes.length;

    const widget = boot();

    expect(document.body.childNodes.length).toBe(before + 1);
    expect(document.querySelectorAll(WIDGET_HOST_TAG)).toHaveLength(1);
    expect(widget.host.element.shadowRoot).toBe(widget.host.root);
  });

  it("mints nothing until the Visitor asks for support", () => {
    // `onUnhandledRequest: "error"` and no handlers: any call fails the test.
    boot();

    expect(store.get("widget")).toBeUndefined();
  });

  it("says so rather than half-installing when the Snippet names no Tenant", () => {
    expect(() => boot(snippet({}))).toThrow(/data-tenant-id/);
    expect(document.querySelector(WIDGET_HOST_TAG)).toBeNull();
  });

  it("refuses to run twice when a Tenant pastes the Snippet twice", () => {
    boot();

    expect(() => bootWidget({ script: snippet(), session: widgetSession(store) })).toThrow(
      /already on this page/i,
    );
    expect(document.querySelectorAll(WIDGET_HOST_TAG)).toHaveLength(1);
  });
});

describe("the boundary between the Widget and the page it is on", () => {
  /**
   * The reset is the one rule standing between this Widget and a Tenant's
   * stylesheet. A shadow root blocks their *selectors*; it does not block
   * inheritance, so colour, font and line height cross the host element unless
   * something stops them. This test exists to fail if that rule is ever removed
   * as redundant, which is exactly how it would be removed.
   *
   * It asserts on the rule rather than on a computed value because jsdom
   * resolves no styles across a shadow boundary at all — it applies the host
   * page's rules straight through and ignores the shadow root's own. A computed
   * assertion here would be measuring jsdom, not the Widget.
   */
  it("resets every inherited property at the boundary", () => {
    const widget = boot();
    const styles = widget.host.root.querySelector("style")?.textContent ?? "";

    expect(styles).toMatch(/:host\s*\{[^}]*\ball\s*:\s*initial\b/);
  });

  /**
   * The second half of the same defence. `all: initial` loses to an
   * `!important` rule a host page aims at the host element, and no reset wins
   * that. What does win is that an outer selector cannot match anything inside
   * the root — so every visible part states its own font and colour instead of
   * inheriting one.
   */
  it("states its own typography rather than inheriting the host page's", () => {
    const widget = boot();
    const styles = widget.host.root.querySelector("style")?.textContent ?? "";
    const root = styles.slice(
      styles.indexOf(".nvw {"),
      styles.indexOf("}", styles.indexOf(".nvw {")),
    );

    for (const property of ["font-family", "font-size", "line-height", "color"]) {
      expect(root).toContain(`${property}:`);
    }
  });

  it("leaks no style onto the host page", () => {
    const widget = boot();

    expect(document.head.querySelector("style")).toBeNull();
    expect(document.head.querySelector("link[rel=stylesheet]")).toBeNull();
    // Every rule the Widget has is inside the root, where the host page's own
    // stylesheet cannot see it and their designer never has to.
    expect(widget.host.root.querySelectorAll("style")).toHaveLength(1);
  });

  it("puts nothing of its own in the host page's reach", () => {
    const widget = boot();

    expect(document.querySelector(".nvw")).toBeNull();
    expect(document.querySelector(".nvw-launcher")).toBeNull();
    expect(document.querySelector("button")).toBeNull();
    expect(inside(widget, ".nvw-launcher")).not.toBeNull();
  });

  it("takes itself off the page completely when unmounted", () => {
    const widget = boot();
    widget.unmount();
    booted = undefined;

    expect(document.querySelector(WIDGET_HOST_TAG)).toBeNull();
    expect(document.body.innerHTML).not.toContain("nvw");
  });
});

describe("opening the Launcher", () => {
  it("mints a session from an origin the Tenant listed, and opens", async () => {
    server.use(
      http.post(`${baseUrl}/widget/sessions`, minted),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
    );

    const widget = boot();
    await press(launcher(widget));

    expect(store.get("widget")?.accessToken).toBe("nvw_1");
    expect(inside(widget, "[aria-label='Support']")).not.toBeNull();
  });

  /**
   * The anti-Lifting gate, from the Visitor's side. A Snippet dropped on a site
   * the Tenant does not control gets no session, so no conversation from that
   * page can land in that Tenant's queue.
   */
  it("is refused from an origin nobody listed, and says so without offering a retry", async () => {
    server.use(http.post(`${baseUrl}/widget/sessions`, refused));

    const widget = boot();
    await press(launcher(widget));

    expect(store.get("widget")).toBeUndefined();
    const alert = inside(widget, "[role=alert]");
    expect(alert?.textContent).toMatch(/not available on this site/i);
    expect(inside(widget, ".nvw-launcher")).toBeNull();
  });

  /**
   * The refusal is the same words whether the origin is unlisted, the Tenant
   * unknown, or the Tenant has no origins configured — the API refuses all
   * three identically so that the answer cannot be used to find out which
   * Tenants are real, and a Surface that distinguished them would give that
   * back.
   */
  it("says the same thing whichever way the gate refused", async () => {
    const answers = [
      { code: "forbidden", status: 403 },
      { code: "not_found", status: 404 },
    ] as const;
    const shown = new Set<string>();

    for (const answer of answers) {
      server.use(
        http.post(`${baseUrl}/widget/sessions`, () =>
          HttpResponse.json(
            { error: { code: answer.code, message: `refused: ${answer.code}` } },
            { status: answer.status },
          ),
        ),
      );

      const widget = boot();
      await press(launcher(widget));
      shown.add(inside(widget, "[role=alert]")?.textContent ?? "");

      widget.unmount();
      booted = undefined;
    }

    expect(shown.size).toBe(1);
    expect([...shown][0]).not.toMatch(/forbidden|not_found|refused:/);
  });

  /**
   * The other half of that distinction. A sleeping instance or a dropped
   * request is weather, and a Widget that treated it the way it treats the gate
   * would take support off a Tenant's page for the rest of the session over one
   * request that did not land.
   */
  it("keeps the Launcher when the mint merely failed, and succeeds on a second press", async () => {
    server.use(
      http.post(`${baseUrl}/widget/sessions`, () => HttpResponse.error()),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
    );

    const widget = boot();
    await press(launcher(widget));

    expect(inside(widget, "[role=alert]")?.textContent).toMatch(/reach/i);
    const again = launcher(widget);
    expect(again.disabled).toBe(false);

    server.use(http.post(`${baseUrl}/widget/sessions`, minted));
    await press(again);

    expect(store.get("widget")?.accessToken).toBe("nvw_1");
    expect(inside(widget, "[aria-label='Support']")).not.toBeNull();
    expect(inside(widget, "[role=alert]")).toBeNull();
  });

  it("reopens on the session it already holds rather than minting a second", async () => {
    let mints = 0;
    server.use(
      http.post(`${baseUrl}/widget/sessions`, () => {
        mints += 1;
        return minted();
      }),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
    );

    const widget = boot();
    await press(launcher(widget));

    const close = inside(widget, ".nvw-close");
    if (!(close instanceof HTMLButtonElement)) throw new Error("No close button was rendered.");
    await press(close);
    await press(launcher(widget));

    expect(inside(widget, "[aria-label='Support']")).not.toBeNull();
    expect(mints).toBe(1);
  });

  it("holds the Launcher while the mint is out, so it cannot be pressed twice", async () => {
    let mints = 0;
    server.use(
      http.post(`${baseUrl}/widget/sessions`, async () => {
        mints += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return minted();
      }),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
    );

    const widget = boot();
    const button = launcher(widget);
    await press(button);

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(mints).toBe(1);
  });
});
