import type { ActorKind } from "@/tickets/message";

/**
 * Who wrote or did something, in the words a User reads.
 *
 * The Portal's map for the same field says "You" for a Contact, because a
 * Contact's context contains only their own work. The Dashboard sees a whole
 * Tenant's, so the same value has to name a role instead — and "Customer" is the
 * word that matters on this Surface, because it is the one that says who must
 * not see an internal Note.
 *
 * `user` is "Staff" rather than "Agent": an admin writes Messages too, and the
 * Message carries no role to tell them apart.
 */
export const STAFF_ACTOR_LABELS: Record<ActorKind, string> = {
  contact: "Customer",
  user: "Staff",
  service: "Automation",
  system: "System",
};
