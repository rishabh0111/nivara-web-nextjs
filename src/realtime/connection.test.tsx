/**
 * The live connection, driven through the wire.
 *
 * Every test here talks to a real server speaking the real contract, and
 * asserts on what that server saw or on what the views were told. Nothing
 * reaches into the realtime layer: there is no assertion about a cursor map, a
 * handler, or a call count, because a client that holds the right internal
 * state and sends the wrong thing on the wire is a broken client.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ticket } from "@/tickets/tickets.fixtures";

import { connectRealtime, type RealtimeConnection, type RoomReader } from "./connection";
import { rooms, type RealtimeEnvelope } from "./envelope";
import { startFakeServer, type FakeServer } from "./fake-server";
import { createLiveConnection, type LiveConnection } from "./live-connection";
import { useLiveRoom } from "./use-live-room";

let server: FakeServer;
const open: { close(): void }[] = [];

beforeEach(async () => {
  server = await startFakeServer();
});

afterEach(async () => {
  for (const connection of open.splice(0)) connection.close();
  await server.close();
});

function connect(token = "tok_1"): RealtimeConnection {
  const connection = connectRealtime({ url: server.realtimeUrl, token });
  open.push(connection);
  return connection;
}

/** A Surface's one connection, closed with the rest at the end of the test. */
function surface(token = "tok_1"): LiveConnection {
  const live = createLiveConnection({ url: server.realtimeUrl, token: () => token });
  open.push(live);
  return live;
}

const AGENTS = rooms.agents("ten_1");
const TICKET = rooms.ticket("ten_1", "tkt_1");

/** A reader that collects what it is told, and which Rooms it dropped. */
function into(seen: RealtimeEnvelope[], discarded: string[] = [], room = AGENTS): RoomReader {
  return { envelope: (envelope) => seen.push(envelope), gap: () => discarded.push(room) };
}

/** A reader for a Room a test only needs somebody to be in. */
const anybody: RoomReader = { envelope: () => {}, gap: () => {} };

/** A thread entry, as the socket carries a Message or a Note. */
const entry = (id: string, body: string) => ({
  id,
  ticketId: "tkt_1",
  body,
  authorKind: "user" as const,
  authorId: "usr_1",
  createdAt: "2026-07-02T12:00:00.000Z",
});

/** A Ticket snapshot, as the socket carries one. */
const snapshot = (subject: string) => ({
  ...ticket({ id: "tkt_1", subject }),
  spawnedFromTicketId: null,
  rootTicketId: null,
});

