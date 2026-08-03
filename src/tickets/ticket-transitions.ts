/**
 * Where a Ticket may go from where it is, and what may still be edited on it.
 *
 * The rules are the API's, and they are enforced in the database rather than in
 * the service — so an illegal move is refused identically on every write path,
 * and this copy of them is safe to *offer* from and would be unsafe to *trust*.
 * Nothing here decides what is allowed. It decides what a User is shown, so that
 * they learn the rules from the interface rather than by being refused.
 *
 * There is one rule the interface cannot offer honestly and does not try to:
 * moving to `closed` additionally requires a permission that the permission to
 * transition does not imply, and no read on this API says whether the signed-in
 * User holds it. So `closed` is offered from `resolved` to everyone, and a User
 * who may not close is told so by the write failing — which is the one case here
 * where the interface is not the whole truth.
 */
import type { TicketState } from "./ticket";

/**
 * Every legal destination from each state, as `PATCH /tickets/:id/state`
 * documents them: the three active states interconvert freely, any of them may
 * be resolved, a resolved Ticket reopens to `open` or moves to `closed`, and
 * `closed` is terminal — a later reply from the Contact opens a new linked
 * Ticket rather than reviving it.
 *
 * A `Record` keyed by the generated union, for the same reason the label maps
 * beside it are: a state the API adds and this table has not is a compile error,
 * not a Ticket that quietly has no way out.
 */
export const TICKET_TRANSITIONS: Record<TicketState, readonly TicketState[]> = {
  open: ["pending", "on_hold", "resolved"],
  pending: ["open", "on_hold", "resolved"],
  on_hold: ["open", "pending", "resolved"],
  resolved: ["open", "closed"],
  closed: [],
};

/**
 * Whether a Ticket's priority may still be changed.
 *
 * Its own rule and not a transition — priority is urgency and state is progress,
 * and the transition table is not consulted for it. The single exception is the
 * one this answers: a `closed` Ticket is a locked record, and the API answers
 * 409 to a priority edit on one.
 */
export function acceptsPriorityChange(state: TicketState): boolean {
  return state !== "closed";
}
