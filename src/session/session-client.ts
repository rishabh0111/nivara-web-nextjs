/**
 * A client that holds one Surface's credential and renews it when the API says
 * it has expired.
 *
 * Renewal is reactive and single-flight. Reactive, because the access token's
 * lifetime is the API's business and a client renewing on a timer is a client
 * guessing at it. Single-flight, because ten views failing at once on the same
 * expired credential is the ordinary case, and ten renewals would be nine
 * requests spent proving something already known.
 */
import type { ApiClient, ApiResult, Page, RequestOptions } from "@/api/client";
import { isApiFailure } from "@/api/errors";
import type { ApiPath, CollectionOf, MethodOn, Operation, SuccessOf } from "@/api/operations";

import {
  sessionStore,
  type MintedCredential,
  type Session,
  type SessionStore,
  type Surface,
} from "./store";

/** The same options as the request layer takes, minus the credential it supplies. */
export type SessionRequestOptions<P extends ApiPath, M extends MethodOn<P>> = Omit<
  RequestOptions<P, M>,
  "token"
>;

export type SessionClientConfig = {
  surface: Surface;
  /** How this Surface renews. The refresh cookie is httpOnly, so this sends no token. */
  renew: (client: ApiClient) => Promise<ApiResult<MintedCredential>>;
  client: ApiClient;
  store?: SessionStore;
  /**
   * Whether a renewal is worth attempting with nothing in the store.
   *
   * This is the difference between the two kinds of Surface here, and getting
   * it wrong is invisible until a reload.
   *
   * The Portal and the Dashboard renew from an httpOnly refresh cookie. The
   * browser holds it, this code cannot read it, and it survives a reload — so
   * an empty store says nothing at all about whether there is a session, and
   * the only way to find out is to ask. For them an empty store is exactly the
   * moment to try.
   *
   * The Widget has no such cookie: it runs on a Tenant's origin, and its
   * session is carried across a page load by what it wrote into the host page
   * itself. With nothing held there is genuinely nothing to present, and a
   * request would spend a round trip to be told so.
   */
  renewsFromCookie?: boolean;
};

export type SessionClient = {
  readonly surface: Surface;

  resource<P extends ApiPath, M extends MethodOn<P>>(
    path: P,
    method: M,
    options: SessionRequestOptions<P, M>,
  ): Promise<ApiResult<SuccessOf<Operation<P, M>>>>;

  page<P extends ApiPath, M extends MethodOn<P>>(
    path: P,
    method: M,
    options: SessionRequestOptions<P, M>,
  ): Promise<ApiResult<Page<CollectionOf<Operation<P, M>>>>>;

  /**
   * Replaces the credential now, rather than waiting to be refused.
   *
   * The same single flight the reactive path uses, so a Surface renewing ahead
   * of expiry and a request expiring underneath it share one renewal rather
   * than racing to mint two. Answers whether there is a credential afterwards:
   * a refused renewal ends the session here exactly as it does there.
   *
   * The Widget is the caller this exists for. Its session has no grace period
   * and a lapsed one cannot be recovered, so waiting for a refusal would mean
   * waiting for the one answer that cannot be acted on.
   */
  renew(): Promise<boolean>;
  /** Records a credential just minted by a sign-in. */
  adopt(credential: MintedCredential): void;
  /**
   * Takes up a credential that was minted earlier, with the expiry it was
   * minted with rather than a fresh one counted from now.
   *
   * Only the Widget has anything to hand here: it is the one Surface that
   * outlives its own page, because a Visitor navigating a Tenant's site
   * reloads everything and there is no httpOnly refresh cookie to carry the
   * session across for them. The Portal and the Dashboard renew from exactly
   * such a cookie, which is the browser's to keep and not this store's.
   */
  resume(session: Session): void;
  /** Forgets the credential. Revoking it server-side is the caller's business. */
  end(): void;
  current(): Session | undefined;
  /** Fires whenever any Surface's session changes; read `current()` for this one. */
  subscribe(listener: () => void): () => void;
};

export function createSessionClient(config: SessionClientConfig): SessionClient {
  const { surface, renew, client } = config;
  const store = config.store ?? sessionStore;

  let renewal: Promise<boolean> | undefined;

  function renewOnce(): Promise<boolean> {
    renewal ??= (async () => {
      try {
        const result = await renew(client);
        if (!result.ok) {
          // A refused renewal is the session ending. There is nothing left to
          // try with, so trying again would be a loop with no exit.
          store.clear(surface);
          return false;
        }
        store.adopt(surface, result.value);
        return true;
      } finally {
        renewal = undefined;
      }
    })();

    return renewal;
  }

  async function withSession<T>(
    run: (token: string | undefined) => Promise<ApiResult<T>>,
  ): Promise<ApiResult<T>> {
    const held = store.get(surface)?.accessToken;
    const first = await run(held);

    if (first.ok || !isApiFailure(first.failure, "unauthenticated")) return first;

    // Someone else's renewal may have landed while this call was in flight. A
    // credential in the store that is not the one we sent is a renewal that has
    // already happened, and asking for another would undo it.
    const afterwards = store.get(surface)?.accessToken;
    const renewed = afterwards !== undefined && afterwards !== held ? true : await renewOnce();

    if (!renewed) return first;

    const replayed = await run(store.get(surface)?.accessToken);

    // Refused a second time on a credential the API has just minted: the session
    // is over. One replay, never two, and never a third request to find out.
    if (!replayed.ok && isApiFailure(replayed.failure, "unauthenticated")) store.clear(surface);

    return replayed;
  }

  return {
    surface,

    resource(path, method, options) {
      return withSession((token) =>
        client.resource(path, method, { ...options, token } as never),
      ) as never;
    },

    page(path, method, options) {
      return withSession((token) =>
        client.page(path, method, { ...options, token } as never),
      ) as never;
    },

    renew() {
      // Nothing held is nothing to present — unless the thing that stands for
      // it is a cookie, which this code cannot see and the browser sends on its
      // own. That is the whole of how a reload keeps a session: the store is
      // empty on every reload, signed in or not, so a Surface backed by a
      // cookie has to ask precisely when it is holding nothing.
      if (!config.renewsFromCookie && !store.get(surface)) return Promise.resolve(false);

      return renewOnce();
    },

    adopt(credential) {
      store.adopt(surface, credential);
    },

    resume(session) {
      store.set(surface, session);
    },

    end() {
      store.clear(surface);
    },

    current() {
      return store.get(surface);
    },

    subscribe(listener) {
      return store.subscribe(listener);
    },
  };
}
