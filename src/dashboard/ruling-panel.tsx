"use client";

/**
 * What the AI did with this Ticket, and who has it now.
 *
 * The first thing in the side column (first in the thread on a phone), because
 * it is the first question a User opening a Ticket asks: did the AI already deal
 * with this, and if not, why not, and is it mine? The strip is the one each
 * queue row carries in miniature. Where the gate's Note states its retrieval
 * figures, they are drawn the way the product page draws them: the top passage
 * and the next one on one axis, and the lead between them.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { unwrap } from "@/api/query";
import {
  gateSignals,
  handOverReason,
  rulingOf,
  RULING_SOURCE,
  verdictOf,
  type GateSignals,
  type HandOverReason,
  type Ruling,
} from "@/tickets/ruling";
import { RulingStrip } from "@/tickets/ruling-strip";
import type { Ticket } from "@/tickets/ticket";

import { dashboardKeys } from "./dashboard-keys";
import { createDashboardTicket } from "./dashboard-ticket";
import { useDashboardSession } from "./dashboard-session-context";
import { HOLDER_LABELS, holderOf, type Holder } from "./holder";
import { useStaffPrincipal } from "./use-staff-principal";

/** Enough of the newest of each to compare the latest escalation with the latest reply. */
const NEWEST = 10;

export type TicketRuling = {
  reading: boolean;
  ruling: Ruling | undefined;
  reason: HandOverReason | undefined;
  signals: GateSignals | undefined;
  verdict: string;
};

/**
 * The ruling on one Ticket, from the newest Notes and messages, newest first —
 * so a long thread is read from its end, which is where the ruling is. Both are
 * read here (unlike a queue row), so a later answer after a hand-over wins.
 */
export function useTicketRuling(ticket: Ticket): TicketRuling {
  const session = useDashboardSession();
  const reads = useMemo(() => createDashboardTicket(session), [session]);

  const query = useQuery({
    queryKey: [...dashboardKeys.ticket(ticket.id), "ruling-detail", ticket.updatedAt],
    queryFn: async () => {
      const [notes, messages] = await Promise.all([
        reads.latestNotes(ticket.id, NEWEST),
        reads.latestMessages(ticket.id, NEWEST),
      ]);
      return { notes: unwrap(notes).items, messages: unwrap(messages).items };
    },
    staleTime: Infinity,
    retry: false,
  });

  if (!query.data) {
    return {
      reading: query.isPending,
      ruling: undefined,
      reason: undefined,
      signals: undefined,
      verdict: query.isPending ? "" : verdictOf(undefined, undefined),
    };
  }

  const { notes, messages } = query.data;
  const ruling = rulingOf(ticket.state, messages, notes);
  const reason = ruling === "escalate" ? handOverReason(notes) : undefined;

  return {
    reading: false,
    ruling,
    reason,
    signals: ruling === "escalate" ? gateSignals(notes) : undefined,
    verdict: verdictOf(ruling, reason),
  };
}

const HOLDER_CHIP: Record<Holder, string> = {
  "needs-person": "chip chip-open",
  you: "chip chip-ink",
  colleague: "chip chip-neutral",
  "on-hold": "chip chip-neutral",
  finished: "chip chip-go",
};

/** The axis the product page draws passage scores on, so figures compare by eye. */
const AXIS = 2.5;

export function RulingPanel({ ticket, read }: { ticket: Ticket; read: TicketRuling }) {
  const principal = useStaffPrincipal();
  const holder = holderOf(ticket, principal?.userId);

  return (
    <section aria-labelledby="ruling-heading" className="card space-y-3 p-4">
      <div>
        <h2 id="ruling-heading" className="text-[0.9375rem] font-medium">
          What the AI did
        </h2>
        <p className="text-xs text-ink-muted">{RULING_SOURCE}</p>
      </div>

      {read.reading ? (
        <>
          <div aria-hidden="true" className="ruling animate-sheen">
            <span>Answer</span>
            <span>Ask</span>
            <span>Hand over</span>
          </div>
          <p role="status" className="sr-only">
            Reading the conversation…
          </p>
        </>
      ) : (
        <RulingStrip ruling={read.ruling} />
      )}

      {read.signals ? <Passages signals={read.signals} /> : null}

      {read.reason ? (
        <p className="text-xs text-ink-muted">
          Reason <code className="text-ink">{read.reason.code}</code>
        </p>
      ) : null}

      <p className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
        <span className="text-ink-muted">Who has it now</span>
        <span className={HOLDER_CHIP[holder]}>{HOLDER_LABELS[holder]}</span>
      </p>
    </section>
  );
}

/**
 * The top passage and the next one, on the product page's fixed axis, and the
 * lead between them in the accent. The next passage's score is the top score
 * less the margin the Note states — arithmetic on two stated figures, nothing
 * estimated.
 */
function Passages({ signals }: { signals: GateSignals }) {
  const next = Math.max(0, signals.topScore - signals.margin);
  const rows = [
    { label: "Top passage", score: signals.topScore, ink: "bg-ink" },
    { label: "Next passage", score: next, ink: "bg-ink-muted" },
  ];

  return (
    <figure className="space-y-1.5">
      <ol aria-label="What the gate found" className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.75rem] items-center gap-2.5 text-[0.8125rem]"
          >
            <span className="text-ink-muted">{row.label}</span>
            <span aria-hidden="true" className="block h-2.5 overflow-hidden rounded-[3px] bg-sunken">
              <i
                className={`block h-full rounded-[3px] ${row.ink}`}
                style={{ width: `${Math.min(100, (row.score / AXIS) * 100)}%` }}
              />
            </span>
            <b className="num text-right font-medium">{row.score.toFixed(2)}</b>
          </li>
        ))}
      </ol>
      <figcaption className="text-[0.8125rem]">
        Lead over the next passage{" "}
        <b className="num font-medium text-accent-text">{signals.margin.toFixed(2)}</b>
      </figcaption>
    </figure>
  );
}
