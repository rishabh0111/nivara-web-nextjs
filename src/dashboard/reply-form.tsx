"use client";

import { describeFailure } from "@/api/errors";
import type { Ticket } from "@/tickets/ticket";
import { Compose } from "@/ui/compose";

import { useTicketWrites } from "./use-ticket-writes";

const SENT = "Your reply was sent to the customer.";
const MOVED =
  "Your reply was sent. This ticket was closed, so it opened a new linked ticket and appears there in the conversation above.";

/**
 * Answering the Contact.
 *
 * Its own form, and never one box with a "visible to customer" toggle beside the
 * internal note. The API models these as two endpoints over two tables, and the
 * interface follows rather than flattening them back together: a single control
 * is one mis-click from posting a colleague's aside to the person it was about,
 * and nothing takes that back.
 *
 * Where the reply lands is the API's answer, not this form's guess. A reply
 * reopens a `pending` or `resolved` Ticket, and a terminal one it does not
 * revive at all — it opens a new linked Ticket and becomes that one's first
 * Message. So this reads `ticketId` off the response. Nothing here inspects
 * `ticket.state` to work it out in advance; a prediction that is right most of
 * the time is how a User is told their answer went somewhere it did not.
 *
 * The Dashboard does not have to follow the reply anywhere, which is the one
 * place it is better off than the Portal: the conversation on screen is the
 * whole chain, so a reply that moved is still in front of the reader — it is
 * simply in a different part of it, and saying so is the whole of the handling.
 */
export function ReplyForm({ ticket }: { ticket: Ticket }) {
  const writes = useTicketWrites(ticket.id);

  return (
    <Compose
      label="Reply to the customer"
      help="The customer will see this. For something only colleagues should read, use the internal note below instead."
      action="Send reply"
      acting="Sending…"
      announcement="What happened to your reply"
      onSubmit={async (said) => {
        const sent = await writes.reply(said);
        if (!sent.ok) return { said: false, problem: describeFailure(sent.failure) };

        return { said: true, outcome: sent.value.ticketId === ticket.id ? SENT : MOVED };
      }}
    />
  );
}
