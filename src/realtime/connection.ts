/**
 * One Surface's live connection.
 *
 * The credential is presented once, in the handshake, and never again — there is
 * no field on any client message that contributes to identity. The server fixes
 * the principal at connect and never re-evaluates it, which is why this
 * connection can outlive the token that opened it.
 *
 * Rooms are joined and left by reference count: two views reading the same Room
 * share one subscription, and the last to leave is the one that unsubscribes. A
 * Room's cursor is the highest sequence number seen in it, held per Room and
 * never globally, and sent as `afterSeq` on every re-subscribe so that the
 * server replays only what was missed.
 *
 * Recovery is therefore not a mode this has: a dropped connection comes back,
 * every Room it was reading is re-subscribed from its own resume point, and the
 * only thing anybody above is told is what they missed. The two exceptions are
 * the two things a reader could not work out for themselves — the server saying
 * it can no longer replay from here, and the connection failing to come back at
 * all.
 */
import { io, type Socket } from "socket.io-client";

import { REALTIME_EVENTS, type RealtimeEnvelope, type SubscribeAck } from "./envelope";

/**
 * Whether what is on screen is still being kept current.
 *
 * `silent` is not "disconnected": a connection drops constantly and comes
 * straight back, and saying so every time would train a User to ignore it. It
 * is claimed only once coming back has been tried and has failed, which is the
 * point at which a screen has genuinely stopped updating.
 */
export type LiveHealth = "live" | "silent";

/**
 * How many attempts to come back may fail before the User is told.
 *
 * One. The first attempt is a second after the drop and succeeds for every
 * ordinary blip; a second attempt being scheduled means the first was refused,
 * and by then nobody should still be trusting the screen.
 */
const FAILURES_BEFORE_SILENCE = 1;

/**
 * What one Room's reader is owed: what arrived, and when to start again.
 *
 * Both, rather than envelopes alone. A reader that could only be told about
 * envelopes would have no way of hearing the one thing it cannot compute — that
 * the server can no longer replay from where this Room got to — and would go on
 * showing state that is subtly wrong, which is worse than showing nothing.
 */
export type RoomReader = {
  /** One envelope, in this Room's order, never twice. */
  envelope(envelope: RealtimeEnvelope): void;
  /**
   * The Gap: what is held for this Room is no longer trustworthy, and is to be
   * discarded and read again from the API. An ordinary path, not an error.
   */
  gap(): void;
};

export type RealtimeConnection = {
  /** Reads a Room for as long as the returned function has not been called. */
  join(room: string, reader: RoomReader): () => void;
  /** Whether this connection is still keeping what it reads current. */
  health(): LiveHealth;
  /** Calls back whenever `health` changes, until the returned function is. */
  watch(changed: () => void): () => void;
  /** Ends the connection. A closed connection is not reopened. */
  close(): void;
};

/**
 * What is held for one Room: who is reading it, and how far it has been read.
 *
 * The cursor outlives the readers on purpose. A view that leaves a Room and
 * comes back has missed only what was published in between, and saying so on
 * re-subscribe is what makes the server replay that and nothing else.
 */
type Held = { readers: Set<RoomReader>; cursor: number };

