/**
 * Where the Widget's server state is held in the cache.
 *
 * Written once and shared for the reason `portal-keys.ts` gives: a key is a
 * name a read and an invalidation have to agree on, and two array literals that
 * must match and are never compared is how one quietly stops matching.
 *
 * Separate from the Portal's keys, not shared with them. The two Surfaces read
 * the same Ticket shape over different routes as different principals, and one
 * browser can hold both — a Contact signed into the Portal on a Tenant's own
 * help centre, with that Tenant's Widget on the page.
 */
export const widgetKeys = {
  /** Every Ticket this session's Visitor has raised. */
  tickets: ["widget", "tickets"] as const,
  /**
   * One conversation — the Ticket itself, and a prefix of everything on it, so
   * a reply that changed both is one invalidation rather than two that have to
   * be kept in step.
   */
  conversation: (ticketId: string) => ["widget", "tickets", ticketId] as const,
  /** The messages on one of them. */
  thread: (ticketId: string) => ["widget", "tickets", ticketId, "messages"] as const,
};
