/**
 * The wire contract's own vocabulary: Rooms, envelopes, and the events that
 * arrive in them.
 *
 * These types are hand-written rather than generated, because the realtime
 * schema is a separate document from the OpenAPI one and there is no machine
 * form of it to generate from. Where a payload is a record the HTTP surface
 * also serves, it is expressed in terms of that record's generated type, so the
 * two cannot drift apart silently.
 */
import type { Message } from "@/tickets/message";
import type { Ticket } from "@/tickets/ticket";

/** A Room name, as the grammar in the wire contract spells one. */
export const rooms = {
  /** Staff only. Where a queue learns that it changed. */
  agents: (tenantId: string) => `t:${tenantId}:agents`,
  /** Staff of the tenant, and the Contact who requested the Ticket. */
  ticket: (tenantId: string, ticketId: string) => `t:${tenantId}:ticket:${ticketId}`,
  /** Staff only. Notes, and nothing else. */
  internal: (tenantId: string, ticketId: string) => `t:${tenantId}:ticket:${ticketId}:internal`,
} as const;

/**
 * A Ticket as the socket carries one.
 *
 * The three Ticket events all carry this same full snapshot — never a diff, so
 * a client that missed the previous state can still apply it. The event name is
 * what says which fact changed.
 *
 * Two fields the HTTP surface does not serve on `TicketDto` are here: a Ticket
 * spawned by a reply to a closed one names its parent and its root.
 */
export type TicketSnapshot = Ticket & {
  spawnedFromTicketId: string | null;
  rootTicketId: string | null;
};

/**
 * A thread entry, the shape Messages and Notes share.
 *
 * Identical payloads are safe because nothing decides which is which from a
 * field: a Note is a Note because it arrived under `note.created`, into the
 * `:internal` Room that a Contact may not join.
 */
export type ThreadEntry = Message;

/** An SLA timer that ran out. Nothing about the Ticket changed. */
export type SlaBreach = {
  ticketId: string;
  timer: "first_response" | "resolution";
  /** The latch value, not the emission time — the two differ by the sweep. */
  breachedAt: string;
};

/** A customer-visible reply an adapter permanently gave up on delivering. */
export type IntegrationFailure = {
  ticketId: string;
  messageId: string;
  /** The adapter that gave up; `slack` today. */
  source: string;
  /** Where it was trying to reach, as that adapter spells one. */
  target: string;
  /** The far end's own words. */
  error: string;
};

/** Every event name the contract defines, and what each one carries. */
export type RealtimeEventData = {
  "ticket.created": TicketSnapshot;
  "ticket.updated": TicketSnapshot;
  "ticket.assigned": TicketSnapshot;
  "message.created": ThreadEntry;
  "note.created": ThreadEntry;
  "ticket.sla.breached": SlaBreach;
  "ticket.integration.failed": IntegrationFailure;
};

export type RealtimeEventName = keyof RealtimeEventData;

/**
 * The event names, as values.
 *
 * Written as a `Record` over the union so that an event added to the contract
 * and not listed here is a compile error rather than one nobody subscribes to.
 */
const EVENT_NAMES: Record<RealtimeEventName, true> = {
  "ticket.created": true,
  "ticket.updated": true,
  "ticket.assigned": true,
  "message.created": true,
  "note.created": true,
  "ticket.sla.breached": true,
  "ticket.integration.failed": true,
};

export const REALTIME_EVENTS = Object.keys(EVENT_NAMES) as RealtimeEventName[];

/**
 * One event, delivered into one Room.
 *
 * `room` is carried inside the envelope even though the transport already
 * routed by it, because `seq` is meaningless without it: the same event
 * delivered into two Rooms carries two unrelated numbers. `ts` is for display
 * and coarse cross-Room ordering — `seq` is the ordering authority.
 */
export type RealtimeEnvelope<E extends RealtimeEventName = RealtimeEventName> = {
  [K in E]: {
    event: K;
    room: string;
    /** Monotonic within `room`, from 1. Monotonic but not contiguous. */
    seq: number;
    /** ISO-8601, server clock. */
    ts: string;
    data: RealtimeEventData[K];
  };
}[E];

/**
 * An envelope the code reading them has no case for.
 *
 * The parameter is `never`, so a case left out — most likely because the
 * contract grew an event and nobody came back here — is a compile error rather
 * than an envelope quietly dropped. The same check the `Record`s over the
 * generated unions make, in the one place a `Record` would read worse than a
 * `switch`.
 */
export function noCaseFor(envelope: never): undefined {
  void envelope;
  return undefined;
}

/** The server's answer to `subscribe`. */
export type SubscribeAck =
  | { ok: true; room: string; replayed: number; gap: boolean }
  | { ok: false; error: "forbidden" | "malformed_request" };