describe("the connection itself", () => {
  it("presents the credential once, in the handshake", async () => {
    connect("tok_1");

    await waitFor(() => expect(server.connections()).toHaveLength(1));
    expect(server.connections().map((held) => held.token)).toEqual(["tok_1"]);
  });

  it("delivers what is published into a Room it has joined", async () => {
    const seen: RealtimeEnvelope[] = [];
    connect().join(AGENTS, into(seen));

    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));

    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen.at(0)).toMatchObject({
      event: "ticket.created",
      room: AGENTS,
      seq: 1,
      data: { subject: "The printer is on fire" },
    });
  });

  it("is told once about an envelope delivered twice", async () => {
    const seen: RealtimeEnvelope[] = [];
    connect().join(AGENTS, into(seen));

    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    const published = server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));
    await waitFor(() => expect(seen).toHaveLength(1));

    // At-least-once delivery, which the contract permits and a reconnect makes
    // ordinary. The Room's cursor is already past this number, so it is not a
    // reason to tell anybody anything a second time.
    server.redeliver(published);
    server.emit(AGENTS, "ticket.updated", snapshot("The printer is on fire"));

    await waitFor(() => expect(seen.map((envelope) => envelope.seq)).toEqual([1, 2]));
  });

  it("hears nothing published into a Room it has not joined", async () => {
    const seen: RealtimeEnvelope[] = [];
    connect().join(AGENTS, into(seen));

    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    server.emit(TICKET, "message.created", entry("msg_1", "On its way"));
    server.emit(AGENTS, "ticket.updated", snapshot("The printer is on fire"));

    await waitFor(() => expect(seen.map((envelope) => envelope.event)).toEqual(["ticket.updated"]));
  });

  it("keeps one connection per Surface however many Rooms are joined", async () => {
    const connection = connect();
    connection.join(AGENTS, anybody);
    connection.join(TICKET, anybody);

    await waitFor(() => expect(server.subscribers(TICKET)).toBe(1));
    expect(server.connections()).toHaveLength(1);
  });

  it("resumes each Room from its own highest sequence number", async () => {
    const connection = connect();
    const seen: RealtimeEnvelope[] = [];
    const leave = connection.join(AGENTS, into(seen));

    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));
    server.emit(AGENTS, "ticket.updated", snapshot("The printer is on fire"));
    await waitFor(() => expect(seen).toHaveLength(2));

    leave();
    await waitFor(() => expect(server.unsubscribes()).toEqual([AGENTS]));

    connection.join(AGENTS, anybody);
    await waitFor(() => expect(server.subscribes()).toHaveLength(2));
    expect(server.subscribes().at(1)).toEqual({ room: AGENTS, afterSeq: 2 });
  });

  it("does not retry a credential the handshake refused", async () => {
    connect("nvk_live_abc");

    // Refused before the connection exists, and not tried again: every refusal
    // is the same answer, and nothing but a different credential could change
    // it. Getting one is the session's business, not this connection's.
    await waitFor(() => expect(server.handshakes()).toHaveLength(1));
    await new Promise((settled) => setTimeout(settled, 300));
    expect(server.handshakes()).toEqual([{ token: "nvk_live_abc", accepted: false }]);
    expect(server.connections()).toEqual([]);
  });

  it("comes back from a dropped connection, each Room from its own cursor", async () => {
    const connection = connect();
    const seen: RealtimeEnvelope[] = [];
    connection.join(AGENTS, into(seen));
    connection.join(TICKET, into(seen));

    await waitFor(() => expect(server.subscribers(TICKET)).toBe(1));
    server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));
    server.emit(AGENTS, "ticket.updated", snapshot("The printer is on fire"));
    server.emit(TICKET, "message.created", entry("msg_1", "On its way"));
    await waitFor(() => expect(seen).toHaveLength(3));

    // A moment of bad wifi. Socket.IO comes back on its own; the Rooms come
    // back with it, each asking for what it alone is missing — the numbers are
    // per Room, so the queue asking for 2 and the Ticket asking for 1 is two
    // unrelated counts of the same period.
    server.disconnectAll();

    // Socket.IO waits a second before its first attempt.
    await waitFor(() => expect(server.subscribes()).toHaveLength(4), { timeout: 5000 });
    expect(server.subscribes().slice(2)).toEqual([
      { room: AGENTS, afterSeq: 2 },
      { room: TICKET, afterSeq: 1 },
    ]);
  });

  it("backfills only what was missed while it was away", async () => {
    const connection = connect();
    const seen: RealtimeEnvelope[] = [];
    connection.join(AGENTS, into(seen));

    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));
    await waitFor(() => expect(seen).toHaveLength(1));

    server.disconnectAll();
    // Published while nobody was there to hear it. The Room's buffer holds it,
    // and the resume point is what decides that this one is replayed and the
    // one already seen is not.
    server.emit(AGENTS, "ticket.updated", snapshot("The printer is smoking"));

    await waitFor(() => expect(seen).toHaveLength(2), { timeout: 5000 });
    expect(seen.map((envelope) => envelope.seq)).toEqual([1, 2]);
  });

  it("stops reading when it is closed", async () => {
    const connection = connect();
    connection.join(AGENTS, anybody);
    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));

    connection.close();

    await waitFor(() => expect(server.connections()).toHaveLength(0));
  });
});

/**
 * The Gap, caused the only way it happens in life.
 *
 * The socket goes away, the Room carries on without it, and by the time it comes
 * back the server can no longer answer for the stretch it missed. Nothing here
 * asks the server for a Gap; it is arranged and then arrives.
 */
describe("a Room the server can no longer replay", () => {
  it("tells whoever is reading it to discard what they hold", async () => {
    const connection = connect();
    const seen: RealtimeEnvelope[] = [];
    const discarded: string[] = [];
    connection.join(AGENTS, into(seen, discarded));

    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));
    await waitFor(() => expect(seen).toHaveLength(1));

    server.disconnectAll();
    // The Room is busy while the socket is away, and then the buffer no longer
    // reaches back to where this reader got to.
    server.emit(AGENTS, "ticket.updated", snapshot("The printer is smoking"));
    server.forget(AGENTS);

    await waitFor(() => expect(discarded).toEqual([AGENTS]), { timeout: 5000 });
  });

  it("says nothing of the kind when the resume point is still answerable", async () => {
    const connection = connect();
    const seen: RealtimeEnvelope[] = [];
    const discarded: string[] = [];
    connection.join(AGENTS, into(seen, discarded));

    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));
    await waitFor(() => expect(seen).toHaveLength(1));

    server.disconnectAll();
    server.emit(AGENTS, "ticket.updated", snapshot("The printer is smoking"));

    await waitFor(() => expect(seen).toHaveLength(2), { timeout: 5000 });
    expect(discarded).toEqual([]);
  });
});

/**
 * A connection that has stopped and cannot get back.
 *
 * Caused by taking the server away entirely, which is what a sleeping instance
 * or a lost network looks like from the browser: the attempts to come back are
 * refused by nothing at all. A blip is not this — the first attempt succeeds and
 * nobody is told anything, which is the whole of "the User does not notice".
 */
