"use client";

import { describeError } from "@/api/query";
import { TICKET_STATE_LABELS, type Ticket } from "@/tickets/ticket";
import { timeAgo } from "@/tickets/time-ago";
import { LoadMore } from "@/ui/collection-view";
import { MessageRow } from "@/tickets/message-row";

import { STAFF_ACTOR_LABELS } from "./staff-actor";
import { mergeChronology, type ChronologyRow } from "./ticket-chronology";
import { useTicketConversation, useTicketNotes, useTicketThread } from "./use-dashboard-ticket";

/**
 * Everything that has been said about a Ticket, in the order it was said.
 *
 * Two things are being reassembled here, and they are different problems.
 *
 * Along the conversation: a `closed` Ticket is terminal, so replying to one
 * opens a new linked Ticket rather than reviving it. The Dashboard does not have
 * to watch that happen the way the Portal does — `GET /tickets/:id/conversation`
 * answers with the whole chain from whichever Ticket is in hand — so a
 * conversation that has been finished and resumed four times reads as one
 * history, and a reader never has to notice that it was ever four records.
 *
 * Within one Ticket: the customer-visible thread and the internal Notes are
 * separate tables behind separate endpoints, and merging them is this
 * application's job. `ticket-chronology` owns the ordering; this owns the
 * rendering, and the one thing it must never get wrong is which is which.
 */
export function TicketConversation({ ticket }: { ticket: Ticket }) {
  const conversation = useTicketConversation(ticket.id);

  // The Ticket in hand is a chain of one until the API says otherwise. Waiting
  // on the chain before showing anything would hold back the thread of the
  // Ticket the reader actually opened — for a conversation of one, which is the
  // common case, that is a wait for nothing.
  const chain = conversation.tickets ?? [ticket];
  const linked = chain.length > 1;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight">Conversation</h3>

      {conversation.error ? (
        <p role="alert" className="text-sm text-danger">
          The rest of this conversation could not be loaded, so what follows may be only part of it.{" "}
          {describeError(conversation.error)}
        </p>
      ) : null}

      <ul aria-label="Conversation" className="space-y-3">
        {chain.map((held) => (
          <Segment
            key={held.id}
            ticket={held}
            // Named only where there is more than one to tell apart. A heading
            // over a conversation that has only ever been one Ticket would be
            // repeating the subject at the top of the page.
            named={linked}
            here={held.id === ticket.id}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * One Ticket's part of the conversation.
 *
 * Its own component, so its two reads belong to it: a chain of four is four
 * pairs of cursors, and a segment paging on is not the rest of the conversation
 * paging with it.
 */
function Segment({ ticket, named, here }: { ticket: Ticket; named: boolean; here: boolean }) {
  const thread = useTicketThread(ticket.id);
  const notes = useTicketNotes(ticket.id);

  const history = mergeChronology(thread, notes);
  const failure = thread.error ?? notes.error;

  // Both halves are asked for at once and neither is the conversation on its
  // own, so the wait is over only when both have answered.
  const waiting = thread.isPending || notes.isPending;

  // What the reader is offered is one control, because they are reading one
  // history: two "load more" buttons over interleaved rows would be asking them
  // to know which endpoint the next paragraph came from.
  const more = {
    hasMore: thread.hasMore || notes.hasMore,
    isLoadingMore: thread.isLoadingMore || notes.isLoadingMore,
    loadMore: () => {
      if (thread.hasMore) thread.loadMore();
      if (notes.hasMore) notes.loadMore();
    },
    pages: Math.max(thread.pages, notes.pages),
  };

  return (
    <>
      {named ? (
        <li className={here ? "pt-2 text-sm font-medium" : "pt-2 text-sm text-ink-muted"}>
          {here ? "This ticket" : "Earlier in this conversation"}: “{ticket.subject}”,{" "}
          {TICKET_STATE_LABELS[ticket.state].toLowerCase()}.
        </li>
      ) : null}

      {waiting ? <li className="text-sm text-ink-muted">Loading the conversation…</li> : null}

      {failure ? (
        <li role="alert" className="text-sm text-danger">
          {describeError(failure)}
        </li>
      ) : null}

      {history.settled.map((row) => (
        <Row key={row.id} row={row} />
      ))}

      {/* Nothing said, and nothing on its way — as opposed to nothing said
       *yet*, which is what a page still in flight looks like from here. */}
      {!waiting &&
      !failure &&
      history.settled.length === 0 &&
      history.unsettled.length === 0 &&
      !more.hasMore ? (
        <li className="text-sm text-ink-muted">Nothing has been said on this ticket yet.</li>
      ) : null}

      {/*
        The control sits at the boundary rather than at the foot of the list,
        because that is where the missing part of the conversation is. What
        follows it has been read from both endpoints but not through the same
        stretch of time, so a page arriving later can land in among it — the
        reader is told that, in place, instead of watching rows appear above
        their cursor with no explanation.
      */}
      {more.hasMore || more.pages > 1 ? (
        <li>
          <LoadMore
            collection={more}
            label="Load more of this conversation"
            end="That is everything on this ticket."
          />
        </li>
      ) : null}

      {history.unsettled.length > 0 ? (
        <li className="text-sm text-ink-muted">
          Below is the most recent part of this ticket. Earlier messages are still to be loaded, and
          some of them belong in among what follows.
        </li>
      ) : null}

      {history.unsettled.map((row) => (
        <Row key={row.id} row={row} />
      ))}
    </>
  );
}

function Row({ row }: { row: ChronologyRow }) {
  return row.kind === "message" ? (
    <MessageRow
      author={STAFF_ACTOR_LABELS[row.message.authorKind]}
      body={row.message.body}
      // From a User's seat the Contact is the other party. Everything else on
      // this thread — a colleague, an automation, the system — is this side.
      side={row.message.authorKind === "contact" ? "theirs" : "mine"}
    >
      <When at={row.at} />
    </MessageRow>
  ) : (
    <NoteRow author={STAFF_ACTOR_LABELS[row.note.authorKind]} at={row.at} body={row.note.body} />
  );
}

/**
 * An internal Note, made unmistakable.
 *
 * The cost of confusing these two is a colleague's aside sent to the customer,
 * or a customer's question answered into a log nobody reads — so the difference
 * is carried four times over and not by a label alone: the row is inset and
 * tinted, it is edged rather than bordered, it says in words that the customer
 * cannot see it, and it says that *before* the note rather than after, so a
 * reader hearing the page read aloud knows what they are listening to before
 * they have heard it.
 *
 * Colour is the one of the four that does the least work. It is the fastest to
 * read and the first to be unavailable, which is exactly the wrong order to
 * depend on it in.
 */
function NoteRow({ author, at, body }: { author: string; at: string; body: string }) {
  return (
    <li className="ml-6 rounded-card border border-line border-l-4 border-l-note bg-note-wash p-3">
      <p className="text-sm font-semibold text-note">Internal note: not visible to the customer</p>
      <p className="text-sm leading-relaxed text-ink">
        {author} <When at={at} />
      </p>
      <p className="whitespace-pre-wrap">{body}</p>
    </li>
  );
}

/** The instant, machine-readable, beside the reading of it. */
function When({ at }: { at: string }) {
  return (
    <time dateTime={at} className="font-normal text-ink-muted">
      {timeAgo(at)}
    </time>
  );
}
