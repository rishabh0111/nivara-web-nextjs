/**
 * Who has a Ticket now: the question the queue answers first.
 *
 * Read off the Ticket alone — its state and its assignee — so every row can
 * answer it without another request. "Needs a person" is the one that asks
 * for action: open or pending, and nobody has claimed it. That is where an AI
 * hand-over lands, and where a portal or Slack ticket waits before triage.
 */
import type { Ticket } from "@/tickets/ticket";

export type Holder = "needs-person" | "you" | "colleague" | "on-hold" | "finished";

export const HOLDER_LABELS: Record<Holder, string> = {
  "needs-person": "Needs a person",
  you: "With you",
  colleague: "With a colleague",
  "on-hold": "On hold",
  finished: "Finished",
};

export function holderOf(ticket: Pick<Ticket, "state" | "assigneeId">, me?: string): Holder {
  if (ticket.state === "resolved" || ticket.state === "closed") return "finished";
  if (ticket.state === "on_hold") return "on-hold";
  if (ticket.assigneeId === null) return "needs-person";
  return ticket.assigneeId === me ? "you" : "colleague";
}

/** Whether a person is what this Ticket is waiting on, and nobody has said they have it. */
export function needsPerson(ticket: Pick<Ticket, "state" | "assigneeId">): boolean {
  return holderOf(ticket) === "needs-person";
}
