"use client";

import { PasswordSignInForm } from "@/session/password-sign-in-form";

import { usePortalSession } from "./portal-session-context";

/**
 * One message for every refusal.
 *
 * A wrong password, an address that does not exist, and a Contact created from a
 * Widget visit — who has no password and cannot sign in here at all — must be
 * indistinguishable. The API already answers all three with the same
 * `unauthenticated`; this is the half of that promise the interface keeps.
 */
const REFUSED = "Those details did not match a Portal account.";

export function SignInForm() {
  const session = usePortalSession();

  return (
    <PasswordSignInForm
      workspaceHint="Which workspace's portal to sign in to."
      refused={REFUSED}
      standing="Raise a ticket and read the replies."
      signIn={session.signIn}
    />
  );
}
