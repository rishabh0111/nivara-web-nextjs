import { describeError } from "@/api/query";
import { describeFailure } from "@/api/errors";
import type { Ticket } from "@/tickets/ticket";
import { TICKET_STATE_LABELS } from "@/tickets/ticket";
import { timeAgo } from "@/tickets/time-ago";

import { useWidgetConversations } from "./use-widget-tickets";
import { useWidgetWrites } from "./use-widget-writes";
import { WidgetCompose } from "./widget-compose";
import type { WidgetTickets } from "./widget-tickets";

const OPENED_NOT_SAID =
  "Your conversation was started, but the message could not be sent. Try sending it again.";

/**
 * What a Visitor sees when they open the Widget: their conversations, or the
 * box to start one.
 *
 * An empty answer here is the *ordinary* starting state, not an empty state and
 * certainly not an error. A Visitor is anonymous until their first write — the
 * session has no Contact behind it and the API creates none for a read — so the
 * first thing every Visitor is ever shown is nothing, and the interface treats
 * that as an invitation rather than as a report.
 */
export function Conversations({
  api,
  onRead,
  onStart,
}: {
  api: WidgetTickets;
  onRead: (ticketId: string) => void;
  onStart: () => void;
}) {
  const conversations = useWidgetConversations(api);

  if (conversations.isPending) {
    return (
      <p className="nvw-quiet" role="status">
        Loading your conversations…
      </p>
    );
  }

  if (conversations.error) {
    return (
      <p className="nvw-problem" role="alert">
        {describeError(conversations.error)}
      </p>
    );
  }

  // Nothing yet, so the box is the whole screen. Offering a list header and an
  // empty-state line above a "start" button would be three pieces of furniture
  // in front of the one thing they came for.
  if (conversations.items.length === 0) {
    return <Start api={api} onStarted={onRead} />;
  }

  return (
    <div className="nvw-stack">
      <ul aria-label="Your conversations" className="nvw-list">
        {conversations.items.map((conversation) => (
          <li key={conversation.id}>
            {/*
              A button rather than a row with a handler on it, so the whole entry
              is one tab stop, one Enter away from opening, and one accessible
              name — the subject and everything needed to tell two of them apart.
            */}
            <button type="button" className="nvw-row" onClick={() => onRead(conversation.id)}>
              <span className="nvw-row-subject">{conversation.subject}</span>
              <span className="nvw-row-note">
                <Standing conversation={conversation} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {conversations.hasMore ? (
        <button type="button" className="nvw-more" onClick={() => conversations.loadMore()}>
          {conversations.isLoadingMore ? "Loading…" : "Show older conversations"}
        </button>
      ) : null}

      <button type="button" className="nvw-secondary" onClick={onStart}>
        Start a new conversation
      </button>
    </div>
  );
}

/**
 * Starting one.
 *
 * One box, and no subject field. The API opens a Ticket with a subject and
 * takes the first Message afterwards; asking a Visitor to title their question
 * before asking it would turn a chat into a form, so the subject is derived
 * from what they said — see `opening-subject.ts` for what that costs and why it
 * is worth it.
 */
export function Start({
  api,
  onStarted,
}: {
  api: WidgetTickets;
  onStarted: (ticketId: string) => void;
}) {
  const writes = useWidgetWrites(api);

  return (
    <div className="nvw-stack">
      <p className="nvw-greeting">Hi! What can we help with?</p>

      <WidgetCompose
        label="Your message"
        action="Send"
        acting="Sending…"
        announcement="What happened to your message"
        onSubmit={async (said) => {
          const outcome = await writes.start(said);

          if (outcome.started) {
            onStarted(outcome.ticket.id);
            return { said: true, outcome: "Sent." };
          }

          // Two writes, and which of them failed changes what is true. Where
          // the Ticket was opened, pressing send again sends only the message —
          // the half-opened one is held, so one question never becomes two
          // conversations.
          return {
            said: false,
            problem: outcome.opened
              ? `${OPENED_NOT_SAID} ${describeFailure(outcome.failure)}`
              : describeFailure(outcome.failure),
          };
        }}
      />
    </div>
  );
}

/** Where a conversation stands, in the words a Visitor reads it in. */
function Standing({ conversation }: { conversation: Ticket }) {
  return (
    <>
      {TICKET_STATE_LABELS[conversation.state]} · last reply{" "}
      {/* The instant, machine-readable, beside the reading of it — "3 hours
          ago" is only true for as long as the page has been open. */}
      <time dateTime={conversation.updatedAt}>{timeAgo(conversation.updatedAt)}</time>
    </>
  );
}
