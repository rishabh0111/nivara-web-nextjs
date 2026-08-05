"use client";

import { timeAgo } from "@/tickets/time-ago";
import { CollectionView, LoadMore } from "@/ui/collection-view";

import { describeAuditAction, describeAuditChange, type AuditEntry } from "./audit-entry";
import { STAFF_ACTOR_LABELS } from "./staff-actor";
import { useTicketAudit } from "./use-dashboard-ticket";

/**
 * Who changed what, and when.
 *
 * Control-plane changes only — the conversation is not here, and that is the
 * API's design rather than a filter this applies: Messages and Notes are domain
 * data attributed on their own rows, and the log records state and configuration.
 * Reading them as two things is the honest reading, so they are shown as two.
 *
 * Newest first, because the question a log answers on a live queue is what just
 * happened. That is the opposite order to the conversation above it, which is
 * read from the beginning — and it is why the two are separate lists with
 * separate headings rather than one timeline that changes direction halfway
 * down.
 */
export function AuditTimeline({ ticketId }: { ticketId: string }) {
  const audit = useTicketAudit(ticketId);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight">Activity</h3>

      <CollectionView
        collection={audit}
        waiting="Loading this ticket's activity…"
        empty="Nothing has been changed on this ticket."
      >
        {(entries) => (
          <div className="space-y-3">
            <ul aria-label="Ticket activity" className="divide-y divide-line text-sm">
              {entries.map((entry) => (
                <Entry key={entry.id} entry={entry} />
              ))}
            </ul>

            <LoadMore
              collection={audit}
              label="Load more activity"
              end="That is the whole history of this ticket."
            />
          </div>
        )}
      </CollectionView>
    </section>
  );
}

function Entry({ entry }: { entry: AuditEntry }) {
  const change = describeAuditChange(entry);

  return (
    <li className="py-2">
      <p>
        <span className="font-medium">{describeAuditAction(entry)}</span>
        {change ? <span className="text-ink-muted"> · {change}</span> : null}
      </p>
      <p className="text-ink-muted">
        {STAFF_ACTOR_LABELS[entry.actorKind]}
        {/*
          The id, not a name. Nothing on this API turns a User id into a person —
          there is no directory endpoint — and inventing one from the Tickets
          that happen to be loaded would name some actors and not others, which
          is worse than naming none. The id is what was recorded, and it is what
          is shown until there is somewhere to look it up.
        */}
        {entry.actorId ? <span className="font-mono"> {entry.actorId}</span> : null} ·{" "}
        <time dateTime={entry.createdAt}>{timeAgo(entry.createdAt)}</time>
      </p>
    </li>
  );
}