describe("the health of a connection", () => {
  it("is not called into question by a moment of bad wifi", async () => {
    const connection = connect();
    const seen: RealtimeEnvelope[] = [];
    connection.join(AGENTS, into(seen));
    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));

    const reported: string[] = [];
    connection.watch(() => reported.push(connection.health()));

    server.disconnectAll();
    server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));

    await waitFor(() => expect(seen).toHaveLength(1), { timeout: 5000 });
    expect(reported).not.toContain("silent");
    expect(connection.health()).toBe("live");
  });

  it("is silent at once for a handshake that will not be tried again", async () => {
    // The refusal the client does not retry, and therefore the one case where
    // waiting for a failed attempt to come back would wait forever. Nothing is
    // being read and nothing ever will be, so saying so cannot wait on a
    // reconnection that is not going to be scheduled.
    const connection = connect("nvk_live_abc");
    connection.join(AGENTS, anybody);

    await waitFor(() => expect(connection.health()).toBe("silent"));
    expect(server.handshakes()).toEqual([{ token: "nvk_live_abc", accepted: false }]);
  });

  it("is silent while the server is gone, and live again when it is back", async () => {
    const gone = await startFakeServer();
    const connection = connectRealtime({ url: gone.realtimeUrl, token: "tok_1" });
    open.push(connection);
    connection.join(AGENTS, anybody);

    await waitFor(() => expect(gone.subscribers(AGENTS)).toBe(1));
    expect(connection.health()).toBe("live");

    // Nothing is listening on that port any more, so coming back is refused by
    // the operating system — which is the honest version of a network that has
    // gone away, and the one thing the browser cannot recover from on its own.
    await gone.close();
    await waitFor(() => expect(connection.health()).toBe("silent"), { timeout: 15000 });

    const back = await startFakeServer({ port: gone.port });
    try {
      await waitFor(() => expect(connection.health()).toBe("live"), { timeout: 15000 });
      // And it is reading again, from where it got to — being told is a state
      // the connection leaves, not a screen that stays broken.
      await waitFor(() => expect(back.subscribers(AGENTS)).toBe(1));
    } finally {
      await back.close();
    }
  }, 40000);
});

/** A view that holds a Room open for as long as it is on the screen. */
function Watcher({
  live,
  room,
  onEnvelope,
}: {
  live: LiveConnection;
  room: string;
  onEnvelope?: (envelope: RealtimeEnvelope) => void;
}) {
  useLiveRoom(live, room, { envelope: (envelope) => onEnvelope?.(envelope), gap: () => {} });
  return <p>watching {room}</p>;
}

describe("two views on one Room", () => {
  it("produce one subscription, and the last to leave is the one that unsubscribes", async () => {
    const held = surface();

    const { rerender } = render(
      <>
        <Watcher live={held} room={AGENTS} />
        <Watcher live={held} room={AGENTS} />
      </>,
    );

    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    expect(server.subscribes()).toHaveLength(1);

    // One view goes; the other is still reading, so the subscription stays.
    rerender(<Watcher live={held} room={AGENTS} />);
    expect(await screen.findByText(`watching ${AGENTS}`)).toBeVisible();
    expect(server.unsubscribes()).toEqual([]);
    expect(server.subscribers(AGENTS)).toBe(1);

    // The last one goes, and now there is nobody to read for.
    rerender(<p>nothing</p>);
    await waitFor(() => expect(server.unsubscribes()).toEqual([AGENTS]));
    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(0));
  });

  it("are both told about an event that arrives once", async () => {
    const held = surface();
    const first: RealtimeEnvelope[] = [];
    const second: RealtimeEnvelope[] = [];

    render(
      <>
        <Watcher live={held} room={AGENTS} onEnvelope={(e) => first.push(e)} />
        <Watcher live={held} room={AGENTS} onEnvelope={(e) => second.push(e)} />
      </>,
    );

    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));

    await waitFor(() => expect(first).toHaveLength(1));
    await waitFor(() => expect(second).toHaveLength(1));
  });

  it("share the one connection the Surface holds", async () => {
    const held = surface();

    render(
      <>
        <Watcher live={held} room={AGENTS} />
        <Watcher live={held} room={TICKET} />
      </>,
    );

    await waitFor(() => expect(server.subscribers(TICKET)).toBe(1));
    expect(server.connections()).toHaveLength(1);
  });
});

/**
 * The Widget's move, and only the Widget's.
 *
 * The staff connection rides a renewal because the principal is fixed at
 * connect and a staff role change can wait for the next one. A Visitor's
 * session is different: it is revocable, short, and renewed often enough that
 * carrying a retired credential on an open socket would mean a revoked Visitor
 * going on being read to for as long as they leave the tab open.
 */
