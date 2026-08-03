"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { ApiResult } from "@/api/client";
import { sendReply, type ReplyOutcome } from "@/tickets/reply";
import type { Ticket } from "@/tickets/ticket";

import { usePortalChain, type PortalChain } from "./portal-chain";
import { portalKeys } from "./portal-keys";
import { createPortalTickets, type PortalTickets } from "./portal-tickets";
import { usePortalSession } from "./portal-session-context";

export type { ReplyOutcome };

export type PortalWrites = {
  /** Opens a Ticket with a subject alone. Its first Message is a separate write. */
  open(subject: string): Promise<ApiResult<Ticket>>;
  /** Says something on a Ticket, and reports the Ticket it actually landed on. */
  reply(ticket: Ticket, body: string): Promise<ReplyOutcome>;
};

export function usePortalWrites(): PortalWrites {
  const session = usePortalSession();
  const cache = useQueryClient();
  const chain = usePortalChain();

  return useMemo(
    () => createPortalWrites(createPortalTickets(session), cache, chain),
    [session, cache, chain],
  );
}

function createPortalWrites(
  api: PortalTickets,
  cache: QueryClient,
  chain: PortalChain,
): PortalWrites {
  // ADR-0002's rule that an invalidated list is held still and the reader told,
  // rather than refetched underneath them, is about events arriving from
  // elsewhere. This is the reader's own write, and the list is not on screen
  // when it happens — so marking it stale moves nothing under anybody's cursor,
  // and they find it current when they next look at it.
  const listChanged = () =>
    void cache.invalidateQueries({ queryKey: portalKeys.tickets, exact: true });
  const threadChanged = (ticketId: string) =>
    void cache.invalidateQueries({ queryKey: portalKeys.thread(ticketId) });

  return {
    async open(subject) {
      const opened = await api.open(subject);
      if (opened.ok) listChanged();
      return opened;
    },

    async reply(ticket, body) {
      const outcome = await sendReply(api, ticket, body);
      if (!outcome.sent) return outcome;

      // A reply moves the Ticket it lands on — reopening a `pending` or
      // `resolved` one, and opening a new linked Ticket where the addressed one
      // was `closed`. Either way some Ticket's state and `updatedAt` differ now.
      listChanged();

      // Nowhere this client can name, which only ever happens where the reply
      // moved: there is no thread to mark stale and no link worth recording
      // against a Ticket nothing could read.
      if (!outcome.landedOn) return outcome;

      if (outcome.landedOn.id === ticket.id) threadChanged(ticket.id);
      else chain.record(outcome.landedOn.id, ticket);

      return outcome;
    },
  };
}
