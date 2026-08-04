"use client";

/**
 * The colleagues this screen has actually seen, for a field that would otherwise
 * ask a User to remember a UUID.
 *
 * **There is no directory to look one up in.** The API serves `/auth/me` and
 * `/staff/invitations` and nothing that lists a tenant's Users, so there is no
 * request this application can make to turn "Ada" into an id, and none of the
 * usual answers — a search endpoint, a paged people list — exists to call. That
 * is the constraint this file works inside rather than around.
 *
 * What *is* available is every id already on screen. Tickets carry an
 * `assigneeId`, the queue holds pages of them in the cache, and the signed-in
 * User knows their own. Between them that is the handful of people a desk
 * actually passes work between — reassignment is overwhelmingly to a colleague
 * whose tickets you were just looking at.
 *
 * So the suggestions are honest about their own provenance: these are ids seen
 * on loaded tickets, not a roster. Somebody who has never been assigned anything
 * in the pages you hold will not appear, and the field stays free text so that
 * typing their id outright still works. It is a shortcut, never a gate.
 *
 * The real fix is a `GET /users` on the API. Until then this is the most a
 * client can offer without inventing people.
 */
import { useQueryClient } from "@tanstack/react-query";

import type { Ticket } from "@/tickets/ticket";

import { dashboardKeys } from "./dashboard-keys";
import { useStaffPrincipal } from "./use-staff-principal";

/** One suggestion: the id that goes on the wire, and how it reads. */
export type KnownAssignee = { userId: string; label: string };

type Pages = { pages: { items: Ticket[] }[] } | undefined;

export function useKnownAssignees(): KnownAssignee[] {
  const cache = useQueryClient();
  const principal = useStaffPrincipal();

  // Read straight out of the cache rather than subscribed to. This feeds a
  // datalist, which the browser reads when the field is focused — it does not
  // need to re-render as pages arrive, and making it a subscription would
  // re-render the whole actions panel every time the queue grew.
  const held = cache.getQueriesData<Pages>({ queryKey: dashboardKeys.queue });

  const seen = new Map<string, KnownAssignee>();

  // Whoever is signed in comes first and is named as such, because "assign to
  // me" is the single commonest thing anybody does here and the id under it is
  // the one a User is least likely to have memorised.
  if (principal) {
    seen.set(principal.userId, { userId: principal.userId, label: `${principal.name} (you)` });
  }

  for (const [, data] of held) {
    for (const page of data?.pages ?? []) {
      for (const ticket of page.items) {
        const userId = ticket.assigneeId;
        // `null` is the unclaimed pool, which is a question the radio buttons
        // above this field already ask properly. It is not a person.
        if (!userId || seen.has(userId)) continue;

        seen.set(userId, { userId, label: userId });
      }
    }
  }

  return [...seen.values()];
}
