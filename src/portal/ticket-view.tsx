"use client";

import { useEffect, useId, useRef } from "react";

import { describeError } from "@/api/query";
import type { Collection } from "@/api/use-collection";
import type { Message } from "@/tickets/message";
import type { Ticket } from "@/tickets/ticket";
import { TICKET_STATE_LABELS } from "@/tickets/ticket";
import { TicketSummary } from "@/tickets/ticket-summary";
import { TICKET_STATE_CHIP } from "@/tickets/ticket-row";
import { timeAgo } from "@/tickets/time-ago";
import { CollectionView, LoadMore } from "@/ui/collection-view";
import { MessageRow as SharedMessageRow } from "@/tickets/message-row";

import { CUSTOMER_AUTHOR_LABELS } from "@/tickets/customer-author";
import { usePortalChain } from "./portal-chain";
import { ReplyForm } from "./reply-form";
import { usePortalThread } from "./use-portal-tickets";
import { BackLink } from "@/ui/back-link";

/**
 * One Ticket and what has been said on it.
 *
 * The Ticket itself comes from the list that opened it rather than being read
 * again — it is the same record, and a second request would only give the
 * reader a second thing to wait for.
 *
 * A conversation that has run through more than one Ticket is shown as one
 * thread rather than as this Ticket alone, because that is what it is: the
 * Contact asked one question, and the Ticket changed underneath the answer.
 */
export function TicketView({
  ticket,
  onBack,
  /** Called with the Ticket a reply landed on, which need not be this one. */
  onFollow,
}: {
  ticket: Ticket;
  onBack: () => void;
  onFollow: (ticket: Ticket) => void;
}) {
  const thread = usePortalThread(ticket.id);
  const earlier = usePortalChain().earlier(ticket.id);

  const headingId = useId();
  const region = useRef<HTMLElement>(null);

  // Opening a Ticket replaces the list, and the element that was focused goes
  // with it. Without this, focus falls back to the top of the document: a
  // keyboard reader is returned to the start and a screen reader is told
  // nothing happened. Focusing the region announces which Ticket this is and
  // puts the next tab on "All tickets" rather than back at "Sign out".
  //
  // It runs again when a reply lands on a different Ticket, for the same
  // reason: the heading has changed and nobody has been told.
  useEffect(() => {
    region.current?.focus();
  }, [ticket.id]);

  return (
    <section ref={region} tabIndex={-1} aria-labelledby={headingId} className="space-y-4">
      <BackLink onClick={onBack}>All tickets</BackLink>

      <div className="border-b border-line pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id={headingId} className="text-xl font-bold tracking-tight text-balance">
            {ticket.subject}
          </h2>
          <span className={`chip ${TICKET_STATE_CHIP[ticket.state]} shrink-0`}>
            {TICKET_STATE_LABELS[ticket.state]}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-ink-muted">
          <TicketSummary ticket={ticket} />
        </p>
      </div>

      {earlier ? (
        /*
          There is history behind this Ticket, so the conversation is not empty
          whatever its own thread is doing. Rendering the two through one
          collection would hide everything said before this Ticket existed
          whenever this Ticket's own read is still arriving or was refused —
          which is exactly the moment the earlier half is worth most.
        */
        <div className="space-y-4">
          <ul aria-label="Conversation" className="space-y-4">
            <EarlierTicket ticket={earlier} />
            <ThreadRows thread={thread} waiting="Loading the conversation…" />
          </ul>
          <LoadMore
            collection={thread}
            label="Load more messages"
            end="That is everything said so far."
          />
        </div>
      ) : (
        <CollectionView
          collection={thread}
          waiting="Loading the conversation…"
          empty="Nothing has been said on this ticket yet."
        >
          {(messages) => (
            <div className="space-y-4">
              <ul aria-label="Conversation" className="space-y-4">
                {messages.map((message) => (
                  <MessageRow key={message.id} message={message} />
                ))}
              </ul>

              {/* Later, not earlier: the thread is asked for oldest first, so
                  the next page is what was said after this. */}
              <LoadMore
                collection={thread}
                label="Load more messages"
                end="That is everything said so far."
              />
            </div>
          )}
        </CollectionView>
      )}

      <ReplyForm ticket={ticket} onLanded={onFollow} />
    </section>
  );
}

/**
 * A Ticket this conversation ran through before the one being read, and
 * whatever that one continued in turn — rendered as rows of the conversation it
 * belongs to, so recursion covers a chain of any length without any component
 * knowing how long it is.
 */
function EarlierTicket({ ticket }: { ticket: Ticket }) {
  const thread = usePortalThread(ticket.id);
  const earlier = usePortalChain().earlier(ticket.id);

  return (
    <>
      {earlier ? <EarlierTicket ticket={earlier} /> : null}

      {/* What this part of the conversation was and what became of it, in the
          state it was in when the reply moved off it. Nothing here says why it
          moved: the API decides that, and it was not asked. */}
      <li className="border-l-2 border-line-strong pl-3 text-sm text-ink-muted">
        Earlier in this conversation: “{ticket.subject}”, now{" "}
        {TICKET_STATE_LABELS[ticket.state].toLowerCase()}.
      </li>

      <ThreadRows thread={thread} waiting="Loading the earlier conversation…" />

      {thread.hasMore ? (
        <li>
          <LoadMore
            collection={thread}
            label="Load more earlier messages"
            end="That is everything said earlier."
          />
        </li>
      ) : null}
    </>
  );
}

/**
 * One Ticket's messages as rows of a conversation that may span several.
 *
 * The waiting and refused states are rows too, rather than the paragraphs
 * `CollectionView` renders, because inside a list that is what they have to be —
 * and because one segment still arriving must not blank out the rest.
 */
function ThreadRows({ thread, waiting }: { thread: Collection<Message>; waiting: string }) {
  if (thread.isPending) {
    return <li className="text-sm text-ink-muted">{waiting}</li>;
  }

  if (thread.error) {
    return (
      <li role="alert" className="text-sm text-danger">
        {describeError(thread.error)}
      </li>
    );
  }

  return (
    <>
      {thread.items.map((message) => (
        <MessageRow key={message.id} message={message} />
      ))}
    </>
  );
}

function MessageRow({ message }: { message: Message }) {
  return (
    <SharedMessageRow
      author={CUSTOMER_AUTHOR_LABELS[message.authorKind]}
      body={message.body}
      // A Contact reading their own Portal: what they wrote is theirs, and
      // everything else on the thread came from the other side of the desk.
      side={message.authorKind === "contact" ? "mine" : "theirs"}
    >
      <time dateTime={message.createdAt} className="text-sm text-ink-muted">
        {timeAgo(message.createdAt)}
      </time>
    </SharedMessageRow>
  );
}
