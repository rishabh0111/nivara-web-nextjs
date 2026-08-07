/**
 * The Widget's session: a Visitor, anonymous, on somebody else's page.
 *
 * There is no sign-in here and nothing to type. `POST /widget/sessions` mints a
 * thirty-minute credential against one thing — whether the browser-set `Origin`
 * of the page it was called from is on that Tenant's allowlist. That is the
 * whole of the anti-Lifting gate, and it is why this Surface sends a `tenantId`
 * in the body and no origin of its own: the origin is the browser's to state,
 * and a page script that could supply it could lift the Widget.
 *
 * No cookies, either. The Portal and the Dashboard renew from an httpOnly
 * refresh cookie; this session renews by presenting the credential it holds, so
 * there is nothing for a cookie to carry.
 */
import { getApiClient, type ApiClient, type ApiResult } from "@/api/client";
import { describeFailure, type ApiFailure } from "@/api/errors";
import { getApiEndpoints } from "@/config/api";
import { createLiveConnection, type LiveConnection } from "@/realtime/live-connection";
import { createSessionClient, type SessionClient } from "@/session/session-client";
import type { SessionStore } from "@/session/store";

export type WidgetSession = SessionClient & {
  /**
   * Whose Widget this is, read off the Snippet.
   *
   * Held rather than looked up, because a Room's name carries it and this is
   * the one Surface that knows its tenant before it has a principal — the
   * Snippet says so, and the API judges the claim by the origin regardless.
   */
  readonly tenantId: string;
  /** Mints the session. Refused if this page's origin is not the Tenant's. */
  start(): Promise<ApiResult<void>>;
  /** The one live connection this Surface holds. */
  readonly live: LiveConnection;
  /**
   * Takes the session off the page: the connection closed, and this Surface's
   * following of its own credential stopped.
   *
   * The one Surface that needs this. The Portal and the Dashboard are pages,
   * and a page going away takes everything with it; the Widget is a script on
   * somebody else's site, and a Tenant's own application can route away from
   * the page it was put on without the browser doing anything at all.
   */
  stop(): void;
};

export function createWidgetSession(
  tenantId: string,
  client: ApiClient = getApiClient(),
  store?: SessionStore,
  realtimeUrl: string = getApiEndpoints().realtimeUrl,
): WidgetSession {
  const session = createSessionClient({
    surface: "widget",
    client,
    store,
    // Renewal keeps the same session, so the Visitor's Contact and their
    // Tickets survive it. Starting a second session instead would strand the
    // conversation they were in the middle of.
    renew: (renewClient) =>
      renewClient.resource("/widget/sessions/renew", "post", {
        token: session.current()?.accessToken,
      }),
  });

  const live = createLiveConnection({
    url: realtimeUrl,
    // Read at every connect. On this Surface that is read more than once: the
    // connection is rebuilt whenever the credential is replaced, and the point
    // of rebuilding it is to present the one held now.
    token: () => session.current()?.accessToken,
  });

  /**
   * The connection carries the credential the session holds, always.
   *
   * Driven from the credential changing rather than from the renewal that
   * changed it, so both renewals arrive here — the one scheduled ahead of
   * expiry and the one a refused request set off — without either having to
   * remember to say so. A credential that has gone takes the connection with
   * it: a session that ended must stop being read to, and that is the whole
   * reason this Surface rebuilds where the staff ones ride.
   */
  let carrying = session.current()?.accessToken;
  const stopFollowing = session.subscribe(() => {
    const now = session.current()?.accessToken;
    if (now === carrying) return;

    carrying = now;
    if (now === undefined) live.close();
    else live.rebuild();
  });

  return {
    ...session,
    tenantId,
    live,

    stop() {
      stopFollowing();
      live.close();
    },

    async start() {
      // Not through the session client: there is no credential to renew yet,
      // and a refusal here is the gate answering rather than one expiring.
      const result = await client.resource("/widget/sessions", "post", { body: { tenantId } });

      if (!result.ok) return result;

      session.adopt(result.value);
      return { ok: true, value: undefined };
    },
  };
}

export type WidgetFailure = {
  /**
   * The origin allowlist saying no — the anti-Lifting gate doing its one job.
   * Nothing about this page load will change the answer, which is the whole
   * difference from every other way a mint can fail.
   */
  gate: boolean;
  words: string;
};

/**
 * Why the Widget did not start, and whether asking again could ever help.
 *
 * The distinction is the point. A gate refusal is settled: this page is not on
 * this Tenant's allowlist and pressing the Launcher again will be refused the
 * same way. Everything else — a sleeping server, a burst of traffic — is
 * weather, and a Widget that treated it as settled would take support off a
 * Tenant's page for the rest of the session over one dropped request.
 */
export function readWidgetFailure(failure: ApiFailure): WidgetFailure {
  // An unlisted origin, an unknown Tenant, and a Tenant with no origins
  // configured are refused identically on purpose: the refusal must not be
  // usable to learn whether a given Tenant is real. One reading here, or this
  // Surface hands back the distinction the API withheld.
  //
  // And read as being about the *page*, not about the person. The shared
  // catalog says "your role does not allow this", which is nonsense on a
  // Surface with no roles, no account and nothing to sign into.
  if (failure.kind === "api" && (failure.code === "forbidden" || failure.code === "not_found")) {
    return { gate: true, words: "Support is not available on this site." };
  }

  // Everything else takes the shared reading. This Surface has nothing of its
  // own to say about a server it could not reach or a burst it was throttled
  // for, and a second wording would be a second thing to keep true.
  return { gate: false, words: describeFailure(failure) };
}
