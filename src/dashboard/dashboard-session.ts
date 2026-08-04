/**
 * The Dashboard's session: a User, signed in with a password.
 *
 * Sign-in is `POST /auth/sign-in`; renewal is `POST /auth/refresh` with the
 * httpOnly refresh cookie the API set on `/auth`, which is why it sends cookies
 * and no token. Path-scoped separately from the Portal's, so a Contact and a
 * User can be signed in in the same browser without either ending the other.
 *
 * The tenant appears once, in `signIn`, and is never held: it routes the
 * credential lookup and nothing more. Every call afterwards is answered in the
 * tenant context the token arms, so there is nothing here to switch, to send, or
 * to put in a URL.
 */
import { getApiClient, type ApiClient, type ApiResult } from "@/api/client";
import { getApiEndpoints } from "@/config/api";
import { createLiveConnection, type LiveConnection } from "@/realtime/live-connection";
import type { PasswordCredentials } from "@/session/credentials";
import { createSessionClient, type SessionClient } from "@/session/session-client";
import type { SessionStore } from "@/session/store";

export type DashboardSession = SessionClient & {
  signIn(credentials: PasswordCredentials): Promise<ApiResult<void>>;
  signOut(): Promise<void>;
  /** The one live connection this Surface holds. */
  readonly live: LiveConnection;
};

export function createDashboardSession(
  client: ApiClient = getApiClient(),
  store?: SessionStore,
  realtimeUrl: string = getApiEndpoints().realtimeUrl,
): DashboardSession {
  const session = createSessionClient({
    surface: "dashboard",
    client,
    store,
    renewsFromCookie: true,
    renew: (renewClient) => renewClient.resource("/auth/refresh", "post", { withCookies: true }),
  });

  // The credential is read when the connection is opened and never again. A
  // renewal changes what every request afterwards sends and changes nothing
  // here: the wire contract fixes the principal at connect.
  const live = createLiveConnection({
    url: realtimeUrl,
    token: () => session.current()?.accessToken,
  });

  return {
    ...session,
    live,

    async signIn(credentials) {
      // Not through the session client: there is nothing to renew yet, and a
      // refused sign-in is an answer rather than an expired credential.
      const result = await client.resource("/auth/sign-in", "post", {
        body: credentials,
        withCookies: true,
      });

      if (!result.ok) return result;

      // The credential is adopted; the tenant that found it is not. It goes out
      // of scope here, and this is the only place it was ever in scope.
      session.adopt(result.value);
      return { ok: true, value: undefined };
    },

    async signOut() {
      // The connection authenticates once, at connect, and then outlives the
      // token by design — so a sign-out that only forgot the credential would
      // leave a signed-out browser still being read to. It goes first, before
      // the request that may fail and before the credential is dropped.
      live.close();

      // Told to the API so the refresh cookie is revoked, and forgotten locally
      // either way — a sign-out that fails on the wire must still sign you out.
      await client.resource("/auth/sign-out", "post", { withCookies: true });
      session.end();
    },
  };
}
