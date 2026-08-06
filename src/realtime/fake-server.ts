/**
 * A server that speaks the real wire contract, so that live behaviour can be
 * *caused* rather than asserted about.
 *
 * This is a real Socket.IO server on a real port, which is what makes it the
 * wire rather than a seam inside the realtime layer: everything above it — the
 * client, the cursors, the reference counting, the components — runs for real,
 * and a test that passes here cannot be passing against a client shape the
 * server stopped serving.
 *
 * What it implements is §1 to §6 of the contract: the handshake and its one
 * refusal, the Room grammar and its
 * gate, the envelope, `subscribe` with a resume point, replay before the ack,
 * and the Gap flag. What it deliberately does not implement is anything the
 * contract does not promise — there is no way to deliver an envelope out of
 * order, or to number one globally, because the API cannot do either.
 *
 * Test-only. Nothing under `src` outside a test imports this.
 */
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

import { Server, type Socket } from "socket.io";

import type {
  RealtimeEnvelope,
  RealtimeEventData,
  RealtimeEventName,
  SubscribeAck,
} from "./envelope";

/** The namespace, from the contract. The client derives it from the API URL. */
const NAMESPACE = "/rt";

/** Envelopes kept per Room. Small here, so a Gap is a few lines to cause. */
const DEFAULT_BUFFER_SIZE = 20;

/** The tenant every fixture in this repository belongs to. */
const DEFAULT_TENANT_ID = "ten_1";

/**
 * Who a token resolves to.
 *
 * The principal is fixed at connect and never re-evaluated, exactly as the
 * contract says — which is the property that makes "the connection is not
 * rebuilt on renewal" a safe thing for the client to do.
 */
export type FakePrincipal =
  | { kind: "staff"; tenantId: string }
  | { kind: "customer"; tenantId: string; ticketIds: string[] };

export type FakeServerOptions = {
  /** Tokens this server knows. Any other one is staff of the default tenant. */
  principals?: Record<string, FakePrincipal>;
  bufferSize?: number;
  /**
   * Where to listen, when it matters. Any free port otherwise.
   *
   * It matters in one place: a test about a connection that could not be
   * restored has to take the server away and then put it back where the client
   * is still trying to reach it. Nothing else should name a port.
   */
  port?: number;
};

/** One socket the server is currently holding. */
export type FakeConnection = {
  /** The credential presented in the handshake, and never sent again. */
  token: string;
  /** The Rooms this socket is subscribed to, in the order it joined them. */
  rooms: string[];
};

/** A handshake as it arrived, whether or not it was let through. */
export type FakeHandshake = { token: unknown; accepted: boolean };

/** A `subscribe` message as it arrived, before the gate saw it. */
export type FakeSubscribe = { room: string; afterSeq: number };

export type FakeServer = {
  /** The origin, as `NEXT_PUBLIC_API_URL` would name it. */
  url: string;
  /** The port it is listening on, so a test can put a server back on it. */
  port: number;
  /** The origin plus the namespace — what the realtime client connects to. */
  realtimeUrl: string;

  /** The sockets currently connected. */
  connections(): FakeConnection[];
  /** Every handshake attempted, refused ones included, in order. */
  handshakes(): FakeHandshake[];
  /** How many sockets are currently subscribed to a Room. */
  subscribers(room: string): number;
  /** Every `subscribe` this server has been sent, in order. */
  subscribes(): FakeSubscribe[];
  /** Every `unsubscribe` this server has been sent, in order. */
  unsubscribes(): string[];

  /** Publishes an event into a Room, numbering it as the server would. */
  emit<E extends RealtimeEventName>(
    room: string,
    event: E,
    data: RealtimeEventData[E],
  ): RealtimeEnvelope<E>;

  /**
   * Delivers an envelope that has already been delivered, unchanged.
   *
   * Not a second event: the same one, under the same number, which is what
   * at-least-once delivery means and what the contract permits. It happens for
   * real in the window between a socket joining a Room and the replay that
   * follows the join — an envelope published in between goes out live and comes
   * back in the replay — and that race is not something a test can time.
   */
  redeliver(envelope: RealtimeEnvelope): void;

  /**
   * Drops a Room's replay buffer, as the bounded buffer does on a busy Room.
   * The next resume into it is answered with a Gap.
   */
  forget(room: string): void;

  /** Drops every socket, as a moment of bad wifi does. Clients reconnect. */
  disconnectAll(): void;

  close(): Promise<void>;
};

