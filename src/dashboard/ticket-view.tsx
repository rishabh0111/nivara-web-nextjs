"use client";

import { useEffect, useId, useRef } from "react";

import type { Ticket } from "@/tickets/ticket";
import { TicketSummary } from "@/tickets/ticket-summary";
import { TICKET_STATE_CHIP } from "@/tickets/ticket-row";
import { TICKET_STATE_LABELS } from "@/tickets/ticket";

import { AuditTimeline } from "./audit-timeline";
import { NoteForm } from "./note-form";
import { ReplyForm } from "./reply-form";
import { TicketActions } from "./ticket-actions";
import { TicketConversation } from "./ticket-conversation";
import { useTicketConversation } from "./use-dashboard-ticket";
import { useLiveTicket } from "./use-live-ticket";
import { BackLink } from "@/ui/back-link";

/**
 * One Ticket, understood, changed and answered.
 *
 * Three readings, in the order a User needs them: what happened, in the words of
 * whoever said it; what colleagues have noted about it; and what has been done to
 * it. They are three sections rather than one merged stream because they answer
 * three questions and are read in two different directions — the conversation
 * from the beginning, the log from the most recent change.
 *
 * The controls that change the Ticket sit under the header rather than at the
 * foot of the page, beside the summary they edit and above the conversation a
 * User may read a long way down. Reprioritising a Ticket is often the whole
 * visit, and a control that has to be scrolled past the thread to reach is one
 * that gets reached by the queue instead.
 *
 * Answering, though, comes after the reading. That order is the point of the
 * screen — and the reply and the internal note are adjacent and separate, which
 * is the one arrangement that makes the difference between them unmissable at
 * the moment it matters.
 *
 * The Ticket arrives from the queue rather than being read again by id. The
 * conversation read answers with every Ticket in the chain, this one included,
 * so the header is refreshed from that when it lands — the copy the queue was
 * holding was read before this screen opened, and its state may have moved since.
 */
export function TicketView({ ticket, onBack }: { ticket: Ticket; onBack: () => void }) {
  const conversation = useTicketConversation(ticket.id);
  const current = conversation.tickets?.find((held) => held.id === ticket.id) ?? ticket;

  // Read for as long as this Ticket is on the screen, and only this Ticket:
  // an earlier one in the chain is finished work, and nothing arrives on it.
  useLiveTicket(ticket.id);

  const headingId = useId();
  const region = useRef<HTMLElement>(null);

  // Opening a Ticket replaces the queue, and the element that was focused goes
  // with it. Without this, focus falls back to the top of the document: a
  // keyboard reader is returned to the start and a screen reader is told nothing
  // happened. Focusing the region announces which Ticket this is and puts the
  // next tab on "Back to the queue" rather than back at "Sign out".
  useEffect(() => {
    region.current?.focus();
  }, [ticket.id]);

  return (
    <section ref={region} tabIndex={-1} aria-labelledby={headingId} className="space-y-6">
      <BackLink onClick={onBack}>Back to tickets</BackLink>

      <div className="border-b border-line pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id={headingId} className="text-xl font-bold tracking-tight text-balance">
            {current.subject}
          </h2>
          <span className={`chip ${TICKET_STATE_CHIP[current.state]} shrink-0`}>
            {TICKET_STATE_LABELS[current.state]}
          </span>
        </div>
        {/* The same one-line reading the queue shows, kept whole: it is what a
            reader who arrived from the list is already holding in their head. */}
        <p className="mt-1.5 text-sm text-ink-muted">
          <TicketSummary ticket={current} />
        </p>
      </div>

      <TicketActions ticket={current} />

      <TicketConversation ticket={current} />

      {/* Both writes are against the Ticket the reader opened, never against an
          earlier one in the chain. An earlier Ticket is finished work; a reply
          addressed to one would be answered onto a record nobody is reading,
          and the API would move it anyway. */}
      <ReplyForm ticket={current} />

      <NoteForm ticketId={ticket.id} />

      <AuditTimeline ticketId={ticket.id} />
    </section>
  );
}
