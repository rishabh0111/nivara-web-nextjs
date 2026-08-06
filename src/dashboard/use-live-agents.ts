"use client";

/**
 * The Room a signed-in User reads for as long as they are signed in.
 *
 * `:agents` is staff-wide: everything that happens to this tenant's Tickets is
 * announced into it, whether or not anybody has that Ticket open. That is what
 * makes it the right place to hear about a reply that was never delivered — the
 * User who most needs to be told is the one who is not looking at it.
 *
 * An event that *changed* something is noted rather than applied. This Room
 * carries every Ticket in the tenant and the reader is looking at one filtered,
 * sorted window over them, so what an envelope licenses here is not a patch — it
 * is the statement that the window may no longer be the server's answer.
 */
import { rooms, type RealtimeEnvelope } from "@/realtime/envelope";
import { useLiveRoom } from "@/realtime/use-live-room";

import { useDashboardSession } from "./dashboard-session-context";
import { useAnnouncing } from "./live-notices";
import { useDiscardingTheQueue, useNotingQueueChanges } from "./queue-freshness";
import { useStaffPrincipal } from "./use-staff-principal";

export function useLiveAgents(): void {
  const session = useDashboardSession();
  const principal = useStaffPrincipal();

  // The same event reaches this Room and the Ticket's own, under two unrelated
  // sequence numbers. Announcing it from both is correct and is announced once,
  // because a notice is keyed by what happened rather than by the delivery that
  // carried it.
  const announce = useAnnouncing();
  const note = useNotingQueueChanges();
  const discard = useDiscardingTheQueue();
  const tenantId = principal?.tenantId;

  // Both, never one or the other: what is now different and what a User should
  // be told are two questions, and an envelope can raise either, both or
  // neither. Noting a change twice is noting a change.
  const heard = (envelope: RealtimeEnvelope) => {
    announce(envelope);
    note(envelope);
  };

  // The notices are left standing through a Gap, and only the queue is dropped.
  // What a notice reports is something that happened, which stays true however
  // far behind this Room has fallen — a breach nobody can replay is still a
  // breach somebody was told about.
  useLiveRoom(session.live, tenantId ? rooms.agents(tenantId) : undefined, {
    envelope: heard,
    gap: discard,
  });
}
