/**
 * The fake server, held to the contract it claims to speak.
 *
 * Every live behaviour in this repository is tested by causing a condition on
 * this server, so a server that answers differently from the real one would
 * make all of those tests agree with each other and with nothing else. These
 * tests are the ones that keep it honest, and they are written against a plain
 * client rather than this repository's, so that they say what the *wire* does
 * rather than what our reading of it does.
 */
import { io, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RealtimeEnvelope, SubscribeAck } from "./envelope";
import { startFakeServer, type FakeServer } from "./fake-server";

let server: FakeServer;
const sockets: Socket[] = [];

beforeEach(async () => {
  server = await startFakeServer({
    principals: {
      staff: { kind: "staff", tenantId: "ten_1" },
      customer: { kind: "customer", tenantId: "ten_1", ticketIds: ["tkt_1"] },
    },
    bufferSize: 3,
  });
});

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.close();
  await server.close();
});

/** A connected socket, and the envelopes it has been sent. */
async function connect(token: string) {
  const socket = io(server.realtimeUrl, { auth: { token } });
  sockets.push(socket);

  const received: RealtimeEnvelope[] = [];
  socket.onAny((_event, envelope: RealtimeEnvelope) => received.push(envelope));

  await new Promise<void>((connected, refused) => {
    socket.on("connect", () => connected());
    socket.on("connect_error", (error) => refused(error));
  });

  const subscribe = (room: string, afterSeq?: number) =>
    new Promise<SubscribeAck>((answered) =>
      socket.emit("subscribe", { room, afterSeq }, answered),
    );

  return { socket, received, subscribe };
}

const AGENTS = "t:ten_1:agents";

/** A Ticket snapshot's fields do not matter here; the numbering does. */
const snapshot = {
  id: "tkt_1",
  subject: "The printer is on fire",
  contactId: "con_1",
  assigneeId: null,
  state: "open",
  priority: "normal",
  source: "portal",
  createdAt: "2026-07-02T12:00:00.000Z",
  updatedAt: "2026-07-02T12:00:00.000Z",
  spawnedFromTicketId: null,
  rootTicketId: null,
} as const;

describe("the handshake", () => {
  it("refuses a connection with no credential, before it exists", async () => {
    await expect(connect("")).rejects.toThrow("unauthenticated");
  });

  it("refuses a service token, because machines do not hold sockets", async () => {
    await expect(connect("nvk_live_abc")).rejects.toThrow("unauthenticated");
    expect(server.connections()).toEqual([]);
  });
});