describe("a Surface that replaces its credential", () => {
  /** A connection whose credential the test can change under it. */
  function renewable(first: string) {
    let held = first;
    const live = createLiveConnection({ url: server.realtimeUrl, token: () => held });
    open.push(live);

    return { live, renew: (next: string) => (held = next) };
  }

  it("presents the new one and keeps reading every Room it was reading", async () => {
    const { live, renew } = renewable("tok_1");

    const seen: RealtimeEnvelope[] = [];
    render(
      <>
        <Watcher live={live} room={AGENTS} onEnvelope={(envelope) => seen.push(envelope)} />
        <Watcher live={live} room={TICKET} />
      </>,
    );
    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    await waitFor(() => expect(server.subscribers(TICKET)).toBe(1));

    renew("tok_2");
    live.rebuild();

    // A second handshake, with the credential the Surface holds now — and the
    // first one gone, rather than two sockets reading the same Rooms.
    await waitFor(() => expect(server.connections().map((held) => held.token)).toEqual(["tok_2"]));
    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    await waitFor(() => expect(server.subscribers(TICKET)).toBe(1));

    // And the views above it were never unmounted, so what arrives next still
    // reaches them: the rebuild is the Surface's business, not theirs.
    server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));
    await waitFor(() => expect(seen).toHaveLength(1));
  });

  /**
   * A rebuild is a new connection, so its Rooms resume from nothing and the
   * server replays what it still holds. That is the cheap answer and the safe
   * one: `afterSeq: 0` is the one resume point that can never be answered with
   * a Gap, and every reader above already drops what it has seen before —
   * identity is a record's own id, never the number it arrived under.
   */
  it("hears again what it heard before, and never that it has lost its place", async () => {
    const { live, renew } = renewable("tok_1");

    const seen: RealtimeEnvelope[] = [];
    const discarded: string[] = [];
    live.join(AGENTS, into(seen, discarded));

    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));
    server.emit(AGENTS, "ticket.created", snapshot("The printer is on fire"));
    await waitFor(() => expect(seen).toHaveLength(1));

    renew("tok_2");
    live.rebuild();

    await waitFor(() => expect(seen).toHaveLength(2));
    expect(seen.map((envelope) => envelope.seq)).toEqual([1, 1]);
    expect(discarded).toEqual([]);
  });

  it("does not open one where the Surface was not reading anything", async () => {
    const { live, renew } = renewable("tok_1");

    renew("tok_2");
    live.rebuild();

    // Nothing joined, so nothing to rebuild. A connection is opened by the
    // first Room somebody reads and by nothing else.
    await new Promise((settled) => setTimeout(settled, 50));
    expect(server.handshakes()).toHaveLength(0);
  });

  it("leaves the Rooms alone when a view has already left them", async () => {
    const { live, renew } = renewable("tok_1");

    const { rerender } = render(<Watcher live={live} room={AGENTS} />);
    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(1));

    rerender(<p>nothing</p>);
    await waitFor(() => expect(server.subscribers(AGENTS)).toBe(0));

    renew("tok_2");
    live.rebuild();

    await waitFor(() => expect(server.connections().map((held) => held.token)).toEqual(["tok_2"]));
    // The subscription is not resurrected by the rebuild: nobody is reading it.
    await new Promise((settled) => setTimeout(settled, 50));
    expect(server.subscribers(AGENTS)).toBe(0);
  });
});

describe("a Room the principal may not have", () => {
  it("is refused without taking the connection down with it", async () => {
    const refused = await startFakeServer({
      principals: { tok_c: { kind: "customer", tenantId: "ten_1", ticketIds: ["tkt_1"] } },
    });

    try {
      const connection = connectRealtime({ url: refused.realtimeUrl, token: "tok_c" });
      open.push(connection);

      const seen: RealtimeEnvelope[] = [];
      connection.join(rooms.internal("ten_1", "tkt_1"), into(seen));
      connection.join(rooms.ticket("ten_1", "tkt_1"), into(seen));

      await waitFor(() => expect(refused.subscribers(rooms.ticket("ten_1", "tkt_1"))).toBe(1));
      expect(refused.subscribers(rooms.internal("ten_1", "tkt_1"))).toBe(0);

      refused.emit(
        rooms.internal("ten_1", "tkt_1"),
        "note.created",
        entry("not_1", "Chasing the vendor"),
      );
      refused.emit(
        rooms.ticket("ten_1", "tkt_1"),
        "message.created",
        entry("msg_1", "On its way"),
      );

      await waitFor(() =>
        expect(seen.map((envelope) => envelope.event)).toEqual(["message.created"]),
      );
    } finally {
      await refused.close();
    }
  });
});
