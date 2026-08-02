"use client";

/**
 * One Surface's session, put where its components can reach it.
 *
 * Every Surface needs the same three things — a provider holding one session, a
 * hook to reach it, and a hook answering whether it is signed in — and needs
 * them to stay separate from every other Surface's. That is what this makes:
 * one context per call, not one context shared between them. Two Surfaces
 * sharing a context would be the "current identity" this application
 * deliberately does not have.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { SessionClient } from "./session-client";

export type SessionContext<S extends SessionClient> = {
  Provider: (props: { children: React.ReactNode; session?: S }) => React.ReactNode;
  useSession: () => S;
  /**
   * Whether this Surface holds a credential — or `undefined` while that is
   * still being found out.
   *
   * The third state is the whole point. The access token lives in memory and
   * nowhere else, so after a reload the store is empty on every Surface,
   * signed in or not. What tells the two apart is the httpOnly refresh cookie,
   * and only the API can read it. Until it has answered, "signed in" has no
   * value — and answering `false` in the meantime is how a reload used to
   * throw a signed-in reader onto the sign-in form.
   */
  useSignedIn: () => boolean | undefined;
};

export function createSessionContext<S extends SessionClient>({
  surface,
  create,
}: {
  /** Named in the error a component outside the provider gets. */
  surface: string;
  create: () => S;
}): SessionContext<S> {
  const Context = createContext<S | null>(null);

  /** Whether the refresh cookie has been asked about yet. */
  const Settled = createContext(false);

  function useSession(): S {
    const session = useContext(Context);
    if (!session) throw new Error(`A ${surface} component was used outside its session provider.`);
    return session;
  }

  return {
    Provider({ children, session }) {
      // Created once, on first render, so a re-render does not replace the
      // session — and with it the credential every request in flight is using.
      const [held] = useState(() => session ?? create());
      const [settled, setSettled] = useState(false);
      const asked = useRef(false);

      /**
       * The one question a reload has to ask before it can render anything.
       *
       * Exactly once per mount, guarded by a ref rather than by the effect's
       * dependencies. Two reasons, and the second is the sharp one:
       *
       * The API rotates the refresh token on every use and treats a second
       * presentation of an already-rotated one as theft — it revokes the whole
       * token family, which signs the reader out of every tab they have open.
       * So this must not be able to fire twice against one cookie. `renew()` is
       * single-flight underneath, and this ref is the belt to that braces.
       *
       * It also must not re-run when the session *ends*: signing out revokes
       * the cookie deliberately, and asking to renew immediately afterwards
       * would be the interface arguing with the reader.
       */
      useEffect(() => {
        if (asked.current) return;
        asked.current = true;

        // Signed in already — a fresh sign-in, or a test supplying its own
        // store. There is nothing to recover and nothing to ask.
        if (held.current() !== undefined) {
          setSettled(true);
          return;
        }

        void held.renew().finally(() => setSettled(true));
      }, [held]);

      return (
        <Context.Provider value={held}>
          <Settled.Provider value={settled}>{children}</Settled.Provider>
        </Context.Provider>
      );
    },

    useSession,

    /**
     * Nothing is server-rendered behind a credential — the browser holds the
     * token and calls the API directly — so the server snapshot is always
     * signed out, and the first client paint corrects it.
     */
    useSignedIn() {
      const session = useSession();
      const settled = useContext(Settled);

      const holds = useSyncExternalStore(
        (listener) => session.subscribe(listener),
        () => session.current() !== undefined,
        () => false,
      );

      // A credential in hand is an answer whenever it arrives, including
      // before the renewal has come back. Only its *absence* has to wait.
      if (holds) return true;

      return settled ? false : undefined;
    },
  };
}