/**
 * `t:<tenantId>:agents`, `t:<tenantId>:ticket:<id>`, and that plus `:internal`.
 *
 * The contract spells both ids as UUIDs; this asks only for the shape, because
 * every fixture in this repository names records the way the rest of them do —
 * `ten_1`, `tkt_1`. What a client can get wrong is the segment structure, and
 * that is what is enforced here: a fourth segment, a missing tenant, or a
 * suffix other than `:internal` is refused exactly as the real server refuses
 * it.
 */
const ROOM_GRAMMAR =
  /^t:(?<tenantId>[^:]+):(?:agents|ticket:(?<ticketId>[^:]+)(?<internal>:internal)?)$/;

type ParsedRoom = { tenantId: string; ticketId?: string; internal: boolean };

/** What one Room's history looks like from the server's side. */
type RoomLog = { latest: number; evicted: number; buffered: RealtimeEnvelope[] };

function parseRoom(room: string): ParsedRoom | undefined {
  const groups = ROOM_GRAMMAR.exec(room)?.groups;
  if (!groups?.tenantId) return undefined;

  return {
    tenantId: groups.tenantId,
    ticketId: groups.ticketId,
    internal: groups.internal !== undefined,
  };
}

/**
 * The gate, in the order the contract puts it: the tenant first and for
 * everyone, so that a staff member asking after another tenant's internal Room
 * is refused for the tenant and learns nothing about whether that Ticket exists.
 */
function canJoin(principal: FakePrincipal, parsed: ParsedRoom): boolean {
  if (parsed.tenantId !== principal.tenantId) return false;
  if (principal.kind === "staff") return true;

  // A customer may join only their own Ticket's Room. The `:agents` and
  // `:internal` Rooms are refused outright.
  return (
    parsed.ticketId !== undefined &&
    !parsed.internal &&
    principal.ticketIds.includes(parsed.ticketId)
  );
}

