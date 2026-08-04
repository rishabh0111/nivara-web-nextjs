/**
 * The slice, as a URL carries it.
 *
 * A view of the queue is a place — somewhere a User returns to after a reload
 * and somewhere they send a colleague — and the only part of this application
 * that survives both is the address bar. So the slice is written there, and the
 * URL is read as the answer to what is on screen rather than as a copy of it.
 *
 * The parameters are spelled the way the API spells them, because a reader who
 * has seen one has seen the other and a second vocabulary would be one more
 * thing to keep in step. The dates are the exception and deliberately so: the
 * URL holds the calendar day the reader picked, not the instant it was widened
 * to, because the day is what the control shows and what has to come back. The
 * widening belongs to the request and happens once, in `queue-slice`.
 *
 * Decoding trusts nothing. A URL outlives the release that produced it, gets
 * truncated by a chat client and edited by hand, and an unknown parameter is a
 * 400 from this API — so every value is checked against what the generated
 * document defines, and anything else is dropped rather than passed on. What
 * comes out of here is a slice, which is the only thing that can become a
 * request.
 */
import {
  TICKET_PRIORITY_LABELS,
  TICKET_SOURCE_LABELS,
  TICKET_STATE_LABELS,
} from "@/tickets/ticket";

import {
  EVERYTHING,
  fromSortParameter,
  toAssigneeParameter,
  toSortParameter,
  type AssigneeFilter,
  type QueueSlice,
  type QueueSort,
} from "./queue-slice";

/**
 * The search string for a slice — `?state=open`, or empty for the whole queue.
 *
 * Only what was chosen is written. A URL carrying every default would be a
 * paragraph of parameters nobody set, and the one thing a shared link has to be
 * is legible enough that the person receiving it can see what they are being
 * shown.
 */
export function toQueueSearch(slice: QueueSlice): string {
  const written = new URLSearchParams();

  if (slice.state.length > 0) written.set("state", slice.state.join(","));
  if (slice.priority.length > 0) written.set("priority", slice.priority.join(","));
  if (slice.source.length > 0) written.set("source", slice.source.join(","));

  const assigneeId = toAssigneeParameter(slice.assignee);
  if (assigneeId !== undefined) written.set("assigneeId", assigneeId);

  const contactId = slice.contactId.trim();
  if (contactId !== "") written.set("contactId", contactId);

  if (slice.createdAfter !== "") written.set("createdAfter", slice.createdAfter);
  if (slice.createdBefore !== "") written.set("createdBefore", slice.createdBefore);

  const sort = toSortParameter(slice.sort);
  if (sort !== toSortParameter(EVERYTHING.sort)) written.set("sort", sort);

  const search = written.toString();
  return search === "" ? "" : `?${search}`;
}

/** The slice a search string describes, with everything it does not describe left whole. */
export function fromQueueSearch(search: string): QueueSlice {
  const read = new URLSearchParams(search);

  return {
    state: chosenFrom(read.get("state"), TICKET_STATE_LABELS),
    priority: chosenFrom(read.get("priority"), TICKET_PRIORITY_LABELS),
    source: chosenFrom(read.get("source"), TICKET_SOURCE_LABELS),
    assignee: assigneeFrom(read.get("assigneeId")),
    contactId: read.get("contactId")?.trim() ?? "",
    createdAfter: dayFrom(read.get("createdAfter")),
    createdBefore: dayFrom(read.get("createdBefore")),
    sort: sortFrom(read.get("sort")),
  };
}

/**
 * The values of one closed set that a comma-separated parameter names.
 *
 * Checked against the same label maps the controls are built from, which are
 * keyed by the generated union — so the set this validates against is the set
 * the API defines, and cannot quietly fall behind it. That is also what makes
 * the narrowing honest rather than asserted: what survives the filter is a key
 * of the map, and the map's keys are the union.
 */
function chosenFrom<Value extends string>(
  value: string | null,
  labels: Record<Value, string>,
): Value[] {
  if (value === null) return [];

  return value.split(",").filter((held): held is Value => held in labels);
}

/**
 * Which Tickets, rather than which control was clicked.
 *
 * `mine` and `user` are two questions that reach the wire as one id, so a URL
 * can only carry the id. Reading it back as `user` is the honest direction: the
 * same Tickets, named the general way.
 *
 * It is not free, and the cost is worth naming. A reader who chose "Assigned to
 * me" and reloaded comes back to "A named User" with their own id in the field
 * — the slice they get is identical, and the sentence over it is not the one
 * they wrote. Restoring the shortcut would mean comparing the id in the URL to
 * whoever is reading, which is a question the API answers a round trip later
 * than this: the queue would either wait on a name it deliberately does not
 * wait on, or re-check the radio underneath the reader when the name landed.
 * And done wrongly it is worse than lossy — a link opened by a colleague would
 * say "Assigned to me" over somebody else's queue.
 */
function assigneeFrom(value: string | null): AssigneeFilter {
  if (value === null || value.trim() === "") return { kind: "anyone" };
  if (value === "none") return { kind: "unassigned" };

  return { kind: "user", userId: value.trim() };
}

/** `YYYY-MM-DD` and nothing else — what a date control holds and what it will accept back. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayFrom(value: string | null): string {
  return value !== null && DAY.test(value) ? value : "";
}

/**
 * The order the URL names, or the API's own where it names none it knows.
 *
 * Falling back rather than refusing: a mistyped parameter is a reason to show
 * the queue in the default order, never a reason for the URL to decide there is
 * no queue.
 */
function sortFrom(value: string | null): QueueSort {
  return (value === null ? undefined : fromSortParameter(value)) ?? EVERYTHING.sort;
}
