"use client";

/**
 * The Ticket on screen, kept correct as events arrive underneath it.
 *
 * Two Rooms, because a Ticket's history is two collections the API deliberately
 * holds apart: what the customer can see arrives in the Ticket's Room, and what
 * only colleagues can see arrives in the `:internal` one. A Surface that may not
 * enter the second is refused it, which is the same property that makes an
 * internal Note safe on the wire as well as in the database.
 */
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { appendToThread } from "@/realtime/append-to-thread";
import { noCaseFor, rooms, type RealtimeEnvelope } from "@/realtime/envelope";
import { useLiveRoom } from "@/realtime/use-live-room";

import { dashboardKeys } from "./dashboard-keys";
import { useDashboardSession } from "./dashboard-session-context";
import { useAnnouncing } from "./live-notices";
import { useStaffPrincipal } from "./use-staff-principal";

export function useLiveTicket(ticketId: string): void {
  const session = useDashboardSession();
  const principal = useStaffPrincipal();
  const cache = useQueryClient();
  const announce = useAnnouncing();

  const tenantId = principal?.tenantId;

  const apply = (envelope: RealtimeEnvelope) => {
    // Announced as well as applied, never instead of: the two questions an
    // envelope raises — what is now different, and what a User should be told —
    // are not alternatives to choose between.
    announce(envelope);
    applyToTicket(envelope, cache);
  };

  // Each Room discards what that Room feeds, and no more. They are two
  // subscriptions with two independent buffers, so the server having lost its
  // grip on the internal Room says nothing at all about the thread — and
  // throwing away a conversation somebody is reading is not free.
  useLiveRoom(session.live, tenantId ? rooms.ticket(tenantId, ticketId) : undefined, {
    envelope: apply,
    gap: () => {
      discard(cache, dashboardKeys.conversation(ticketId));
      discard(cache, dashboardKeys.thread(ticketId));
      discard(cache, dashboardKeys.audit(ticketId));
    },
  });

  useLiveRoom(session.live, tenantId ? rooms.internal(tenantId, ticketId) : undefined, {
    envelope: apply,
    gap: () => discard(cache, dashboardKeys.notes(ticketId)),
  });
}

/**
 * A read this Surface can no longer stand behind: dropped, and asked again.
 *
 * `reset` rather than `invalidate`, and the difference is the whole point of
 * the Gap. Invalidating would go on showing what is held while the answer is on
 * its way, and what is held is precisely what the server has just said it
 * cannot account for — a thread missing a reply, a log missing a transition.
 * Dropping it puts the ordinary waiting treatment on the screen for the moment
 * it takes to answer, which is the honest thing for a view to say about data it
 * does not have.
 *
 * Not an error branch, and nothing is announced. A Gap is the bounded replay
 * buffer working as designed; a User who has to be told about it is being asked
 * to care about a detail of the transport.
 */
function discard(cache: QueryClient, key: readonly unknown[]): void {
  void cache.resetQueries({ queryKey: key });
}

/**
 * One envelope, applied.
 *
 * Which Room it came from decides nothing here, and that is deliberate: a Note
 * is a Note because it arrived under `note.created`, and the only thing the
 * Room decided is that it was allowed to arrive at all. The two payloads are
 * identical on the wire, so a client reading the Room instead of the event name
 * would be one subscription bug away from rendering an internal note as a
 * customer message.
 */
function applyToTicket(envelope: RealtimeEnvelope, cache: QueryClient): void {
  switch (envelope.event) {
    // Last, because this Surface reads a thread oldest-first and renders it in
    // the order it arrived — so the newest row belongs at the end.
    case "message.created":
      appendToThread(cache, dashboardKeys.thread(envelope.data.ticketId), envelope.data, "last");
      return;

    case "note.created":
      appendToThread(cache, dashboardKeys.notes(envelope.data.ticketId), envelope.data, "last");
      return;

    case "ticket.created":
    case "ticket.updated":
    case "ticket.assigned":
      changed(cache, envelope.data.id);
      return;

    // Nothing about the Ticket differs afterwards, so there is nothing here to
    // apply — the notice is what these two are for. The log is the one
    // exception, and only because the API genuinely writes a row for each of
    // them: a breach and a failed delivery are both recorded actions, and a
    // reader looking straight at the log should not have to reload to find the
    // thing they were just told about.
    case "ticket.sla.breached":
    case "ticket.integration.failed":
      void cache.invalidateQueries({ queryKey: dashboardKeys.audit(envelope.data.ticketId) });
      return;

    default:
      return noCaseFor(envelope);
  }
}

/**
 * A Ticket somebody moved. The server is asked what it now says.
 *
 * The envelope carries a full snapshot and filing that would be one line, which
 * is exactly why the reasoning has to be written down: authority is what the API
 * last answered, never what arrived on the socket. This Ticket is being read
 * through two Rooms at once and there is no ordering between them — `seq` orders
 * a Room and nothing orders two — so a snapshot applied on arrival can put an
 * older state on the screen and leave it there until something else happens.
 * Re-asking cannot, whatever order the envelopes turn up in, and a duplicate or
 * a missed one changes nothing about where it lands.
 *
 * The log is re-asked with it, and for a different reason: there is no audit
 * event on the wire at all. A row is written for every one of these — a
 * transition, an assignment, a priority change — and the only way to have it is
 * to read it. Building one from the snapshot would mean inventing an id, an
 * actor and a change nobody recorded.
 */
function changed(cache: QueryClient, ticketId: string): void {
  void cache.invalidateQueries({ queryKey: dashboardKeys.conversation(ticketId) });
  void cache.invalidateQueries({ queryKey: dashboardKeys.audit(ticketId) });
}
