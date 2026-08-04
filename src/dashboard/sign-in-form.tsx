"use client";

import { PasswordSignInForm } from "@/session/password-sign-in-form";

import { useDashboardSession } from "./dashboard-session-context";

/**
 * One message for every refusal.
 *
 * A wrong password, an address that does not exist, and an address belonging to
 * a different tenant must be indistinguishable — otherwise this form answers
 * "does this person work here" for anyone who asks. The API already answers all
 * three with the same `unauthenticated`; this is the half of that promise the
 * interface keeps.
 */
const REFUSED = "Those details did not match an account in that workspace.";

export function SignInForm() {
  const session = useDashboardSession();

  return (
    <PasswordSignInForm
      workspaceHint="Which workspace to sign in to. It is not needed again afterwards."
      refused={REFUSED}
      standing="Work tickets, reply to customers, and keep things moving."
      signIn={session.signIn}
    />
  );
}
