/**
 * The seeded demo accounts, one per password Surface.
 *
 * These are the values the API's `npm run db:seed` prints on every run and the
 * README publishes: Meridian's admin for the Dashboard and Analytics, and Jules,
 * a Meridian Contact, for the Portal. They are public by construction, so
 * holding them here gives away nothing the repository has not already said. What
 * it saves is the reader who came to look at the product a trip to the README
 * and three values to copy back.
 *
 * The tenant in here goes the same way a typed one does: straight into the
 * sign-in lookup and nowhere else. It is never shown and never put in a URL.
 */
import type { PasswordCredentials } from "./credentials";

/** Meridian, the showcase tenant every seeded demo lives in. */
const MERIDIAN = "5eed0000-0000-4000-8000-000000000001";

/** Shared by every seeded principal; see `prisma/seed/write.ts` in the API. */
const SEED_PASSWORD = "nivara-demo-password";

export type DemoAccount = {
  /** Who the button signs in as, in the reader's words. */
  who: string;
  credentials: PasswordCredentials;
};

export const DEMO_STAFF: DemoAccount = {
  who: "the demo admin",
  credentials: { tenantId: MERIDIAN, email: "admin@meridian.test", password: SEED_PASSWORD },
};

export const DEMO_CONTACT: DemoAccount = {
  who: "a demo customer",
  credentials: { tenantId: MERIDIAN, email: "jules@example.test", password: SEED_PASSWORD },
};

/**
 * Whether this page was opened asking to be signed in as the demo account.
 *
 * `?demo` is what the product page and the portfolio link to, so a reader who
 * clicked "live demo" lands in the queue rather than on a form. It names no
 * tenant and no account; it only asks for the one the page already offers.
 */
export function demoRequested(search: string): boolean {
  return new URLSearchParams(search).has("demo");
}
