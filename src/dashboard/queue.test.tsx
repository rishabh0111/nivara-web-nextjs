import { cleanup, screen, within } from "@testing-library/react";
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

const server = dashboardApi();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = signedInStore();
});

const asAgent = http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal()));

/**
 * A viewport, which jsdom does not have.
 *
 * There is no layout here and so nothing ever scrolls into view — the observer
 * is stubbed, and `theEnd()` is the reader arriving at the bottom of the list.
 * What that asserts is the wiring: that the end of the list is what is watched,
 * and that reaching it is what asks for the next page.
 */
function observeIntersections() {
  const watching: (() => void)[] = [];

  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private readonly notify: (entries: { isIntersecting: boolean }[]) => void) {}
      observe = () => watching.push(() => this.notify([{ isIntersecting: true }]));
      unobserve = () => {};
      disconnect = () => {};
    },
  );

  return { theEnd: () => watching.forEach((reach) => reach()) };
}
const asAdmin = http.get(`${baseUrl}/auth/me`, () =>
  HttpResponse.json(principal({ role: "admin", name: "Ada Byrne" })),
);

describe("the queue", () => {
  it("shows the Tickets it was given", async () => {
    server.use(
      asAgent,
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({
          data: [
            ticket({ id: "tkt_1", subject: "The printer is on fire" }),
            ticket({ id: "tkt_2", subject: "My invoice is wrong" }),
          ],
          nextCursor: null,
        }),
      ),
    );

    renderDashboard(store);

    const queue = await screen.findByRole("list", { name: /^tickets$/i });
    expect(within(queue).getAllByRole("listitem")).toHaveLength(2);
    expect(within(queue).getByText("The printer is on fire")).toBeVisible();
    expect(within(queue).getByText("My invoice is wrong")).toBeVisible();
  });

  it("says what state each Ticket is in, how urgent it is, and when it last changed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-07-02T12:00:00.000Z"));

    server.use(
      asAgent,
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({
          data: [ticket({ state: "on_hold", priority: "high" })],
          nextCursor: null,
        }),
      ),
    );

    renderDashboard(store);

    const entry = await screen.findByRole("listitem");
    expect(entry).toHaveTextContent(/On hold/);
    expect(entry).toHaveTextContent(/High/);
    expect(entry).toHaveTextContent(/3 hours ago/);
  });

  it("reaches the Tickets past the first page, and offers no count to get there", async () => {
    const user = userEvent.setup();
    server.use(
      asAgent,
      http.get(`${baseUrl}/tickets`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");

        return cursor === null
          ? HttpResponse.json({
              data: [ticket({ id: "tkt_1", subject: "The printer is on fire" })],
              nextCursor: "cur_2",
            })
          : HttpResponse.json({
              data: [ticket({ id: "tkt_2", subject: "My invoice is wrong" })],
              nextCursor: null,
            });
      }),
    );

    renderDashboard(store);

    const queue = await screen.findByRole("list", { name: /^tickets$/i });
    expect(within(queue).getAllByRole("listitem")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /load more tickets/i }));

    expect(await within(queue).findByText("My invoice is wrong")).toBeVisible();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  /**
   * A long queue arrives as the reader reaches the end of what they have, so
   * the next page is already coming by the time they need it.
   *
   * The button stays, and is not a fallback for browsers without an observer so
   * much as the same control said out loud: it is what a reader tabs to, what
   * says "Loading…" while a page is on its way, and what a reader on a cold
   * start presses when they would rather ask than wait.
   */
  it("loads more when the end of the list is reached, without it being pressed", async () => {
    const reaching = observeIntersections();
    server.use(
      asAgent,
      http.get(`${baseUrl}/tickets`, ({ request }) =>
        new URL(request.url).searchParams.get("cursor") === null
          ? HttpResponse.json({
              data: [ticket({ id: "tkt_1", subject: "The printer is on fire" })],
              nextCursor: "cur_2",
            })
          : HttpResponse.json({
              data: [ticket({ id: "tkt_2", subject: "My invoice is wrong" })],
              nextCursor: null,
            }),
      ),
    );

    renderDashboard(store);
    await screen.findByRole("list", { name: /^tickets$/i });
    expect(screen.queryByText("My invoice is wrong")).not.toBeInTheDocument();

    reaching.theEnd();

    expect(await screen.findByText("My invoice is wrong")).toBeVisible();
  });

  /**
   * The button a reader pressed to load more is the button that disappears when
   * there is no more — and a reader who cannot see the list grow is left with
   * their focus on nothing, having been told nothing. The end of the queue is
   * said out loud, and takes the focus the vanished button was holding.
   *
   * Said without counting. How many arrived is the size of a page, and offering
   * it here would read as the size of the result, which this API does not know.
   */
  it("says when the end of the queue has been reached, and does not strand the focus there", async () => {
    const user = userEvent.setup();
    server.use(
      asAgent,
      http.get(`${baseUrl}/tickets`, ({ request }) =>
        new URL(request.url).searchParams.get("cursor") === null
          ? HttpResponse.json({ data: [ticket({ id: "tkt_1" })], nextCursor: "cur_2" })
          : HttpResponse.json({ data: [ticket({ id: "tkt_2" })], nextCursor: null }),
      ),
    );

    renderDashboard(store);
    await screen.findByRole("list", { name: /^tickets$/i });

    // Nothing is claimed about the end while there is more to come.
    expect(screen.queryByText(/every ticket/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /load more tickets/i }));

    const end = await screen.findByText(/every ticket/i);
    expect(end).toHaveAttribute("role", "status");
    expect(end).toHaveFocus();
  });

  it("tells an empty queue apart from a queue that could not be loaded", async () => {
    server.use(
      asAgent,
      http.get(`${baseUrl}/tickets`, () => HttpResponse.json({ data: [], nextCursor: null })),
    );

    renderDashboard(store);

    expect(await screen.findByText(/no tickets/i)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces the wait, then announces a failure to load", async () => {
    server.use(
      asAgent,
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ error: { code: "internal_error", message: "boom" } }, { status: 500 }),
      ),
    );

    renderDashboard(store);

    // Announced rather than merely drawn. Named by its text rather than by the
    // role alone, because the queue has a second live region above it — the one
    // that says the list has been overtaken — and either of them being the only
    // `status` on the screen is not what is being claimed here.
    expect(screen.getByText(/loading tickets/i)).toHaveAttribute("role", "status");
    expect(await screen.findByRole("alert")).toBeVisible();
  });
});

