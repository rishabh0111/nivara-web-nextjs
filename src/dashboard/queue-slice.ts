/**
 * The slice of the queue a User is working, and the query that asks for it.
 *
 * Two shapes, deliberately not one. The slice is what the interface edits —
 * chosen states, a picked day, an assignee the reader thought about in words.
 * The query is what goes on the wire, in the API's own vocabulary: a
 * comma-separated list, an ISO-8601 instant, the `none` sentinel, a leading `-`
 * for descending. Converting between them once, here, is what keeps the
 * controls from having to know the wire and the wire from having to carry the
 * controls' conveniences.
 *
 * The query type comes from the generated document, so a parameter this API does
 * not define cannot be built here at all — unknown parameters are a 400, and a
 * filter is added deliberately or not at all.
 */
import type { Operation, QueryOf } from "@/api/operations";
import { endOfDay, startOfDay } from "@/time/calendar-day";
import type { TicketPriority, TicketSource, TicketState } from "@/tickets/ticket";

/** Every query parameter `GET /tickets` defines, and no others. */
export type TicketQuery = Exclude<QueryOf<Operation<"/tickets", "get">>, undefined>;

/**
 * Who a Ticket is assigned to, as a question rather than as a value.
 *
 * The unclaimed pool is its own kind and not a magic id, because the API spells
 * it `none` and a User whose id were ever that string would otherwise be
 * indistinguishable from "nobody". Asking about the pool and asking about a
 * person are different questions, and the type says so.
 *
 * `mine` and `user` reach the wire identically — both are one id — and are still
 * two kinds, because they are two questions and the slice records which was
 * asked. Deriving "this is my queue" by comparing the held id to the signed-in
 * User's would make a reader who typed their own id into the by-name field
 * watch that field disappear underneath them.
 */
export type AssigneeFilter =
  | { kind: "anyone" }
  | { kind: "unassigned" }
  | { kind: "mine"; userId: string }
  | { kind: "user"; userId: string };

export type QueueSortField = "createdAt" | "updatedAt";
export type QueueSortDirection = "asc" | "desc";
export type QueueSort = { field: QueueSortField; direction: QueueSortDirection };

export type QueueSlice = {
  state: TicketState[];
  priority: TicketPriority[];
  source: TicketSource[];
  assignee: AssigneeFilter;
  /** A Contact's id, or empty for any Contact. */
  contactId: string;
  /** A calendar day, `YYYY-MM-DD`, as a date control gives it. Empty for open-ended. */
  createdAfter: string;
  createdBefore: string;
  sort: QueueSort;
};

/** The whole queue, newest first — the API's own default, stated rather than implied. */
export const EVERYTHING: QueueSlice = {
  state: [],
  priority: [],
  source: [],
  assignee: { kind: "anyone" },
  contactId: "",
  createdAfter: "",
  createdBefore: "",
  sort: { field: "createdAt", direction: "desc" },
};

/**
 * Whether anything is chosen.
 *
 * Sort is not a filter — it always has a value and never narrows anything — so
 * it is not counted here. What this answers is whether an empty result means
 * "nothing matched" or "there is no work", which are different things to say.
 */
export function isNarrowed(slice: QueueSlice): boolean {
  return (
    slice.state.length > 0 ||
    slice.priority.length > 0 ||
    slice.source.length > 0 ||
    slice.assignee.kind !== "anyone" ||
    slice.contactId.trim() !== "" ||
    slice.createdAfter !== "" ||
    slice.createdBefore !== ""
  );
}

export function toTicketQuery(slice: QueueSlice): TicketQuery {
  const query: TicketQuery = { sort: toSortParameter(slice.sort) };

  if (slice.state.length > 0) query.state = slice.state.join(",");
  if (slice.priority.length > 0) query.priority = slice.priority.join(",");
  if (slice.source.length > 0) query.source = slice.source.join(",");

  const assigneeId = toAssigneeParameter(slice.assignee);
  if (assigneeId !== undefined) query.assigneeId = assigneeId;

  const contactId = slice.contactId.trim();
  if (contactId !== "") query.contactId = contactId;

  // Both ends of the range are inside it. A reader asking for "created until the
  // 31st" means the 31st counts; taking that as midnight would drop the whole of
  // the day they named, and they would see a shorter list with nothing to
  // explain it. `createdBefore` is inclusive here, which is what makes the last
  // instant of the day the right bound rather than the first of the next.
  if (slice.createdAfter !== "") query.createdAfter = startOfDay(slice.createdAfter);
  if (slice.createdBefore !== "") query.createdBefore = endOfDay(slice.createdBefore);

  return query;
}

/**
 * The assignee, as the API spells one: an id, or the `none` sentinel.
 *
 * Exported for the same reason `toSortParameter` is — the URL asks the same
 * question of the same filter, and a second place that knew `none` meant the
 * unclaimed pool would agree with this one until one of them changed.
 */
export function toAssigneeParameter(assignee: AssigneeFilter): string | undefined {
  switch (assignee.kind) {
    case "anyone":
      return undefined;
    case "unassigned":
      return "none";
    case "mine":
    case "user":
      return assignee.userId.trim() === "" ? undefined : assignee.userId.trim();
  }
}

/**
 * The order, as the API spells one: the field, and a leading `-` for descending.
 *
 * Exported because the order control needs to name the four orders it offers,
 * and a control that spelled them itself would be the second place this
 * application knows how the parameter is written.
 */
export function toSortParameter(sort: QueueSort): string {
  return `${sort.direction === "desc" ? "-" : ""}${sort.field}`;
}

/**
 * The order a parameter names, or nothing where it names none.
 *
 * The inverse of the above and beside it, so the leading `-` is still known in
 * one place. Nothing rather than a default, because the two callers want
 * different things from an order they cannot read: a restored URL falls back to
 * the API's own, and a control ignores it.
 */
export function fromSortParameter(parameter: string): QueueSort | undefined {
  const direction = parameter.startsWith("-") ? "desc" : "asc";
  const field = parameter.replace(/^-/, "");

  return field === "createdAt" || field === "updatedAt" ? { field, direction } : undefined;
}
