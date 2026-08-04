/**
 * The slice, written into a URL and read back out of one.
 *
 * Two properties carry this: what a reader chose comes back unchanged, and what
 * arrives in a URL nobody trusts cannot become a request. The second is the one
 * with teeth — a URL is typed, edited, truncated and kept past the release that
 * changed the vocabulary, and an unknown query parameter is a 400.
 */
import { describe, expect, it } from "vitest";

import { EVERYTHING, toTicketQuery, type QueueSlice } from "./queue-slice";
import { fromQueueSearch, toQueueSearch } from "./queue-url";

function slice(overrides: Partial<QueueSlice> = {}): QueueSlice {
  return { ...EVERYTHING, ...overrides };
}

describe("the slice in the URL", () => {
  it("writes nothing when nothing is chosen", () => {
    expect(toQueueSearch(EVERYTHING)).toBe("");
  });

  it("reads the whole queue out of an empty URL", () => {
    expect(fromQueueSearch("")).toEqual(EVERYTHING);
  });

  it("brings every filter back exactly as it was chosen", () => {
    const chosen = slice({
      state: ["open", "on_hold"],
      priority: ["high", "urgent"],
      source: ["widget"],
      assignee: { kind: "user", userId: "usr_7" },
      contactId: "con_3",
      createdAfter: "2026-07-01",
      createdBefore: "2026-07-31",
      sort: { field: "updatedAt", direction: "asc" },
    });

    expect(fromQueueSearch(toQueueSearch(chosen))).toEqual(chosen);
  });

  it("writes only what was chosen, so a shared link is readable", () => {
    expect(toQueueSearch(slice({ state: ["open"] }))).toBe("?state=open");
  });

  /**
   * The order always has a value, so writing it always would put a parameter in
   * the URL of a reader who never touched the control.
   */
  it("leaves the default order out and writes any other", () => {
    expect(toQueueSearch(slice({ sort: { field: "createdAt", direction: "desc" } }))).toBe("");
    expect(toQueueSearch(slice({ sort: { field: "updatedAt", direction: "desc" } }))).toBe(
      "?sort=-updatedAt",
    );
  });

  it("carries the unclaimed pool as the sentinel, not as an absent assignee", () => {
    expect(toQueueSearch(slice({ assignee: { kind: "unassigned" } }))).toBe("?assigneeId=none");
    expect(fromQueueSearch("?assigneeId=none").assignee).toEqual({ kind: "unassigned" });
  });

  /**
   * `mine` and `user` are two questions and one request. The URL records which
   * Tickets, not which control was clicked, so the shortcut comes back as the
   * general form — the same id, the same Tickets, named the longer way. Keeping
   * the kind would mean a colleague opening the link reads "Assigned to me"
   * above somebody else's queue.
   */
  it("carries the reader's own queue as the id it filters by", () => {
    const mine = slice({ assignee: { kind: "mine", userId: "usr_1" } });

    expect(toQueueSearch(mine)).toBe("?assigneeId=usr_1");
    expect(fromQueueSearch(toQueueSearch(mine)).assignee).toEqual({
      kind: "user",
      userId: "usr_1",
    });
    expect(toTicketQuery(fromQueueSearch(toQueueSearch(mine)))).toEqual(toTicketQuery(mine));
  });
});

describe("a URL that cannot be trusted", () => {
  it("drops a value the API does not define", () => {
    expect(fromQueueSearch("?state=open,banana").state).toEqual(["open"]);
    expect(fromQueueSearch("?priority=hyperbolic").priority).toEqual([]);
    expect(fromQueueSearch("?source=carrier-pigeon").source).toEqual([]);
  });

  it("falls back to the default order rather than sending one the API refuses", () => {
    expect(fromQueueSearch("?sort=sideways").sort).toEqual(EVERYTHING.sort);
  });

  it("drops a date that is not a day", () => {
    expect(fromQueueSearch("?createdAfter=yesterday").createdAfter).toBe("");
    expect(fromQueueSearch("?createdBefore=2026-07-01T09:00:00.000Z").createdBefore).toBe("");
  });

  it("ignores a parameter it does not know, so it can never reach the wire", () => {
    const decoded = fromQueueSearch("?tenantId=ten_9&limit=500&state=open");

    expect(decoded).toEqual(slice({ state: ["open"] }));
    expect(toTicketQuery(decoded)).toEqual({ state: "open", sort: "-createdAt" });
  });
});