/** What the queue is showing, once it has arrived. */
async function queueEntries(): Promise<(string | null)[]> {
  const queue = await screen.findByRole("list", { name: /^tickets$/i });
  return within(queue)
    .getAllByRole("listitem")
    .map((entry) => entry.textContent);
}

describe("what a role reaches", () => {
  /**
   * Narrowing the queue to the Tickets an agent happens to own would tell them
   * their team's work is smaller than it is, and it is not a rule the API
   * enforces either — so nothing here asks for a slice.
   *
   * What carries the weight is the two requests being character-for-character
   * the same: the role reached the wire in no form at all, which is why the two
   * screens cannot differ.
   */
  it("asks for the same Tickets for an agent as for an admin", async () => {
    const asked: string[] = [];
    const queue = http.get(`${baseUrl}/tickets`, ({ request }) => {
      asked.push(request.url);
      return HttpResponse.json({
        data: [ticket({ id: "tkt_1", subject: "The printer is on fire" })],
        nextCursor: null,
      });
    });

    server.use(asAgent, queue);
    renderDashboard(signedInStore());
    const agentSees = await queueEntries();
    cleanup();

    server.resetHandlers();
    server.use(asAdmin, queue);
    renderDashboard(signedInStore());
    const adminSees = await queueEntries();

    expect(agentSees).toEqual(adminSees);

    const [askedForTheAgent, askedForTheAdmin] = asked;
    expect(asked).toHaveLength(2);
    expect(askedForTheAgent).toBe(askedForTheAdmin);

    // And neither asked for a slice of the queue in the first place.
    const query = new URL(askedForTheAgent ?? "").searchParams;
    expect(query.get("assigneeId")).toBeNull();
    expect(query.get("state")).toBeNull();
  });

  it("offers an admin a capability it does not offer an agent", async () => {
    const queue = http.get(`${baseUrl}/tickets`, () =>
      HttpResponse.json({ data: [ticket()], nextCursor: null }),
    );

    server.use(asAgent, queue);
    renderDashboard(store);
    await screen.findByRole("list", { name: /^tickets$/i });
    // The name has arrived, so the role has too — and still no analytics.
    expect(await screen.findByText(/Sam Okonkwo/)).toBeVisible();
    expect(screen.queryByRole("link", { name: /analytics/i })).not.toBeInTheDocument();
    cleanup();

    server.resetHandlers();
    server.use(asAdmin, queue);
    renderDashboard(signedInStore());
    expect(await screen.findByRole("link", { name: /analytics/i })).toBeVisible();
  });

  it("names who is signed in and what they are", async () => {
    server.use(
      asAdmin,
      http.get(`${baseUrl}/tickets`, () => HttpResponse.json({ data: [], nextCursor: null })),
    );

    renderDashboard(store);

    expect(await screen.findByText(/Ada Byrne/)).toBeVisible();

    const banner = screen.getByRole("banner");
    expect(banner).toHaveTextContent(/Ada Byrne/);
    expect(banner).toHaveTextContent(/Admin/);
  });

  /**
   * Who is holding the credential is the API's answer, and until it arrives the
   * safe reading is "not an admin". Showing an admin-only affordance while the
   * question is still open would flicker it away from an agent.
   */
  it("offers nothing admin-only while the principal is still unknown", async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () =>
        HttpResponse.json({ error: { code: "internal_error", message: "boom" } }, { status: 500 }),
      ),
      http.get(`${baseUrl}/tickets`, () => HttpResponse.json({ data: [], nextCursor: null })),
    );

    renderDashboard(store);

    // The queue still loads: not knowing the role is not a reason to withhold work.
    expect(await screen.findByText(/no tickets/i)).toBeVisible();
    expect(screen.queryByRole("link", { name: /analytics/i })).not.toBeInTheDocument();
  });
});

