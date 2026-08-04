/**
 * Every filter, exercised against the wire.
 *
 * A filter is only real if it reaches the API, so each of these asserts on the
 * request that was made *and* on what came back — a control that narrowed the
 * screen without narrowing the question, or asked the right question and threw
 * the answer away, would pass half of this and fail the other.
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
});

const asAgent = http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal()));

/**
 * A queue that answers with whichever Tickets match the query it was asked —
 * so a filter that never reached the wire shows the wrong Tickets rather than
 * silently passing.
 */
function queueOf(tickets: ReturnType<typeof ticket>[], asked: URLSearchParams[]) {
  return http.get(`${baseUrl}/tickets`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    asked.push(query);

    return HttpResponse.json({
      data: tickets.filter((held) => matches(held, query)),
      nextCursor: null,
    });
  });
}

function matches(held: ReturnType<typeof ticket>, query: URLSearchParams): boolean {
  const anyOf = (parameter: string, value: string) => {
    const asked = query.get(parameter);
    return asked === null || asked.split(",").includes(value);
  };

  const assigneeId = query.get("assigneeId");
  const assigneeMatches =
    assigneeId === null
      ? true
      : assigneeId === "none"
        ? held.assigneeId === null
        : held.assigneeId === assigneeId;

  const contactId = query.get("contactId");
  const createdAfter = query.get("createdAfter");
  const createdBefore = query.get("createdBefore");

  return (
    anyOf("state", held.state) &&
    anyOf("priority", held.priority) &&
    anyOf("source", held.source) &&
    assigneeMatches &&
    (contactId === null || held.contactId === contactId) &&
    (createdAfter === null || held.createdAt >= createdAfter) &&
    (createdBefore === null || held.createdAt <= createdBefore)
  );
}

/** The most recent request the queue made. */
function lastAsked(asked: URLSearchParams[]): URLSearchParams {
  const last = asked.at(-1);
  if (!last) throw new Error("The queue never asked for anything.");
  return last;
}

/** The subjects currently listed, in order. */
async function listed(): Promise<string[]> {
  const queue = await screen.findByRole("list", { name: /^tickets$/i });
  return within(queue)
    .getAllByRole("listitem")
    .map((entry) => entry.querySelector("span")?.textContent ?? "");
}

const printer = ticket({
  id: "tkt_1",
  subject: "The printer is on fire",
  state: "open",
  priority: "urgent",
  source: "portal",
  assigneeId: null,
  contactId: "con_1",
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-09T09:00:00.000Z",
});

const invoice = ticket({
  id: "tkt_2",
  subject: "My invoice is wrong",
  state: "pending",
  priority: "low",
  source: "widget",
  assigneeId: "usr_1",
  contactId: "con_2",
  createdAt: "2026-07-20T09:00:00.000Z",
  updatedAt: "2026-07-21T09:00:00.000Z",
});

async function openQueue(asked: URLSearchParams[]) {
  server.use(asAgent, queueOf([printer, invoice], asked));
  renderDashboard(store);
  await screen.findByRole("list", { name: /^tickets$/i });
  return userEvent.setup();
}

