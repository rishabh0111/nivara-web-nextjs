/**
 * A Ticket, as this application reads one.
 *
 * The types come from the generated document rather than being restated here,
 * so a change to the API's shape is a compile error rather than a screen that
 * quietly renders `undefined`.
 */
import type { components } from "@/api/generated/openapi";

export type Ticket = components["schemas"]["TicketDto"];
export type TicketState = components["schemas"]["TicketState"];
export type TicketPriority = components["schemas"]["TicketPriority"];
export type TicketSource = components["schemas"]["TicketSource"];

/**
 * Five states, not four.
 *
 * The realtime schema documents four and is stale on this one field; the
 * database schema and `PATCH /tickets/:id/state` have five, and `on_hold`
 * interconverts freely with `open` and `pending`. Five is correct.
 *
 * Written as a `Record` keyed by the generated union on purpose: a state the
 * API adds and this map has not is a compile error, and so is one this map
 * names that the API dropped. That is the check, not a comment asking someone
 * to remember.
 */
export const TICKET_STATE_LABELS: Record<TicketState, string> = {
  open: "Open",
  pending: "Pending",
  on_hold: "On hold",
  resolved: "Resolved",
  closed: "Closed",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

/** The channels a Ticket can arrive on. Fixed at creation and never edited. */
export const TICKET_SOURCE_LABELS: Record<TicketSource, string> = {
  portal: "Portal",
  widget: "Widget",
  slack: "Slack",
};
