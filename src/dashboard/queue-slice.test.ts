import { describe, expect, it } from "vitest";

import { EVERYTHING, toTicketQuery, type QueueSlice } from "./queue-slice";

function slice(overrides: Partial<QueueSlice> = {}): QueueSlice {
  return { ...EVERYTHING, ...overrides };
}

describe("the slice a User is working", () => {
  it("asks for nothing but an order when nothing is chosen", () => {
    expect(toTicketQuery(EVERYTHING)).toEqual({ sort: "-createdAt" });
  });

  it("sends several values for one filter as the API takes them — one comma-separated value", () => {
    expect(toTicketQuery(slice({ state: ["open", "on_hold"] }))).toMatchObject({
      state: "open,on_hold",
    });
  });

  it("carries every filter at once, so they narrow together", () => {
    expect(
      toTicketQuery(
        slice({
          state: ["pending"],
          priority: ["high", "urgent"],
          source: ["widget"],
          assignee: { kind: "user", userId: "usr_7" },
          contactId: "con_3",
          createdAfter: "2026-07-01",
          createdBefore: "2026-07-31",
          sort: { field: "updatedAt", direction: "asc" },
        }),
      ),
    ).toEqual({
      state: "pending",
      priority: "high,urgent",
      source: "widget",
      assigneeId: "usr_7",
      contactId: "con_3",
      createdAfter: "2026-06-30T18:30:00.000Z",
      createdBefore: "2026-07-31T18:29:59.999Z",
      sort: "updatedAt",
    });
  });
});

describe("the two ways to ask about an assignee", () => {
  it("names a User by their id", () => {
    expect(toTicketQuery(slice({ assignee: { kind: "user", userId: "usr_7" } }))).toMatchObject({
      assigneeId: "usr_7",
    });
  });

  /**
   * `none` is the API's own sentinel, and it is a different question from
   * "assigned to somebody" — it is the unclaimed pool. Modelling it as a kind
   * rather than as a magic id means no User id can ever be mistaken for it.
   */
  it("asks for the unclaimed pool with the sentinel the API defines", () => {
    expect(toTicketQuery(slice({ assignee: { kind: "unassigned" } }))).toMatchObject({
      assigneeId: "none",
    });
  });

  /**
   * "My queue" and "that person's queue" are one parameter on the wire and two
   * questions in the slice. Keeping them apart is what stops a reader who typed
   * their own id into the by-name field from having the control change under
   * them, so the distinction survives the round trip rather than being derived.
   */
  it("asks for the signed-in User's own Tickets with the same parameter and a different kind", () => {
    expect(toTicketQuery(slice({ assignee: { kind: "mine", userId: "usr_1" } }))).toMatchObject({
      assigneeId: "usr_1",
    });
  });

  it("asks about the assignee at all only when one of the questions was chosen", () => {
    expect(toTicketQuery(slice({ assignee: { kind: "anyone" } }))).not.toHaveProperty("assigneeId");
  });
});

describe("ordering the work", () => {
  it("marks a descending sort with the leading minus the API reads", () => {
    expect(toTicketQuery(slice({ sort: { field: "updatedAt", direction: "desc" } }))).toMatchObject(
      { sort: "-updatedAt" },
    );
  });

  it("leaves an ascending sort unmarked", () => {
    expect(toTicketQuery(slice({ sort: { field: "createdAt", direction: "asc" } }))).toMatchObject({
      sort: "createdAt",
    });
  });
});

/** The suite runs at +05:30, so a day that is not read as the reader's own shows. */
describe("a date range over a filter that takes instants", () => {
  /**
   * A User picks a day; the API takes an instant. The end of the range is the
   * last instant *of* that day rather than its beginning — "created until the
   * 1st" meaning midnight would silently drop everything raised on the 1st,
   * which is the day the reader was asking about.
   */
  it("opens the range at the start of the day and closes it at the end of one", () => {
    expect(
      toTicketQuery(slice({ createdAfter: "2026-07-01", createdBefore: "2026-07-01" })),
    ).toMatchObject({
      createdAfter: "2026-06-30T18:30:00.000Z",
      createdBefore: "2026-07-01T18:29:59.999Z",
    });
  });

  /**
   * A date control offers the days of the calendar the reader is looking at, so
   * the instant that begins their 1 July is midnight where they are. Reading it
   * as midnight UTC would answer about a different day and say nothing about it.
   */
  it("bounds the day the reader is in, not the same day in UTC", () => {
    const query = toTicketQuery(slice({ createdAfter: "2026-07-01" }));

    expect(query.createdAfter).not.toBe("2026-07-01T00:00:00.000Z");
    expect(new Date(query.createdAfter!).getDate()).toBe(1);
    expect(new Date(query.createdAfter!).getHours()).toBe(0);
  });

  it("sends one end of the range without the other", () => {
    const query = toTicketQuery(slice({ createdAfter: "2026-07-01" }));

    expect(query).toHaveProperty("createdAfter");
    expect(query).not.toHaveProperty("createdBefore");
  });
});

describe("what an empty choice means", () => {
  it("drops a filter nobody chose rather than sending it empty", () => {
    const query = toTicketQuery(slice({ state: [], priority: [], contactId: "  " }));

    expect(query).not.toHaveProperty("state");
    expect(query).not.toHaveProperty("priority");
    expect(query).not.toHaveProperty("contactId");
  });
});
