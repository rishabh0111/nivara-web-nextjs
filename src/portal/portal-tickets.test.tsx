import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "@/api/generated/openapi";
import type { SessionStore } from "@/session/store";

import { baseUrl, message, renderPortal, signedInStore, ticket } from "./portal.fixtures";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = signedInStore();
});

type MessageDto = components["schemas"]["MessageDto"];

/**
 * A thread handler that honours `sort` the way the API does — newest first by
 * default. A client that forgets to ask for the order it wants gets the order
 * the API actually gives, so the test can catch it.
 */
function threadOf(...messages: MessageDto[]) {
  return http.get(`${baseUrl}/portal/tickets/:id/messages`, ({ request }) => {
    const sort = new URL(request.url).searchParams.get("sort") ?? "-createdAt";
    const ordered = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return HttpResponse.json({
      data: sort.startsWith("-") ? ordered.reverse() : ordered,
      nextCursor: null,
    });
  });
}

describe("the Tickets a Contact has raised", () => {
  it("shows every one of them", async () => {
    server.use(
      http.get(`${baseUrl}/portal/tickets`, () =>
        HttpResponse.json({
          data: [
            ticket({ id: "tkt_1", subject: "The printer is on fire" }),
            ticket({ id: "tkt_2", subject: "My invoice is wrong" }),
          ],
          nextCursor: null,
        }),
      ),
    );

    renderPortal(store);

    const list = await screen.findByRole("list", { name: /your tickets/i });
    const entries = within(list).getAllByRole("listitem");
    expect(entries).toHaveLength(2);
    expect(within(list).getByText("The printer is on fire")).toBeVisible();
    expect(within(list).getByText("My invoice is wrong")).toBeVisible();
  });

  it("reaches the ones past the first page, and offers no count to get there", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${baseUrl}/portal/tickets`, ({ request }) => {
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

    renderPortal(store);

    const list = await screen.findByRole("list", { name: /your tickets/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /load more tickets/i }));

    expect(await within(list).findByText("My invoice is wrong")).toBeVisible();
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);

    // `nextCursor` is null, so there is no more — and there was never a total to
    // show, because the API does not return one.
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("says what state each one is in, how urgent it is, and when it last changed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-07-02T12:00:00.000Z"));

    server.use(
      http.get(`${baseUrl}/portal/tickets`, () =>
        HttpResponse.json({
          data: [
            ticket({ state: "on_hold", priority: "high", updatedAt: "2026-07-02T09:00:00.000Z" }),
          ],
          nextCursor: null,
        }),
      ),
    );

    renderPortal(store);

    const entry = await screen.findByRole("listitem");
    expect(entry).toHaveTextContent(/On hold/);
    expect(entry).toHaveTextContent(/High/);
    expect(entry).toHaveTextContent(/3 hours ago/);
    expect(within(entry).getByText(/3 hours ago/)).toHaveAttribute(
      "datetime",
      "2026-07-02T09:00:00.000Z",
    );
  });

  /**
   * Five, not the four the realtime schema documents — it is stale on this one
   * field, and `on_hold` is real. The compile-time enforcement is the label map
   * being keyed by the generated union; this is the criterion said out loud, in
   * the words a Contact actually reads.
   */
  it("reads all five Ticket states", async () => {
    const states = ["open", "pending", "on_hold", "resolved", "closed"] as const;

    server.use(
      http.get(`${baseUrl}/portal/tickets`, () =>
        HttpResponse.json({
          data: states.map((state, index) => ticket({ id: `tkt_${index}`, state })),
          nextCursor: null,
        }),
      ),
    );

    renderPortal(store);
    await screen.findByRole("list", { name: /your tickets/i });

    // Each state is its own chip in the row, so the label stands alone rather
    // than heading a run-on summary. The criterion is unchanged — all five are
    // readable, in the words a Contact actually sees.
    for (const label of ["Open", "Pending", "On hold", "Resolved", "Closed"]) {
      expect(screen.getByText(new RegExp(`^${label}$`))).toBeVisible();
    }
  });
});

describe("reading one Ticket", () => {
  const listing = http.get(`${baseUrl}/portal/tickets`, () =>
    HttpResponse.json({
      data: [ticket({ id: "tkt_1", subject: "The printer is on fire" })],
      nextCursor: null,
    }),
  );

  async function open() {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /the printer is on fire/i }));
    return user;
  }

  it("shows its full thread oldest first, however the API orders its default", async () => {
    server.use(
      listing,
      threadOf(
        message({ id: "msg_1", body: "It is on fire.", createdAt: "2026-07-01T09:00:00.000Z" }),
        message({
          id: "msg_2",
          body: "We are sending someone.",
          authorKind: "user",
          authorId: "usr_1",
          createdAt: "2026-07-01T10:00:00.000Z",
        }),
        message({ id: "msg_3", body: "Thank you.", createdAt: "2026-07-01T11:00:00.000Z" }),
      ),
    );

    renderPortal(store);
    await open();

    const thread = await screen.findByRole("list", { name: /conversation/i });
    const bodies = within(thread)
      .getAllByRole("listitem")
      .map((entry) => entry.textContent);

    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toContain("It is on fire.");
    expect(bodies[1]).toContain("We are sending someone.");
    expect(bodies[2]).toContain("Thank you.");
  });
});

describe("reading Tickets by keyboard and by screen reader", () => {
  it("opens a Ticket and comes back, by keyboard alone", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${baseUrl}/portal/tickets`, () =>
        HttpResponse.json({
          data: [ticket({ id: "tkt_1", subject: "The printer is on fire" })],
          nextCursor: null,
        }),
      ),
      threadOf(message({ body: "It is on fire." })),
    );

    renderPortal(store);
    await screen.findByRole("list", { name: /your tickets/i });

    await user.tab(); // Sign out
    await user.tab(); // Theme
    await user.tab(); // Open a ticket
    await user.tab();
    const entry = screen.getByRole("button", { name: /the printer is on fire/i });
    expect(entry).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("list", { name: /conversation/i })).toBeVisible();

    // The list this replaced took the focused element with it. Focus is on the
    // opened Ticket's region, so the next tab is "All tickets" and not the top
    // of the page.
    await user.tab();
    expect(screen.getByRole("button", { name: /all tickets/i })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("list", { name: /your tickets/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /the printer is on fire/i })).toHaveFocus();
  });

  it("announces the wait, then announces a failure to load", async () => {
    server.use(
      http.get(`${baseUrl}/portal/tickets`, () =>
        HttpResponse.json({ error: { code: "internal_error", message: "boom" } }, { status: 500 }),
      ),
    );

    renderPortal(store);

    expect(screen.getByRole("status")).toHaveTextContent(/loading your tickets/i);
    expect(await screen.findByRole("alert")).toBeVisible();
  });

  it("says an empty list is empty rather than leaving it looking broken", async () => {
    server.use(
      http.get(`${baseUrl}/portal/tickets`, () =>
        HttpResponse.json({ data: [], nextCursor: null }),
      ),
    );

    renderPortal(store);

    expect(await screen.findByText(/you have not raised a ticket yet/i)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
