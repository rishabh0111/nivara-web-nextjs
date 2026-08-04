/**
 * The queue as a place: somewhere a User comes back to, and somewhere they can
 * send a colleague.
 *
 * Both halves are asserted through the wire rather than through the controls
 * alone. A URL that restored the checkboxes without narrowing the request would
 * show the whole queue under a filtered heading, and a filter that narrowed the
 * request without reaching the URL would be gone on the next reload — each of
 * those passes half of this.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = signedInStore();
  at("/dashboard");
});

const asAgent = http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal()));

/** The address the reader arrived at — a pasted link, or a reload of their own. */
function at(url: string) {
  window.history.replaceState(null, "", url);
}

/** Where the interface says the reader is now. */
function search(): string {
  return window.location.search;
}

const printer = ticket({
  id: "tkt_1",
  subject: "The printer is on fire",
  state: "open",
  priority: "urgent",
});

const invoice = ticket({
  id: "tkt_2",
  subject: "My invoice is wrong",
  state: "pending",
  priority: "low",
});

async function openQueue(asked: URLSearchParams[]) {
  server.use(
    asAgent,
    http.get(`${baseUrl}/tickets`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      asked.push(query);

      const state = query.get("state");
      const matching = [printer, invoice].filter(
        (held) => state === null || state.split(",").includes(held.state),
      );

      return HttpResponse.json({ data: matching, nextCursor: null });
    }),
  );
  renderDashboard(store);
  await screen.findByRole("list", { name: /^tickets$/i });
  return userEvent.setup();
}

function firstAsked(asked: URLSearchParams[]): URLSearchParams {
  const first = asked[0];
  if (!first) throw new Error("The queue never asked for anything.");
  return first;
}

function lastAsked(asked: URLSearchParams[]): URLSearchParams {
  const last = asked.at(-1);
  if (!last) throw new Error("The queue never asked for anything.");
  return last;
}

async function listed(): Promise<string[]> {
  const queue = await screen.findByRole("list", { name: /^tickets$/i });
  return within(queue)
    .getAllByRole("listitem")
    .map((entry) => entry.querySelector("span")?.textContent ?? "");
}

describe("a link to a slice of the queue", () => {
  /**
   * The narrowed request is the first one made, not a correction to a wider one
   * that went out first. A queue that asked for everything and then asked again
   * would show the unfiltered work for as long as the round trip takes, and
   * spend a request telling the reader something they did not ask.
   */
  it("opens onto the slice the URL names, and asks for it first", async () => {
    const asked: URLSearchParams[] = [];
    at("/dashboard?state=pending&sort=updatedAt");

    await openQueue(asked);

    expect(firstAsked(asked).get("state")).toBe("pending");
    expect(firstAsked(asked).get("sort")).toBe("updatedAt");
    expect(asked).toHaveLength(1);
    expect(await listed()).toEqual(["My invoice is wrong"]);
  });

  it("shows the controls holding what the URL asked for", async () => {
    at("/dashboard?state=pending&assigneeId=none&contactId=con_2&createdAfter=2026-07-01");

    await openQueue([]);

    expect(screen.getByRole("checkbox", { name: "Pending" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Open" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /unassigned/i })).toBeChecked();
    expect(screen.getByLabelText(/^contact$/i)).toHaveValue("con_2");
    expect(screen.getByLabelText(/created from/i)).toHaveValue("2026-07-01");
  });

  /**
   * An unknown query parameter is a 400 from this API, and a URL is edited by
   * hand, truncated by a chat client and kept past the release that changed the
   * vocabulary. What the URL cannot name, the request cannot carry.
   */
  it("ignores a parameter it does not know rather than passing it on", async () => {
    const asked: URLSearchParams[] = [];
    at("/dashboard?state=open&limit=500&tenantId=ten_9");

    await openQueue(asked);

    expect(firstAsked(asked).get("limit")).toBeNull();
    expect(firstAsked(asked).get("tenantId")).toBeNull();
    expect(firstAsked(asked).get("state")).toBe("open");
  });

  it("opens onto the whole queue when the URL names no slice", async () => {
    const asked: URLSearchParams[] = [];

    await openQueue(asked);

    expect(firstAsked(asked).get("state")).toBeNull();
    expect(await listed()).toEqual(["The printer is on fire", "My invoice is wrong"]);
  });
});

describe("the URL follows the reader", () => {
  it("writes a chosen filter into the URL, so a reload comes back to it", async () => {
    const user = await openQueue([]);

    await user.click(screen.getByRole("checkbox", { name: "Pending" }));

    await waitFor(() => expect(search()).toBe("?state=pending"));
  });

  it("writes an order, and leaves the default one out", async () => {
    const user = await openQueue([]);

    await user.selectOptions(screen.getByLabelText(/order/i), "updatedAt");
    await waitFor(() => expect(search()).toBe("?sort=updatedAt"));

    await user.selectOptions(screen.getByLabelText(/order/i), "-createdAt");
    await waitFor(() => expect(search()).toBe(""));
  });

  it("empties the URL when the filters are cleared", async () => {
    at("/dashboard?state=pending");
    const user = await openQueue([]);

    await user.click(screen.getByRole("button", { name: /clear filters/i }));

    await waitFor(() => expect(search()).toBe(""));
  });

  /**
   * Narrowing a queue is editing one view, not visiting a series of them. A
   * history entry per keystroke-settled filter would put twenty presses of Back
   * between the reader and wherever they came from.
   */
  it("edits the address rather than stacking a history entry per filter", async () => {
    const user = await openQueue([]);
    const before = window.history.length;

    await user.click(screen.getByRole("checkbox", { name: "Pending" }));
    await user.click(screen.getByRole("checkbox", { name: "Open" }));
    await user.selectOptions(screen.getByLabelText(/order/i), "updatedAt");

    await waitFor(() => expect(search()).toBe("?state=pending%2Copen&sort=updatedAt"));
    expect(window.history.length).toBe(before);
  });

  /**
   * The URL is the slice, and a slice is not how far down it somebody has read.
   * A cursor in a shared link would resume a colleague from a page boundary in
   * a list they have not seen, and one in a reloaded link would open the queue
   * partway down with the work above it missing.
   */
  it("never carries a cursor, so a shared link starts where the queue starts", async () => {
    const asked: URLSearchParams[] = [];
    server.use(
      asAgent,
      http.get(`${baseUrl}/tickets`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        asked.push(query);

        return query.get("cursor") === null
          ? HttpResponse.json({ data: [printer], nextCursor: "cur_2" })
          : HttpResponse.json({ data: [invoice], nextCursor: null });
      }),
    );
    renderDashboard(store);
    const user = userEvent.setup();
    await screen.findByRole("list", { name: /^tickets$/i });

    await user.click(screen.getByRole("button", { name: /load more tickets/i }));

    await waitFor(() => expect(lastAsked(asked).get("cursor")).toBe("cur_2"));
    expect(search()).toBe("");
  });
});
