import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef } from "react";

import type { ApiFailure } from "@/api/errors";
import { sendReply, type ReplyOutcome } from "@/tickets/reply";
import type { Ticket } from "@/tickets/ticket";

import { openingSubject } from "./opening-subject";
import { widgetKeys } from "./widget-keys";
import type { WidgetTickets } from "./widget-tickets";

/**
 * What became of a Visitor's first message.
 *
 * `opened` is the part worth a field. Starting a conversation is two writes —
 * the Ticket, then the Message onto it — and the second can fail after the
 * first has landed. A Visitor pressing send again at that point must not open a
 * second Ticket for one question, so the half-opened one is held and a retry
 * sends only the message. Saying which of the two failed is what lets the words
 * on screen be true.
 */
export type StartOutcome =
  { started: true; ticket: Ticket } | { started: false; failure: ApiFailure; opened: boolean };

export type WidgetWrites = {
  /**
   * Opens a conversation with what the Visitor said, and says it.
   *
   * This is the write that makes a Contact exist. Before it, the session has
   * none and the API creates none — which is why nothing else on this Surface
   * has to be careful about ordering.
   */
  start(said: string): Promise<StartOutcome>;
  /** Says something on a conversation, and reports which one it landed on. */
  reply(ticket: Ticket, body: string): Promise<ReplyOutcome>;
};

export function useWidgetWrites(api: WidgetTickets): WidgetWrites {
  const cache = useQueryClient();

  // The Ticket opened by a first message whose second write did not land. Held
  // across renders rather than in state, because nothing on screen changes when
  // it is set — the Visitor sees the same box with the same text in it.
  const halfOpened = useRef<Ticket | undefined>(undefined);

  return useMemo(() => {
    const conversationsChanged = () =>
      void cache.invalidateQueries({ queryKey: widgetKeys.tickets, exact: true });
    const conversationChanged = (ticketId: string) =>
      void cache.invalidateQueries({ queryKey: widgetKeys.conversation(ticketId) });

    return {
      async start(said) {
        let ticket = halfOpened.current;

        if (!ticket) {
          const opened = await api.open(openingSubject(said));
          if (!opened.ok) return { started: false, failure: opened.failure, opened: false };
          ticket = opened.value;
          halfOpened.current = ticket;

          // Deliberately *not* invalidated here. The list is what decides
          // whether the Visitor is shown their conversations or the box they
          // are typing in, so saying it has changed between the two writes
          // would replace the box mid-conversation — taking their text, and
          // this ref, with it, in exactly the failure this ref exists for.
        }

        // A Ticket this new cannot be closed, so this cannot land anywhere else
        // — but it is the same write as a reply, and reading the answer is what
        // that write's contract asks for either way.
        const outcome = await sendReply(api, ticket, said);
        if (!outcome.sent) return { started: false, failure: outcome.failure, opened: true };

        halfOpened.current = undefined;
        conversationsChanged();
        conversationChanged(ticket.id);

        return { started: true, ticket: outcome.landedOn ?? ticket };
      },

      async reply(ticket, body) {
        const outcome = await sendReply(api, ticket, body);
        if (!outcome.sent) return outcome;

        // A reply moves the Ticket it lands on, so some Ticket's state and
        // `updatedAt` differ now whether or not it stayed put.
        conversationsChanged();

        // Both conversations, where it moved: the one the Visitor was reading
        // has been left behind at whatever state it is in now, and the one it
        // landed on is where the message actually is.
        conversationChanged(ticket.id);
        if (outcome.landedOn && outcome.landedOn.id !== ticket.id) {
          conversationChanged(outcome.landedOn.id);
        }

        return outcome;
      },
    };
  }, [api, cache]);
}
