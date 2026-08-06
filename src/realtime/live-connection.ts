/**
 * The one connection a Surface holds, and the three moments it has.
 *
 * It is established on the first Room anybody reads, with whatever credential
 * the Surface holds then, and — for the staff Surfaces — it rides: a renewal
 * replaces the token every request afterwards uses, and changes nothing here.
 * That is not laziness — the wire contract fixes the principal at connect and
 * never re-evaluates it, and a socket only ever reads, so a staff role change
 * takes effect on the next connection rather than the next frame. Rebuilding it
 * four times an hour would be a recurring self-inflicted disruption for a
 * difference nobody could see.
 *
 * The Widget is the exception, and `rebuild` is what it asks for. The same
 * reasoning does not reach a Visitor: their session is revocable and renewed
 * often, and a revoked one should stop receiving rather than keep being read to
 * until the tab closes. Because the principal is fixed at connect, the only way
 * to re-present a credential is to connect again — so that is what this does,
 * carrying the Rooms across so nothing above has to know it happened.
 *
 * Because it outlives the token, closing it is somebody's explicit job. That
 * somebody is sign-out: without it, a signed-out browser keeps being read to.
 */
import {
  connectRealtime,
  type LiveHealth,
  type RealtimeConnection,
  type RoomReader,
} from "./connection";

export type LiveConnection = {
  /**
   * Reads a Room, connecting first if this Surface is not connected yet.
   *
   * A Surface holding no credential reads nothing: there is nothing to present
   * in a handshake, and a connection is not something to queue up until there
   * is. In practice no view of a Surface is mounted before its sign-in.
   */
  join(room: string, reader: RoomReader): () => void;
  /**
   * Whether this Surface is still being kept current.
   *
   * A Surface with no connection open is `live` rather than `silent`, and that
   * is the true answer: nothing has failed. Silence is a claim about a
   * connection that tried to come back and could not, and there is nothing to
   * say about one nobody has needed yet.
   */
  health(): LiveHealth;
  /** Calls back whenever `health` changes, until the returned function is. */
  watch(changed: () => void): () => void;
  /**
   * Connects again with the credential read afresh, keeping every Room that
   * still has a reader.
   *
   * Nothing above is disturbed: the functions `join` handed out stay good, the
   * views stay mounted, and the Rooms come back — from nothing, because this is
   * a new connection and its cursors are its own. What the server replays into
   * them is what it still holds, which the readers above have already been told
   * about and already drop as a redelivery.
   *
   * Does nothing where no connection is open. There is no Room being read, so
   * there is nothing a fresh credential would carry.
   */
  rebuild(): void;
  /** Ends the connection, if there is one. Reading a Room opens a new one. */
  close(): void;
};

/**
 * One view's reading of one Room, held here rather than only in the connection
 * underneath, because that connection is the thing being replaced.
 *
 * `leave` is the underlying subscription, and it is nothing between a rebuild's
 * two halves: the connection it belonged to has gone and the next one has not
 * joined yet.
 */
type RoomHold = { room: string; reader: RoomReader; leave?: () => void };

export function createLiveConnection({
  url,
  token,
}: {
  url: string;
  /** Read at every connect, so a rebuild presents what the Surface holds now. */
  token: () => string | undefined;
}): LiveConnection {
  let held: RealtimeConnection | undefined;
  /** Undone when the connection this was watching is closed. */
  let unwatch: (() => void) | undefined;
  const watching = new Set<() => void>();
  const holds = new Set<RoomHold>();

  function tell(): void {
    for (const changed of [...watching]) changed();
  }

  function open(): RealtimeConnection | undefined {
    const credential = token();
    if (!credential) return undefined;

    held = connectRealtime({ url, token: credential });
    // Watched from here rather than by each caller, so that a view asking
    // about this Surface's health does not have to know whether a
    // connection had been opened by the time it asked.
    unwatch = held.watch(tell);
    return held;
  }

  function shut(): void {
    unwatch?.();
    unwatch = undefined;
    held?.close();
    held = undefined;

    // The subscriptions went with it. Saying so is what stops a later leave
    // calling into a connection that no longer exists.
    for (const hold of holds) hold.leave = undefined;
  }

  return {
    join(room, reader) {
      const hold: RoomHold = { room, reader };

      if (!held) {
        const opened = open();
        if (!opened) return () => {};
        tell();
      }

      holds.add(hold);
      hold.leave = held?.join(room, reader);

      return () => {
        if (!holds.delete(hold)) return;

        hold.leave?.();
        hold.leave = undefined;
      };
    },

    health: () => held?.health() ?? "live",

    watch(changed) {
      watching.add(changed);
      return () => watching.delete(changed);
    },

    rebuild() {
      if (!held) return;

      shut();
      const opened = open();

      if (opened) {
        for (const hold of holds) {
          hold.leave = opened.join(hold.room, hold.reader);
        }
      }

      tell();
    },

    close() {
      shut();
      holds.clear();

      // Signing out is not a connection that has gone quiet: what a closed
      // Surface holds is nothing, and a banner left standing over a sign-in
      // form would be reporting a failure nobody had.
      tell();
    },
  };
}
