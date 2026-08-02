/**
 * The Portal's session: a Contact, signed in with a password.
 *
 * Sign-in is `POST /portal/auth/sign-in`; renewal is `POST /portal/auth/refresh`
 * with the httpOnly refresh cookie the API set on `/portal/auth`, which is why
 * it sends cookies and no token.
 */
import { getApiClient, type ApiClient, type ApiResult } from "@/api/client";
import type { PasswordCredentials } from "@/session/credentials";
import { createSessionClient, type SessionClient } from "@/session/session-client";
import type { SessionStore } from "@/session/store";

export type PortalSession = SessionClient & {
  signIn(credentials: PasswordCredentials): Promise<ApiResult<void>>;
  signOut(): Promise<void>;
};

export function createPortalSession(
  client: ApiClient = getApiClient(),
  store?: SessionStore,
): PortalSession {
  const session = createSessionClient({
    surface: "portal",
    client,
    store,
    renewsFromCookie: true,
    renew: (renewClient) =>
      renewClient.resource("/portal/auth/refresh", "post", { withCookies: true }),
  });

  return {
    ...session,

    async signIn(credentials) {
      // Not through the session client: there is nothing to renew yet, and a
      // refused sign-in is an answer rather than an expired credential.
      const result = await client.resource("/portal/auth/sign-in", "post", {
        body: credentials,
        withCookies: true,
      });

      if (!result.ok) return result;

      session.adopt(result.value);
      return { ok: true, value: undefined };
    },

    async signOut() {
      // Told to the API so the refresh cookie is revoked, and forgotten locally
      // either way — a sign-out that fails on the wire must still sign you out.
      await client.resource("/portal/auth/sign-out", "post", { withCookies: true });
      session.end();
    },
  };
}