export function connectRealtime({ url, token }: { url: string; token: string }): RealtimeConnection {
  const socket: Socket = io(url, { auth: { token } });
  const held = new Map<string, Held>();
  const watching = new Set<() => void>();
  let health: LiveHealth = "live";

  function report(now: LiveHealth): void {
    if (now === health) return;

    health = now;
    for (const changed of [...watching]) changed();
  }

  function subscribe(room: string): void {
    const entry = held.get(room);

    socket.emit(
      "subscribe",
      { room, afterSeq: entry?.cursor ?? 0 },
      // The ack is the whole of recovery's other half. `gap` is the server
      // saying its replay buffer no longer reaches back to the number this Room
      // resumed from, so nothing is coming to fill the hole and the readers of
      // this Room hold state that may be quietly wrong.
      //
      // The cursor is left where it is. A Gap is a bounded buffer having moved
      // on, not the Room starting again — `seq` keeps climbing from where it
      // was, and resetting it here would make the next envelope look like a
      // redelivery of something already seen.
      (ack: SubscribeAck) => {
        if (!ack.ok || !ack.gap) return;

        // Read again rather than closed over: the Room may have been left in
        // the time the ack took to come back, and there is nobody to tell.
        for (const reader of [...(held.get(room)?.readers ?? [])]) reader.gap();
      },
    );
  }

  // A handshake the server refuses is refused before a connection exists, and
  // Socket.IO does not retry one it was denied — which is the behaviour the
  // contract asks for, since every refusal is the same answer and the token is
  // the only thing that could change. Re-authenticating is the session's
  // business, and a Surface that has lost its credential has a sign-in to show.
  //
  // There is nothing to retry, then, but there is something to say. `active` is
  // the transport's own answer to "will I try again": false is a connection
  // that has stopped for good, which is the one thing this is here to report,
  // and it is reported at once rather than after attempts that will not happen.
  socket.on("connect_error", () => {
    if (!socket.active) report("silent");
  });

  // Sent on connect rather than at join time alone, so that a reconnect
  // re-subscribes every Room this connection is reading, each from its own
  // resume point. Socket.IO reconnects on its own; the rooms come back with it.
  socket.on("connect", () => {
    for (const [room, entry] of held) if (entry.readers.size > 0) subscribe(room);

    // Whether or not anybody was ever told it had stopped. Coming back is the
    // end of the condition, and a screen left saying it is out of date while it
    // is being updated is the same lie the other way round.
    report("live");
  });

  // Watched on the manager rather than on the socket, because the question is
  // not whether this connection is down — it drops constantly — but whether it
  // is failing to come back. A second attempt being scheduled says the first
  // was refused, and from there the browser will go on trying on its own.
  socket.io.on("reconnect_attempt", (attempt: number) => {
    if (attempt > FAILURES_BEFORE_SILENCE) report("silent");
  });

  for (const event of REALTIME_EVENTS) {
    socket.on(event, (envelope: RealtimeEnvelope) => deliver(envelope));
  }

  function deliver(envelope: RealtimeEnvelope): void {
    const entry = held.get(envelope.room);
    if (!entry) return;

    // Deduped on the pair of Room and sequence number, which is what the cursor
    // already is. Delivery is at-least-once, so the same envelope legitimately
    // arrives twice — most often around a reconnect, where the window between
    // joining a Room and replaying it can carry one both ways. `seq` is
    // monotonic within a Room, so anything at or below the cursor is a
    // redelivery of something the readers of this Room have already been told.
    //
    // What this cannot catch is the same *event* in two Rooms: those are two
    // envelopes carrying two unrelated numbers, and telling them apart is a
    // question about the event rather than about the transport.
    if (envelope.seq <= entry.cursor) return;

    // Per Room and never global: the same event delivered into two Rooms
    // carries two unrelated numbers, and `seq` is what orders a Room, not `ts`.
    entry.cursor = envelope.seq;
    for (const reader of [...entry.readers]) reader.envelope(envelope);
  }

  return {
    join(room, reader) {
      const existing = held.get(room);
      const entry: Held = existing ?? { readers: new Set(), cursor: 0 };
      const first = entry.readers.size === 0;

      entry.readers.add(reader);
      held.set(room, entry);
      if (first && socket.connected) subscribe(room);

      return () => {
        if (!entry.readers.delete(reader)) return;
        if (entry.readers.size > 0) return;

        socket.emit("unsubscribe", { room });
      };
    },

    health: () => health,

    watch(changed) {
      watching.add(changed);
      return () => watching.delete(changed);
    },

    close() {
      // The cursors go with it, and that is right: what opens next is a new
      // connection, with a credential read afresh and a principal the server
      // decides again. Resuming somebody else's reading would be the bug.
      held.clear();
      socket.close();
    },
  };
}
