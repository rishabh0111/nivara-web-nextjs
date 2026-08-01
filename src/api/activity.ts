/**
 * What the request layer is waiting on.
 *
 * A Cold start is not a category of error and there is no header that announces
 * one — it is an ordinary request that has been outstanding for a long time. So
 * the signal is derived here, from requests the client already knows it started,
 * rather than from a handler somebody has to remember to call.
 */

export type ActivityListener = () => void;

export class RequestActivity {
  readonly #outstanding = new Map<number, number>();
  readonly #listeners = new Set<ActivityListener>();
  readonly #now: () => number;
  #nextId = 0;

  // Called rather than captured, so the clock is read at the moment it is
  // wanted rather than bound to whichever `Date` was installed at construction.
  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  /** Records a request as started. The returned function records it as finished. */
  begin(): () => void {
    const id = this.#nextId++;
    this.#outstanding.set(id, this.#now());
    this.#announce();

    return () => {
      if (this.#outstanding.delete(id)) this.#announce();
    };
  }

  /**
   * How long the longest outstanding request has been waiting, or `undefined`
   * when nothing is in flight. The longest, because one slow request among ten
   * fast ones is still someone waiting.
   */
  longestWaitMs(): number | undefined {
    let oldest: number | undefined;
    for (const startedAt of this.#outstanding.values()) {
      if (oldest === undefined || startedAt < oldest) oldest = startedAt;
    }
    return oldest === undefined ? undefined : this.#now() - oldest;
  }

  subscribe(listener: ActivityListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #announce(): void {
    for (const listener of this.#listeners) listener();
  }
}

/** The one this application's client reports to. */
export const requestActivity = new RequestActivity();