describe("narrowing the queue", () => {
  it("filters by state", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("checkbox", { name: "Pending" }));

    await waitFor(() => expect(lastAsked(asked).get("state")).toBe("pending"));
    expect(await listed()).toEqual(["My invoice is wrong"]);
  });

  it("filters by priority", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("checkbox", { name: "Urgent" }));

    await waitFor(() => expect(lastAsked(asked).get("priority")).toBe("urgent"));
    expect(await listed()).toEqual(["The printer is on fire"]);
  });

  /** So Widget arrivals can be worked separately from every other channel. */
  it("filters by source", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("checkbox", { name: "Widget" }));

    await waitFor(() => expect(lastAsked(asked).get("source")).toBe("widget"));
    expect(await listed()).toEqual(["My invoice is wrong"]);
  });

  it("filters by the Contact who raised them", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.type(screen.getByLabelText(/^contact$/i), "con_2");

    await waitFor(() => expect(lastAsked(asked).get("contactId")).toBe("con_2"));
    expect(await listed()).toEqual(["My invoice is wrong"]);
  });

  /**
   * A typed id is one question, arrived at a letter at a time. Asking after
   * every keystroke would spend five requests on four prefixes nobody wanted an
   * answer to, and leave the cache holding all five.
   */
  it("asks once for a typed id rather than once per keystroke", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);
    const before = asked.length;

    await user.type(screen.getByLabelText(/^contact$/i), "con_2");

    await waitFor(() => expect(lastAsked(asked).get("contactId")).toBe("con_2"));
    expect(asked.length - before).toBe(1);
  });

  it("filters by a range of days, with both ends of the range inside it", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    // The 1st is the day the printer Ticket was raised, and naming it as the
    // last day of the range has to include it. The instant is the end of the
    // reader's 1 July — the suite runs at +05:30, so a conversion that read the
    // day as UTC would land somewhere else.
    await user.type(screen.getByLabelText(/created until/i), "2026-07-01");

    await waitFor(() =>
      expect(lastAsked(asked).get("createdBefore")).toBe("2026-07-01T18:29:59.999Z"),
    );
    expect(await listed()).toEqual(["The printer is on fire"]);

    await user.type(screen.getByLabelText(/created from/i), "2026-07-10");
    await waitFor(() =>
      expect(lastAsked(asked).get("createdAfter")).toBe("2026-07-09T18:30:00.000Z"),
    );
  });

  it("takes several values for one filter, as one comma-separated parameter", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("checkbox", { name: "Open" }));
    await user.click(screen.getByRole("checkbox", { name: "Pending" }));

    await waitFor(() => expect(lastAsked(asked).get("state")).toBe("open,pending"));
    expect(await listed()).toEqual(["The printer is on fire", "My invoice is wrong"]);
  });

  it("combines several filters, which narrow together", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("checkbox", { name: "Open" }));
    await user.click(screen.getByRole("checkbox", { name: "Pending" }));
    await user.click(screen.getByRole("checkbox", { name: "Portal" }));
    await user.click(screen.getByRole("radio", { name: /unassigned/i }));

    await waitFor(() => {
      const query = lastAsked(asked);
      expect(query.get("state")).toBe("open,pending");
      expect(query.get("source")).toBe("portal");
      expect(query.get("assigneeId")).toBe("none");
    });

    // Two states would have matched both; source and assignee took one away.
    expect(await listed()).toEqual(["The printer is on fire"]);
  });

  it("puts back what a cleared filter was hiding", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("checkbox", { name: "Urgent" }));
    await waitFor(async () => expect(await listed()).toEqual(["The printer is on fire"]));

    await user.click(screen.getByRole("button", { name: /clear filters/i }));

    await waitFor(() => expect(lastAsked(asked).get("priority")).toBeNull());
    expect(await listed()).toEqual(["The printer is on fire", "My invoice is wrong"]);
  });
});

describe("asking about an assignee", () => {
  /**
   * The unclaimed pool is where a User goes looking for work, and it is a
   * different question from "assigned to this person" rather than a special
   * value of it — so it is its own control and its own parameter value.
   */
  it("asks for the Tickets nobody has claimed with the sentinel, not with an id", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("radio", { name: /unassigned/i }));

    await waitFor(() => expect(lastAsked(asked).get("assigneeId")).toBe("none"));
    expect(await listed()).toEqual(["The printer is on fire"]);
  });

  it("asks for one User's Tickets by their id", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("radio", { name: /a named user/i }));
    await user.type(screen.getByLabelText(/^user$/i), "usr_1");

    await waitFor(() => expect(lastAsked(asked).get("assigneeId")).toBe("usr_1"));
    expect(await listed()).toEqual(["My invoice is wrong"]);
  });

  /** "Me" is whoever the API says holds this credential, never what a form typed. */
  it("asks for the signed-in User's own Tickets without them typing their id", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("radio", { name: /assigned to me/i }));

    await waitFor(() => expect(lastAsked(asked).get("assigneeId")).toBe("usr_1"));
    expect(await listed()).toEqual(["My invoice is wrong"]);
  });

  /**
   * The two questions reach the wire as the same parameter, and are still two
   * questions. Working out which was asked by comparing the held id to the
   * signed-in User's would take the field away mid-word from the reader who
   * happened to type their own id into it.
   */
  it("keeps the by-name field open when the id typed into it is the reader's own", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("radio", { name: /a named user/i }));
    const field = screen.getByLabelText(/^user$/i);
    await user.type(field, "usr_1");

    expect(field).toBeVisible();
    expect(field).toHaveFocus();
    expect(field).toHaveValue("usr_1");
    expect(screen.getByRole("radio", { name: /a named user/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /assigned to me/i })).not.toBeChecked();
  });

  it("asks nothing about the assignee until one of the two questions is chosen", async () => {
    const asked: URLSearchParams[] = [];
    await openQueue(asked);

    expect(lastAsked(asked).get("assigneeId")).toBeNull();
  });
});

