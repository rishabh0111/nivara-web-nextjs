/**
 * The token store, keyed by Surface.
 *
 * There is no single "current identity". A Portal session and a Dashboard
 * session can both be live in one browser — their refresh cookies are separately
 * path-scoped on the API, to `/portal/auth` and `/auth` — so one signing out or
 * expiring must leave the other alone.
 *
 * In memory only. `SessionDto` says as much and says why: persisting an access
 * token to `localStorage` puts it back within reach of a page script, and
 * survives the tab on a shared machine. The refresh cookie is httpOnly and is
 * what carries a session across a reload; that is the browser's job, not ours.
 */

export type Surface = "portal" | "dashboard" | "widget";

export type Session = {
  accessToken: string;
  /** Epoch milliseconds. The Widget renews against this; the others react to a 401. */
  expiresAt: number;
};

/** What the API hands back when it mints or renews a credential. */
export type MintedCredential = { accessToken?: string; token?: string; expiresInSeconds: number };

export class SessionStore {
  readonly #sessions = new Map<Surface, Session>();
  readonly #listeners = new Set<() => void>();

  get(surface: Surface): Session | undefined {
    return this.#sessions.get(surface);
  }

  /** Records a credential the API just minted. */
  adopt(surface: Surface, credential: MintedCredential): void {
    this.set(surface, sessionFrom(credential));
  }

  set(surface: Surface, session: Session): void {
    this.#sessions.set(surface, session);
    this.#announce();
  }

  clear(surface: Surface): void {
    if (this.#sessions.delete(surface)) this.#announce();
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #announce(): void {
    for (const listener of this.#listeners) listener();
  }
}

export const sessionStore = new SessionStore();

/** `expiresInSeconds` off the wire, as an instant this store can compare. */
export function sessionFrom(credential: MintedCredential, now: number = Date.now()): Session {
  const accessToken = credential.accessToken ?? credential.token;
  if (!accessToken) throw new Error("A session was minted with no credential on it.");

  return { accessToken, expiresAt: now + credential.expiresInSeconds * 1000 };
}