describe("the Room grammar and its gate", () => {
  it("refuses a name that is not a Room", async () => {
    const { subscribe } = await connect("staff");

    expect(await subscribe("tickets")).toEqual({ ok: false, error: "forbidden" });
    expect(await subscribe("t:ten_1:ticket:tkt_1:private")).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("refuses another tenant's Room, in the same words", async () => {
    const { subscribe } = await connect("staff");

    expect(await subscribe("t:ten_2:agents")).toEqual({ ok: false, error: "forbidden" });
    expect(await subscribe("t:ten_2:ticket:tkt_9")).toEqual({ ok: false, error: "forbidden" });
  });

  it("lets staff into any Room of their own tenant", async () => {
    const { subscribe } = await connect("staff");

    expect(await subscribe(AGENTS)).toMatchObject({ ok: true });
    expect(await subscribe("t:ten_1:ticket:tkt_9")).toMatchObject({ ok: true });
    expect(await subscribe("t:ten_1:ticket:tkt_9:internal")).toMatchObject({ ok: true });
  });

  it("lets a customer into their own Ticket, and nothing else", async () => {
    const { subscribe } = await connect("customer");

    expect(await subscribe("t:ten_1:ticket:tkt_1")).toMatchObject({ ok: true });
    expect(await subscribe("t:ten_1:ticket:tkt_2")).toEqual({ ok: false, error: "forbidden" });
    expect(await subscribe("t:ten_1:ticket:tkt_1:internal")).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await subscribe(AGENTS)).toEqual({ ok: false, error: "forbidden" });
  });

  it("refuses a message that is not a subscription", async () => {
    const { subscribe } = await connect("staff");

    expect(await subscribe(AGENTS, -1)).toEqual({ ok: false, error: "malformed_request" });
  });
});

describe("envelopes", () => {
  it("numbers each Room from one, on its own", async () => {
    const { received, subscribe } = await connect("staff");
    await subscribe(AGENTS);
    await subscribe("t:ten_1:ticket:tkt_1");

    server.emit(AGENTS, "ticket.created", snapshot);
    const inTheTicket = server.emit("t:ten_1:ticket:tkt_1", "ticket.updated", snapshot);
    const inTheQueue = server.emit(AGENTS, "ticket.updated", snapshot);

    // The same fact, delivered into two Rooms, carries two unrelated numbers.
    expect(inTheTicket.seq).toBe(1);
    expect(inTheQueue.seq).toBe(2);

    await expect
      .poll(() => received.map((envelope) => [envelope.room, envelope.seq]))
      .toEqual([
        [AGENTS, 1],
        ["t:ten_1:ticket:tkt_1", 1],
        [AGENTS, 2],
      ]);
  });

  it("carries the Room the copy was delivered into", async () => {
    const { received, subscribe } = await connect("staff");
    await subscribe(AGENTS);

    server.emit(AGENTS, "ticket.created", snapshot);

    await expect.poll(() => received.length).toBe(1);
    expect(received.at(0)).toMatchObject({
      event: "ticket.created",
      room: AGENTS,
      seq: 1,
      data: { id: "tkt_1" },
    });
    expect(Date.parse(received.at(0)!.ts)).not.toBeNaN();
  });
});

describe("a resume point", () => {
  it("replays only what was missed, before the ack", async () => {
    server.emit(AGENTS, "ticket.created", snapshot);
    server.emit(AGENTS, "ticket.updated", snapshot);
    server.emit(AGENTS, "ticket.assigned", snapshot);

    const { received, subscribe } = await connect("staff");
    const ack = await subscribe(AGENTS, 1);

    expect(ack).toEqual({ ok: true, room: AGENTS, replayed: 2, gap: false });
    // Before the ack, so a client that counts on `replayed` is counting
    // something it has already been handed.
    expect(received.map((envelope) => envelope.seq)).toEqual([2, 3]);
  });

  it("replays everything it holds for a fresh subscribe", async () => {
    server.emit(AGENTS, "ticket.created", snapshot);

    const { subscribe } = await connect("staff");

    expect(await subscribe(AGENTS)).toEqual({ ok: true, room: AGENTS, replayed: 1, gap: false });
  });

  it("says a client that is caught up is caught up", async () => {
    server.emit(AGENTS, "ticket.created", snapshot);

    const { subscribe } = await connect("staff");

    expect(await subscribe(AGENTS, 1)).toEqual({ ok: true, room: AGENTS, replayed: 0, gap: false });
  });
});

describe("the Gap flag", () => {
  it("is not raised by a hole in the numbers, because holes are ordinary", async () => {
    // A customer's stream has holes where a staff-only event took a number, so
    // 1, 3, 4 is normal and is not a lost event. Nothing here was evicted, so
    // nothing here is a Gap — whatever the numbers look like.
    const staffOnly = "t:ten_1:agents";
    server.emit(staffOnly, "ticket.created", snapshot);
    server.emit(staffOnly, "ticket.updated", snapshot);
    server.emit(staffOnly, "ticket.assigned", snapshot);

    const { subscribe } = await connect("staff");

    expect(await subscribe(staffOnly, 1)).toMatchObject({ gap: false });
  });

  it("is raised when the buffer no longer reaches back to the resume point", async () => {
    // Five envelopes into a buffer of three, which now starts at 3. A client
    // holding 1 is owed 2, and 2 is gone — so it cannot be answered honestly.
    // Holding 2 could have been: the window reaching back exactly far enough is
    // being caught up, not a Gap.
    for (let i = 0; i < 5; i++) server.emit(AGENTS, "ticket.updated", snapshot);

    const { subscribe } = await connect("staff");

    expect(await subscribe(AGENTS, 1)).toEqual({ ok: true, room: AGENTS, replayed: 3, gap: true });
    expect(await subscribe(AGENTS, 2)).toEqual({ ok: true, room: AGENTS, replayed: 3, gap: false });
  });

  it("is raised for a Room the server has forgotten entirely", async () => {
    server.emit(AGENTS, "ticket.created", snapshot);
    server.emit(AGENTS, "ticket.updated", snapshot);
    server.forget(AGENTS);

    const { subscribe } = await connect("staff");

    expect(await subscribe(AGENTS, 1)).toEqual({ ok: true, room: AGENTS, replayed: 0, gap: true });
  });

  it("is never raised for a client with no history to have missed anything from", async () => {
    for (let i = 0; i < 4; i++) server.emit(AGENTS, "ticket.updated", snapshot);

    const { subscribe } = await connect("staff");

    expect(await subscribe(AGENTS, 0)).toMatchObject({ gap: false });
  });
});

describe("leaving", () => {
  it("is always acknowledged, including for a Room the socket was never in", async () => {
    const { socket } = await connect("staff");

    const ack = await new Promise((answered) =>
      socket.emit("unsubscribe", { room: AGENTS }, answered),
    );

    expect(ack).toEqual({ ok: true, room: AGENTS });
  });

  it("stops delivery to the socket that left, and to nobody else", async () => {
    const staying = await connect("staff");
    const leaving = await connect("staff");
    await staying.subscribe(AGENTS);
    await leaving.subscribe(AGENTS);

    await new Promise((answered) => leaving.socket.emit("unsubscribe", { room: AGENTS }, answered));
    server.emit(AGENTS, "ticket.created", snapshot);

    await expect.poll(() => staying.received.length).toBe(1);
    expect(leaving.received).toEqual([]);
  });
});