describe("ordering the queue", () => {
  it("defaults to the API's own order, said out loud rather than left implied", async () => {
    const asked: URLSearchParams[] = [];
    await openQueue(asked);

    expect(lastAsked(asked).get("sort")).toBe("-createdAt");
  });

  it("sorts by creation and by last update, in either direction", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);
    const order = screen.getByLabelText(/order/i);

    await user.selectOptions(order, "createdAt");
    await waitFor(() => expect(lastAsked(asked).get("sort")).toBe("createdAt"));

    await user.selectOptions(order, "-updatedAt");
    await waitFor(() => expect(lastAsked(asked).get("sort")).toBe("-updatedAt"));

    await user.selectOptions(order, "updatedAt");
    await waitFor(() => expect(lastAsked(asked).get("sort")).toBe("updatedAt"));

    await user.selectOptions(order, "-createdAt");
    await waitFor(() => expect(lastAsked(asked).get("sort")).toBe("-createdAt"));
  });

  /**
   * The API says changing `sort` invalidates a cursor. A re-sort that carried
   * the old one forward would be asking the new order to resume from a place in
   * the old one.
   */
  it("starts a re-sorted queue from the beginning rather than from the old cursor", async () => {
    const asked: URLSearchParams[] = [];
    server.use(
      asAgent,
      http.get(`${baseUrl}/tickets`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        asked.push(query);
        return HttpResponse.json({
          data: [query.get("cursor") === null ? printer : invoice],
          nextCursor: "cur_2",
        });
      }),
    );
    renderDashboard(store);
    const user = userEvent.setup();
    await screen.findByRole("list", { name: /^tickets$/i });

    await user.click(screen.getByRole("button", { name: /load more tickets/i }));
    await waitFor(() => expect(lastAsked(asked).get("cursor")).toBe("cur_2"));

    await user.selectOptions(screen.getByLabelText(/order/i), "updatedAt");

    await waitFor(() => {
      const query = lastAsked(asked);
      expect(query.get("sort")).toBe("updatedAt");
      expect(query.get("cursor")).toBeNull();
    });
  });
});

describe("nothing matched", () => {
  it("says the filters matched nothing, distinguishably from a failure", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    await user.click(screen.getByRole("checkbox", { name: "Closed" }));

    expect(await screen.findByText(/no tickets match these filters/i)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("working the filters by keyboard", () => {
  it("reaches and operates every filter without a pointer", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openQueue(asked);

    const open = screen.getByRole("checkbox", { name: "Open" });
    open.focus();
    await user.keyboard(" ");
    await waitFor(() => expect(lastAsked(asked).get("state")).toBe("open"));

    // A radio group is one tab stop, and the arrows move within it.
    screen.getByRole("radio", { name: /anyone/i }).focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(lastAsked(asked).get("assigneeId")).toBe("none"));
  });

  it("groups each filter under a name a screen reader announces", async () => {
    await openQueue([]);

    const filters = screen.getByRole("region", { name: /filter and sort tickets/i });
    for (const name of [/^state$/i, /^priority$/i, /^source$/i, /^assignee$/i]) {
      expect(within(filters).getByRole("group", { name })).toBeInTheDocument();
    }
  });
});
