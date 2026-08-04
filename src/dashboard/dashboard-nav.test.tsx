import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionStore } from "@/session/store";

import {
  baseUrl,
  dashboardApi,
  principal,
  renderDashboard,
  signedInStore,
  ticket,
} from "./dashboard.fixtures";

/**
 * Two navs sharing one set of destinations, and the one rule that keeps them
 * from disagreeing: exactly one of them is ever actually in the document.
 *
 * The horizontal nav is CSS-hidden below `sm`, which removes it from the
 * screen but not from the accessibility tree or the tab order — so the bottom
 * bar cannot be shown the same way without a phone carrying two "Analytics"
 * links through a screen reader's rotor, and a desktop tabbing through a
 * bottom bar sitting off-screen. `useIsMobileViewport` is what makes the
 * choice instead, by mounting nothing at all on the side that loses.
 */
const server = dashboardApi();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = signedInStore();
});

/** A viewport, which jsdom does not have — stubbed exactly like `useIsMobileViewport` expects it. */
function stubViewport(narrow: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: narrow, addEventListener: () => {}, removeEventListener: () => {} })),
  );
}

async function tabTo(user: ReturnType<typeof userEvent.setup>, target: HTMLElement) {
  for (let stop = 0; stop < 40; stop += 1) {
    if (document.activeElement === target) return;
    await user.tab();
  }

  throw new Error(
    `Tabbing forwards never reached ${target.textContent}; it stopped at ${document.activeElement?.outerHTML}.`,
  );
}

describe("on a viewport wide enough for the header's own nav", () => {
  it("renders exactly one set of destinations", async () => {
    server.use(
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket({ id: "tkt_1" })], nextCursor: null }),
      ),
    );

    renderDashboard(store);
    await screen.findByRole("list", { name: /^tickets$/i });

    // Exactly one navigation landmark carrying these destinations — the
    // header's own, not a bottom bar waiting off-screen for a phone that is
    // not this one.
    expect(screen.getAllByRole("navigation", { name: "Dashboard" })).toHaveLength(1);
  });
});

describe("on a narrow viewport", () => {
  it("carries the same destinations as a tab bar instead of the header's nav", async () => {
    stubViewport(true);
    server.use(
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket({ id: "tkt_1" })], nextCursor: null }),
      ),
    );

    renderDashboard(store);
    await screen.findByRole("list", { name: /^tickets$/i });

    // Still exactly one — the tab bar's, not the header's copy plus the
    // bar's. The header's own nav renders nothing on this side, which is the
    // whole point of gating on the viewport rather than on a CSS class.
    expect(screen.getAllByRole("navigation", { name: "Dashboard" })).toHaveLength(1);
  });

  it("marks the current destination for a reader who cannot see which tab is lit", async () => {
    stubViewport(true);
    server.use(
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket({ id: "tkt_1" })], nextCursor: null }),
      ),
    );

    renderDashboard(store);
    await screen.findByRole("list", { name: /^tickets$/i });

    const tabBar = screen.getByRole("navigation", { name: "Dashboard" });
    expect(within(tabBar).getByText("Tickets").closest('[aria-current="page"]')).not.toBeNull();
  });

  it("still hides Analytics from an agent, on the tab bar as much as the header", async () => {
    stubViewport(true);
    server.use(
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal({ role: "agent" }))),
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket({ id: "tkt_1" })], nextCursor: null }),
      ),
    );

    renderDashboard(store);
    await screen.findByRole("list", { name: /^tickets$/i });

    // Absent rather than disabled: an affordance that is there but refuses is
    // a promise the role does not keep, on the tab bar exactly as on the
    // header — the API refuses an agent either way.
    expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
  });

  it("still lets a keyboard reach Analytics, even though it now lives after the header in the document", async () => {
    stubViewport(true);
    server.use(
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal({ role: "admin" }))),
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket({ id: "tkt_1" })], nextCursor: null }),
      ),
    );
    const user = userEvent.setup();

    renderDashboard(store);
    await screen.findByRole("list", { name: /^tickets$/i });

    // Not the same order as the wide viewport — Analytics used to be the
    // header's own first control, and here it lives in a bar that is later in
    // the document than the header's bell, Sign out and theme control, because
    // the tab bar is visually below all of them. What has to stay true is
    // reachability, not position: a keyboard reader still gets there, in the
    // order the page actually puts things in front of them.
    // `tabTo` is itself the assertion: it throws if forward-tabbing never
    // reaches the target within a generous number of stops.
    await tabTo(user, screen.getByRole("link", { name: /analytics/i }));
  });
});
