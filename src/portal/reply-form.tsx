"use client";

import { describeFailure } from "@/api/errors";
import type { Ticket } from "@/tickets/ticket";
import { Compose } from "@/ui/compose";

import { usePortalWrites } from "./use-portal-writes";

const MOVED = "Your reply opened a new ticket, and you are reading it now.";
const MOVED_UNREAD =
  "Your reply was sent and opened a new ticket, which could not be loaded. Go back to your tickets to find it.";
const SENT = "Your reply was sent.";

/**
 * Continuing the conversation.
 *
 * Where the reply lands is the API's decision, not this form's: a `closed`
 * Ticket is terminal, and replying there opens a new linked Ticket instead of
 * reviving it. So this reports where the message went rather than assuming it
 * stayed, and hands the Contact to that Ticket when it moved. Nothing here
 * inspects `ticket.state` to decide in advance — a prediction that happened to
 * be right most of the time is how a Contact ends up reading a Ticket their
 * message is not on.
 */
export function ReplyForm({
  ticket,
  /** Called with the Ticket the reply landed on, as the API has just described it. */
  onLanded,
}: {
  ticket: Ticket;
  onLanded: (ticket: Ticket) => void;
}) {
  const writes = usePortalWrites();

  return (
    <Compose
      label="Reply"
      action="Send reply"
      acting="Sending…"
      announcement="What happened to your reply"
      onSubmit={async (said) => {
        const outcome = await writes.reply(ticket, said);
        if (!outcome.sent) return { said: false, problem: describeFailure(outcome.failure) };

        // Sent, but nowhere this client can name. Saying so is better than
        // sending the Contact to a Ticket their message is not on — and it is
        // not a failure, because a retry would say the same thing twice.
        if (!outcome.landedOn) return { said: true, outcome: MOVED_UNREAD };

        // Handed over even when it is the same Ticket: a reply reopens a
        // `pending` or `resolved` one, and the reader is looking straight at the
        // state that just changed.
        onLanded(outcome.landedOn);
        return { said: true, outcome: outcome.landedOn.id === ticket.id ? SENT : MOVED };
      }}
    />
  );
}
