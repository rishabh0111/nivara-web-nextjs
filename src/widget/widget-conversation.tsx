import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { describeFailure } from "@/api/errors";
import { describeError, unwrap } from "@/api/query";
import { CUSTOMER_AUTHOR_LABELS } from "@/tickets/customer-author";
import type { Message } from "@/tickets/message";
import { TICKET_STATE_LABELS } from "@/tickets/ticket";
import { timeAgo } from "@/tickets/time-ago";

import { useAiTurn } from "./use-ai-turn";
import { useWidgetThread } from "./use-widget-tickets";
import { useWidgetWrites } from "./use-widget-writes";
import { WidgetCompose } from "./widget-compose";
import { widgetKeys } from "./widget-keys";
import { WidgetTurnNotice } from "./widget-turn-notice";
import type { WidgetSession } from "./widget-session";
import type { WidgetTickets } from "./widget-tickets";

const SENT = "Sent.";
const MOVED =
  "That conversation had been closed, so this started a new conversation. You are reading it now.";
const MOVED_UNREAD =
  "Your message was sent and started a new conversation, which could not be loaded. Go back to find it.";

/**
 * One conversation, read and continued.
 *
 * The Ticket is read by id rather than handed down from the list, because the
 * Visitor may not have come from the list: a conversation they were reading
 * when they clicked a link on the Tenant's site is restored from an id and
 * nothing else.
 */
export function Conversation({
  api,
  session,
  ticketId,
  /** Called with the conversation a message landed on, which need not be this one. */
  onFollow,
}: {
  api: WidgetTickets;
  session: WidgetSession;
  ticketId: string;
  onFollow: (ticketId: string) => void;
}) {
  const conversation = useQuery({
    queryKey: widgetKeys.conversation(ticketId),
    queryFn: async () => unwrap(await api.one(ticketId)),
  });
  const thread = useWidgetThread(api, ticketId);
  const writes = useWidgetWrites(api);
  const aiTurn = useAiTurn(session);

  // Asked for newest first, so a Visitor returning to a long conversation gets
  // the last thing said rather than the first. Read downwards, which is what a
  // reversal of the whole concatenation gives — see `widget-tickets.ts`.
  const said = useMemo(() => thread.items.slice().reverse(), [thread.items]);

  return (
    <div className="nvw-stack">
      {conversation.data ? (
        <p className="nvw-standing">{TICKET_STATE_LABELS[conversation.data.state]}</p>
      ) : conversation.error ? (
        // Said here rather than left for the composer to refuse on submit. The
        // Visitor must not type a paragraph into a box that was never going to
        // send it.
        <p className="nvw-problem" role="alert">
          {describeError(conversation.error)}
        </p>
      ) : null}

      {thread.hasMore ? (
        <button type="button" className="nvw-more" onClick={() => thread.loadMore()}>
          {thread.isLoadingMore ? "Loading…" : "Show earlier messages"}
        </button>
      ) : null}

      {thread.isPending ? (
        <p className="nvw-quiet" role="status">
          Loading this conversation…
        </p>
      ) : thread.error ? (
        <p className="nvw-problem" role="alert">
          {describeError(thread.error)}
        </p>
      ) : (
        <Thread said={said} />
      )}

      <WidgetCompose
        label="Your message"
        action="Send"
        acting="Sending…"
        announcement="What happened to your message"
        onSubmit={async (body) => {
          if (!conversation.data) {
            // Nothing to reply to that this client can name. The read that
            // would have named it is on screen as its own problem, and sending
            // against an id whose Ticket could not be read would be guessing.
            return { said: false, problem: "This conversation could not be loaded." };
          }

          const outcome = await writes.reply(conversation.data, body);
          if (!outcome.sent) return { said: false, problem: describeFailure(outcome.failure) };

          // Sent, but nowhere this client can name — which only happens where
          // it moved. Saying so beats sending the Visitor to a conversation
          // their message is not in, and it is not a failure: a retry would say
          // the same thing twice.
          if (!outcome.landedOn) return { said: true, outcome: MOVED_UNREAD };

          // Whichever Conversation the message actually landed on is the one
          // nivara-ai is asked to answer — the reply just sent is what it has
          // to work with either way.
          aiTurn.trigger(outcome.landedOn.id);

          if (outcome.landedOn.id === ticketId) return { said: true, outcome: SENT };

          // A closed conversation is terminal and is not revived; the reply
          // opened a new linked one. The Visitor is taken to where their
          // message actually is rather than left reading the one it left.
          onFollow(outcome.landedOn.id);
          return { said: true, outcome: MOVED };
        }}
      />

      <WidgetTurnNotice state={aiTurn.state} />
    </div>
  );
}

/**
 * What has been said, oldest at the top.
 *
 * A log rather than a plain list: a Visitor using a screen reader is told about
 * a reply arriving without having to go looking for it, which is what makes
 * this read as a conversation rather than as a page that has to be re-read.
 */
function Thread({ said }: { said: Message[] }) {
  const bottom = useRef<HTMLDivElement>(null);

  // The newest message is the one worth seeing, so the scroll starts at the
  // bottom and returns there as the conversation grows. Earlier messages are
  // asked for deliberately, above.
  useEffect(() => {
    // Called only where the browser has it. This is a nicety on top of a
    // conversation that is already correct, and it runs inside somebody else's
    // page — the one place a missing method must not become their error.
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [said.length]);

  return (
    <div className="nvw-thread">
      {said.length === 0 ? <p className="nvw-quiet">Nothing has been said here yet.</p> : null}

      {/*
        Rendered whether or not there is anything in it, so a screen reader is
        already watching this region when a message arrives — a live region
        inserted at the same moment as its content is frequently not announced,
        and this one is inserted the instant a conversation opens.
      */}
      <ul aria-label="Conversation" className="nvw-said" role="log" aria-live="polite">
        {said.map((message) => (
          <li
            key={message.id}
            className={message.authorKind === "contact" ? "nvw-mine" : "nvw-theirs"}
          >
            <p className="nvw-who">
              {CUSTOMER_AUTHOR_LABELS[message.authorKind]}{" "}
              <time dateTime={message.createdAt}>{timeAgo(message.createdAt)}</time>
            </p>
            {/* Plain text, stored verbatim. Markup in it is what somebody
                typed, not markup. */}
            <p className="nvw-body-text">{message.body}</p>
          </li>
        ))}
      </ul>
      <div ref={bottom} />
    </div>
  );
}
