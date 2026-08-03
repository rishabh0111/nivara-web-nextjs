import type { ActorKind } from "./message";

/**
 * Who wrote a Message, in the words a customer reads.
 *
 * Shared by the two customer-side Surfaces — a Contact on the Portal and a
 * Visitor on the Widget — because they are the same reader looking at the same
 * thread through two doors. `contact` is "You" for both: each of them is in a
 * context containing only their own Tickets, so every Contact-authored Message
 * they can see is one of theirs.
 *
 * The Dashboard sees a whole Tenant's work and needs different words for the
 * same field, which is why this is the customer's reading rather than the only
 * one.
 */
export const CUSTOMER_AUTHOR_LABELS: Record<ActorKind, string> = {
  contact: "You",
  user: "Support",
  service: "Automation",
  system: "System",
};
