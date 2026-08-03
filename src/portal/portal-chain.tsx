"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { Ticket } from "@/tickets/ticket";

/**
 * The chain of Tickets one conversation has run through, as far as the Portal
 * can know it.
 *
 * A `closed` Ticket is terminal, so a reply on one opens a new linked Ticket
 * rather than reviving it. The two are one conversation, and the Contact should
 * read them as one.
 *
 * The Portal is not told about that link by any read it can make. `TicketDto`
 * carries no pointer to what it continues, and the endpoint that returns a whole
 * chain — `GET /tickets/:id/conversation` — is a staff route with no Portal
 * equivalent. So the only chain this Surface can know is the one it *watched*
 * happen: a reply that answered with a `ticketId` other than the one addressed.
 *
 * That means the link lives for as long as this Portal session does and no
 * longer. A reload leaves the two Tickets reading as fragments again. Closing
 * that gap needs a field or a route on the API, which is the API repository's
 * business rather than something to approximate here by matching subjects and
 * hoping.
 */
type Continuations = Record<string, Ticket>;

export type PortalChain = {
  /** The Ticket this one continues, if the Portal saw the continuation happen. */
  earlier(ticketId: string): Ticket | undefined;
  /** Records that `ticketId` is where a reply to `earlier` actually landed. */
  record(ticketId: string, earlier: Ticket): void;
};

const PortalChainContext = createContext<PortalChain | undefined>(undefined);

export function PortalChainProvider({ children }: { children: React.ReactNode }) {
  const [continuations, setContinuations] = useState<Continuations>({});

  const chain = useMemo<PortalChain>(
    () => ({
      earlier: (ticketId) => continuations[ticketId],
      record: (ticketId, earlier) => setContinuations((held) => ({ ...held, [ticketId]: earlier })),
    }),
    [continuations],
  );

  return <PortalChainContext.Provider value={chain}>{children}</PortalChainContext.Provider>;
}

export function usePortalChain(): PortalChain {
  const chain = useContext(PortalChainContext);
  if (!chain) throw new Error("usePortalChain is only available inside the Portal.");
  return chain;
}
