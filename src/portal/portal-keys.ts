/**
 * Where the Portal's server state is held in the cache.
 *
 * Written once and shared, because a key is a name two pieces of code have to
 * agree on: the read that files something under it and the write that says it
 * has changed. Two array literals that must match and are never compared is how
 * an invalidation quietly stops invalidating anything.
 */
export const portalKeys = {
  /** Every Ticket this Contact has raised. */
  tickets: ["portal", "tickets"] as const,
  /** The customer-visible thread on one Ticket. */
  thread: (ticketId: string) => ["portal", "tickets", ticketId, "messages"] as const,
};
