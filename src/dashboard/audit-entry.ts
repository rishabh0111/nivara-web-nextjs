/**
 * An audit entry, read.
 *
 * The log is deliberately generic on the wire: an action, a pair of nullable
 * strings, and an actor. What those strings mean is decided by the action beside
 * them — `open` is a state on a transition and a user id on an assignment — so
 * reading them happens once, here, rather than in whichever component happens to
 * be rendering the row.
 *
 * The label maps are `Record`s keyed by the generated unions on purpose: an
 * action the API adds and this file has not is a compile error rather than a row
 * that renders as nothing.
 */
import type { components } from "@/api/generated/openapi";
import { TICKET_PRIORITY_LABELS, TICKET_STATE_LABELS } from "@/tickets/ticket";

export type AuditEntry = components["schemas"]["AuditEntryDto"];
export type AuditAction = components["schemas"]["AuditAction"];

/**
 * What happened, in the words a User reads.
 *
 * Ticket-scoped and token-scoped actions are both here because both reach this
 * timeline — a service token minting against a Ticket is recorded on it.
 */
const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "ticket.created": "Ticket opened",
  "ticket.transitioned": "State changed",
  "ticket.assigned": "Assignee changed",
  "ticket.priority_changed": "Priority changed",
  "sla.breached": "SLA breached",
  "token.minted": "Service token minted",
  "token.revoked": "Service token revoked",
  "integration.failed": "Integration failed",
};

export function describeAuditAction(entry: AuditEntry): string {
  return AUDIT_ACTION_LABELS[entry.action];
}

/**
 * The change itself — `Open → Pending` — or nothing where the action records no
 * values.
 *
 * Assignment is the one action where a null is an answer rather than an absence:
 * "nobody" is a state of responsibility, and a row reading only `usr_2` would
 * not say whether that was a hand-over or a first claim.
 */
export function describeAuditChange(entry: AuditEntry): string | undefined {
  const from = readValue(entry.action, entry.fromValue);
  const to = readValue(entry.action, entry.toValue);

  if (from !== undefined && to !== undefined) return `${from} → ${to}`;
  return to ?? from;
}

function readValue(action: AuditAction, value: string | null): string | undefined {
  if (action === "ticket.assigned") return value ?? "Unassigned";
  if (value === null) return undefined;

  // Through the catalog where the action says there is one, and verbatim where
  // there is not. A value outside the catalog is the API having moved on, and
  // the honest rendering of it is the string that was recorded.
  if (action === "ticket.transitioned") return labelled(TICKET_STATE_LABELS, value);
  if (action === "ticket.priority_changed") return labelled(TICKET_PRIORITY_LABELS, value);

  return value;
}

function labelled(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}