export async function startFakeServer(options: FakeServerOptions = {}): Promise<FakeServer> {
  const principals = options.principals ?? {};
  const bufferSize = options.bufferSize ?? DEFAULT_BUFFER_SIZE;

  const http: HttpServer = createServer();
  const io = new Server(http, { cors: { origin: true, credentials: true } });
  const namespace = io.of(NAMESPACE);

  /**
   * Per Room: the last number handed out, the envelopes still replayable, and
   * the highest number that has fallen out of the buffer. That last one is what
   * a Gap is computed from — a hole in the numbers is not a Gap, because `seq`
   * is monotonic but not contiguous and a customer's stream is full of holes
   * where a staff-only event took a number.
   */
  const log = new Map<string, RoomLog>();
  const handshakes: FakeHandshake[] = [];
  const subscribes: FakeSubscribe[] = [];
  const unsubscribes: string[] = [];
  const held = new Map<Socket, FakeConnection>();

  function resolve(token: unknown): FakePrincipal | undefined {
    // Every failure is one answer, so there is nothing here to branch on but
    // the two the contract names: no token at all, and a service token.
    if (typeof token !== "string" || token === "") return undefined;
    if (token.startsWith("nvk_live_")) return undefined;

    return principals[token] ?? { kind: "staff", tenantId: DEFAULT_TENANT_ID };
  }

  namespace.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const principal = resolve(token);
    handshakes.push({ token, accepted: principal !== undefined });

    // Refused before the connection exists. The client is told `unauthenticated`
    // and never enters a connected state.
    if (!principal) {
      next(new Error("unauthenticated"));
      return;
    }

    // Resolved once, here, and carried for the life of the socket: the
    // principal is fixed at connect and never re-evaluated.
    socket.data.principal = principal;
    next();
  });

  namespace.on("connection", (socket) => {
    const principal = socket.data.principal as FakePrincipal;
    const connection: FakeConnection = {
      token: socket.handshake.auth.token as string,
      rooms: [],
    };
    held.set(socket, connection);

    socket.on(
      "subscribe",
      (message: unknown, ack: (answer: SubscribeAck) => void = () => {}) => {
        const asked = message as { room?: unknown; afterSeq?: unknown };
        const room = asked?.room;
        const afterSeq = asked?.afterSeq ?? 0;

        if (
          typeof room !== "string" ||
          typeof afterSeq !== "number" ||
          !Number.isInteger(afterSeq) ||
          afterSeq < 0
        ) {
          ack({ ok: false, error: "malformed_request" });
          return;
        }

        subscribes.push({ room, afterSeq });

        const parsed = parseRoom(room);
        // A name that is not a Room at all, a Room in another tenant and a Room
        // this principal may not enter are all the same answer.
        if (!parsed || !canJoin(principal, parsed)) {
          ack({ ok: false, error: "forbidden" });
          return;
        }

        // Join first, then replay. That ordering can deliver an event both live
        // and in the replay; it can never drop one.
        void socket.join(room);
        if (!connection.rooms.includes(room)) connection.rooms.push(room);

        const entry = log.get(room);
        const replaying = entry?.buffered.filter((envelope) => envelope.seq > afterSeq) ?? [];
        for (const envelope of replaying) socket.emit(envelope.event, envelope);

        ack({ ok: true, room, replayed: replaying.length, gap: gapFor(entry, afterSeq) });
      },
    );

    socket.on("unsubscribe", (message: unknown, ack: (answer: unknown) => void = () => {}) => {
      const room = (message as { room?: unknown })?.room;
      if (typeof room !== "string") {
        ack({ ok: false, error: "malformed_request" });
        return;
      }

      unsubscribes.push(room);
      void socket.leave(room);
      connection.rooms = connection.rooms.filter((joined) => joined !== room);

      // Always acknowledged, including for a Room the socket was never in.
      // Leaving is not a capability.
      ack({ ok: true, room });
    });

    socket.on("disconnect", () => held.delete(socket));
  });

  /**
   * Whether the server can honestly replay from a resume point.
   *
   * A client with no history cannot have missed anything, so `afterSeq: 0`
   * never reports a Gap. Otherwise the answer is a Gap exactly when something
   * after the held number has been dropped — including for a Room this server
   * has never heard of, which is the same instruction to the client.
   *
   * Deliberately not "the buffer's first number is higher than the next one
   * expected": that would call a stream with holes in it a Gap, and holes are
   * ordinary. What matters is whether anything was *evicted*, never whether the
   * numbers run consecutively.
   */
  function gapFor(entry: RoomLog | undefined, afterSeq: number): boolean {
    if (afterSeq === 0) return false;
    if (!entry) return true;

    return afterSeq < entry.evicted;
  }

  await new Promise<void>((listening) => http.listen(options.port ?? 0, "127.0.0.1", listening));
  const { port } = http.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  let closed = false;

  return {
    url,
    port,
    realtimeUrl: `${url}${NAMESPACE}`,

    connections: () => [...held.values()],
    handshakes: () => [...handshakes],
    subscribers: (room) => namespace.adapter.rooms.get(room)?.size ?? 0,
    subscribes: () => [...subscribes],
    unsubscribes: () => [...unsubscribes],

    emit<E extends RealtimeEventName>(room: string, event: E, data: RealtimeEventData[E]) {
      const entry = log.get(room) ?? { latest: 0, evicted: 0, buffered: [] };
      // The one assertion in this file. `RealtimeEnvelope` is a union over the
      // event names and this is written generically over one of them, which
      // TypeScript will not relate to the union without narrowing every case by
      // hand — for an object whose fields it has already checked one by one.
      const envelope = {
        event,
        room,
        seq: entry.latest + 1,
        ts: new Date().toISOString(),
        data,
      } as RealtimeEnvelope<E>;

      entry.latest = envelope.seq;
      entry.buffered.push(envelope as RealtimeEnvelope);
      // Bounded, per Room. What falls out of the window is what the server can
      // no longer answer for, and is what it says so about with a Gap.
      while (entry.buffered.length > bufferSize) {
        const dropped = entry.buffered.shift();
        if (dropped) entry.evicted = dropped.seq;
      }
      log.set(room, entry);

      namespace.to(room).emit(event, envelope);
      return envelope;
    },

    redeliver(envelope) {
      // Straight back out, and nothing recorded: the log already holds this
      // one, and numbering it again would make it a different event.
      namespace.to(envelope.room).emit(envelope.event, envelope);
    },

    forget(room) {
      const entry = log.get(room);
      if (!entry) return;

      entry.evicted = entry.latest;
      entry.buffered = [];
    },

    disconnectAll() {
      // The transport is closed under the socket rather than the socket being
      // told to go away: a server that says "disconnect" is a server telling a
      // client not to come back, and what is being imitated here is bad wifi.
      for (const socket of held.keys()) socket.conn.close();
    },

    async close() {
      // Idempotent, because taking the server away is itself a thing a test
      // does — and the teardown that closes every server still runs afterwards.
      if (closed) return;

      closed = true;
      await io.close();
      await new Promise<void>((down) => http.close(() => down()));
    },
  };
}