describe("working the queue by keyboard", () => {
  it("reaches everything the queue offers, in the order it is read", async () => {
    const user = userEvent.setup();
    server.use(
      asAdmin,
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({
          data: [ticket({ id: "tkt_1", subject: "The printer is on fire" })],
          nextCursor: "cur_2",
        }),
      ),
    );

    renderDashboard(store);
    await screen.findByRole("list", { name: /^tickets$/i });

    await user.tab();
    expect(screen.getByRole("link", { name: /analytics/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /sign out/i })).toHaveFocus();

    // The theme control is last on the bar, deliberately: a preference nobody
    // came here to set does not stand in front of the work.
    await user.tab();
    expect(screen.getByRole("button", { name: /^theme:/i })).toHaveFocus();

    // Then the filters, which sit above the list because they describe it —
    // and past them, the end of the list.
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "Open" })).toHaveFocus();

    await tabTo(user, screen.getByRole("button", { name: /load more tickets/i }));
  });
});

/** Tab forwards until the element has focus, or say how far it got. */
async function tabTo(user: ReturnType<typeof userEvent.setup>, target: HTMLElement) {
  for (let stop = 0; stop < 40; stop += 1) {
    if (document.activeElement === target) return;
    await user.tab();
  }

  throw new Error(
    `Tabbing forwards never reached ${target.textContent}; it stopped at ${document.activeElement?.outerHTML}.`,
  );
}
