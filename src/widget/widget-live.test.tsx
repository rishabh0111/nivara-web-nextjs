/**
 * A Visitor's conversation while it is being answered, and across the renewal
 * that keeps it alive.
 *
 * Every case is *caused* — a real Socket.IO server publishing a real envelope
 * into a real Room, a real renewal replacing a real credential — and asserted
 * on what is inside the shadow root. Nothing reaches into the realtime layer or
 * the cache: a client holding the right internal state and showing the wrong
 * thing is a broken client, and the claim of this issue is entirely about what
 * a Visitor sees.
 *
 * The principal here is a `customer`, which is what the server makes of a
 * Widget credential. That is the gate the Widget's whole safety rests on, and
 * running against it is the point of using this server rather than a stub.
 */
import { act } from "@testing-library/react";
import { HttpResponse, http, passthrough } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { rooms } from "@/realtime/envelope";
import { startFakeServer, type FakeServer } from "@/realtime/fake-server";
import { SessionStore } from "@/session/store";
import { message, note, ticket } from "@/tickets/tickets.fixtures";

import { bootWidget, type BootedWidget } from "./boot";
import {
  aiBaseUrl,
  baseUrl,
  conversations,
  disclosure,
  snippet as makeSnippet,
  tenantId,
  widgetSession,
} from "./widget.fixtures";

const api = setupServer();
beforeAll(() => api.listen({ onUnhandledRequest: "error" }));
afterEach(() => api.resetHandlers());
afterAll(() => api.close());

let wire: FakeServer;
let store: SessionStore;
let booted: BootedWidget | undefined;
/** Every path the Widget asked the API for, in order. */
let asked: string[];

const TICKET = rooms.ticket(tenantId, "tkt_1");
const INTERNAL = rooms.internal(tenantId, "tkt_1");

/** The conversation the Visitor is reading throughout. */
const earlier = ticket({ id: "tkt_1", subject: "Where is my order", source: "widget" });

beforeEach(async () => {
  // The token every mint hands out, resolved to a customer who may read their
  // own Ticket's Room and nothing else — exactly as the API resolves one.
  wire = await startFakeServer({
    principals: {
      nvw_1: { kind: "customer", tenantId, ticketIds: ["tkt_1"] },
      nvw_2: { kind: "customer", tenantId, ticketIds: ["tkt_1"] },
    },
  });

  store = new SessionStore();
  asked = [];
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  sessionStorage.clear();

  api.events.removeAllListeners();
  api.events.on("request:start", ({ request }) => {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/socket.io/")) return;
    asked.push(`${request.method} ${path}`);
  });

  // The socket is a real one on a real port; msw is stubbing the API, not it.
  api.use(http.all(`${wire.url}/*`, () => passthrough()));

  // A session starting fresh (a lapse, a new Visitor) opens onto the Start
  // screen, which fetches this the moment it renders.
  api.use(http.get(`${aiBaseUrl}/widget/disclosure`, () => disclosure()));
});

afterEach(async () => {
  booted?.unmount();
  booted = undefined;
  await wire.close();
});

/** The reads a Visitor with one earlier conversation is answered with. */
function reading() {
  return [
    http.get(`${baseUrl}/widget/tickets`, () => conversations(earlier)),
    http.get(`${baseUrl}/widget/tickets/tkt_1`, () => HttpResponse.json(earlier)),
    http.get(`${baseUrl}/widget/tickets/tkt_1/messages`, () =>
      HttpResponse.json({
        data: [message({ id: "msg_1", body: "Where is my order?" })],
        nextCursor: null,
      }),
    ),
  ];
}

/** `POST /widget/sessions`, minting a credential with `seconds` of life. */
function mints(seconds = 1800) {
  return http.post(`${baseUrl}/widget/sessions`, () =>
    HttpResponse.json({ token: "nvw_1", expiresInSeconds: seconds }),
  );
}

function boot() {
  const script = makeSnippet();
  document.head.append(script);

  let widget: BootedWidget;
  act(() => {
    widget = bootWidget({ script, session: widgetSession(store, wire.realtimeUrl) });
  });

  booted = widget!;
  return booted;
}

function inside(widget: BootedWidget, selector: string) {
  return widget.host.root.querySelector(selector);
}

function button(widget: BootedWidget, selector: string): HTMLButtonElement {
  const found = inside(widget, selector);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`No ${selector} was rendered.`);
  return found;
}

async function press(control: HTMLButtonElement) {
  await act(async () => {
    control.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function settle() {
  for (let turn = 0; turn < 2; turn += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/**
 * Waits for something to become true, letting React flush in between.
 *
 * Testing Library's own `waitFor` looks at `document`, and nothing the Widget
 * renders is in one — it is inside a shadow root on a host element.
 */
async function until(claim: () => void, within = 5000) {
  const deadline = Date.now() + within;

  for (;;) {
    try {
      claim();
      return;
    } catch (failed) {
      if (Date.now() > deadline) throw failed;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
  }
}

/** Opens the Widget and reads the earlier conversation, joined to its Room. */
async function readingOne() {
  const widget = boot();
  await press(button(widget, ".nvw-launcher"));
  await settle();
  await press(button(widget, ".nvw-row"));
  await settle();

  await until(() => expect(wire.subscribers(TICKET)).toBe(1));
  return widget;
}

/** What the Visitor is reading, top to bottom. */
function said(widget: BootedWidget) {
  return [...widget.host.root.querySelectorAll("[aria-label='Conversation'] li")].map(
    (row) => row.textContent ?? "",
  );
}

describe("a conversation being answered", () => {
  it("grows as staff reply, without the Visitor asking for anything", async () => {
    api.use(mints(), ...reading());
    const widget = await readingOne();

    expect(said(widget)).toHaveLength(1);

    wire.emit(
      TICKET,
      "message.created",
      message({
        id: "msg_2",
        body: "It ships tomorrow.",
        authorKind: "user",
        authorId: "usr_1",
        createdAt: "2026-07-01T11:00:00.000Z",
      }),
    );

    await until(() => expect(said(widget).at(-1)).toContain("It ships tomorrow."));
    // Last, not first. The thread is read newest-first and reversed whole, so a
    // reply arriving on the wire has to land at the end of what is read.
    expect(said(widget).at(0)).toContain("Where is my order?");
    expect(said(widget)).toHaveLength(2);
  });

  it("does not grow twice for a reply delivered twice", async () => {
    api.use(mints(), ...reading());
    const widget = await readingOne();

    const published = wire.emit(
      TICKET,
      "message.created",
      message({ id: "msg_2", body: "It ships tomorrow.", authorKind: "user", authorId: "usr_1" }),
    );
    await until(() => expect(said(widget)).toHaveLength(2));

    // At-least-once delivery: the same envelope, under the same number, again.
    wire.redeliver(published);

    // Something after it, so the count is taken once the redelivery has had
    // every chance to land.
    wire.emit(
      TICKET,
      "message.created",
      message({ id: "msg_3", body: "It has shipped.", authorKind: "user", authorId: "usr_1" }),
    );

    await until(() => expect(said(widget).at(-1)).toContain("It has shipped."));
    expect(said(widget)).toHaveLength(3);
  });
});

/**
 * The one thing this Surface must never do.
 *
 * Two defences, and the test drives the outer one to failure on purpose. The
 * Room gate is what actually holds — a customer principal is refused the
 * `:internal` Room outright — so the Note here is published into the Room the
 * Visitor is *allowed* to be in, which is what a mis-routed event or a server
 * bug would look like from this side. The replay after a reconnect is where one
 * would slip through, because that path re-delivers a Room's whole buffer.
 */
describe("an internal note", () => {
  it("is never asked for, and never shown when it arrives anyway", async () => {
    api.use(mints(), ...reading());
    const widget = await readingOne();

    // Never asked for. There is no second subscription and no second cursor.
    expect(wire.subscribes().map((asking) => asking.room)).not.toContain(INTERNAL);
    expect(wire.subscribers(INTERNAL)).toBe(0);

    wire.emit(
      TICKET,
      "note.created",
      note({ id: "not_1", body: "Third printer this month — check the contract." }),
    );

    // Something after it, in the same Room, so the assertion below is made
    // after the Note has had every chance to be applied.
    wire.emit(
      TICKET,
      "message.created",
      message({ id: "msg_2", body: "It ships tomorrow.", authorKind: "user", authorId: "usr_1" }),
    );

    await until(() => expect(said(widget).at(-1)).toContain("It ships tomorrow."));
    expect(widget.host.root.textContent).not.toContain("Third printer this month");
    expect(said(widget)).toHaveLength(2);
  });

  /**
   * The backfill, which is where one would actually slip through.
   *
   * Caused by a **Rebuild** rather than by bad wifi, and that is the honest
   * vehicle rather than a convenient one. A reconnect resumes each Room from
   * its own cursor, and that cursor has already moved past a Note this client
   * chose not to apply — so nothing is replayed and the test would prove
   * nothing. A Rebuild resumes from nothing and the server replays the Room's
   * whole buffer, Note included. It is also the case that actually happens
   * here: the Widget rebuilds on every renewal, so this replay is a routine
   * event on this Surface rather than an exotic one.
   */
  it("is not let through by the backfill after the connection is rebuilt", async () => {
    api.use(mints(), renews(), ...reading());
    const widget = await readingOne();

    const replayed = wire.emit(
      TICKET,
      "note.created",
      note({ id: "not_1", body: "Chasing the vendor." }),
    );
    wire.emit(
      TICKET,
      "message.created",
      message({ id: "msg_2", body: "It ships tomorrow.", authorKind: "user", authorId: "usr_1" }),
    );
    await until(() => expect(said(widget)).toHaveLength(2));

    await renew(widget);

    // Resumed from nothing, so the Note is genuinely on the wire a second time.
    await until(() => {
      const resumed = wire.subscribes().filter((asking) => asking.room === TICKET);
      expect(resumed.at(-1)?.afterSeq).toBe(0);
    });
    expect(replayed.seq).toBe(1);

    wire.emit(
      TICKET,
      "message.created",
      message({ id: "msg_3", body: "It has shipped.", authorKind: "user", authorId: "usr_1" }),
    );

    await until(() => expect(said(widget).at(-1)).toContain("It has shipped."));
    expect(widget.host.root.textContent).not.toContain("Chasing the vendor");
    expect(said(widget)).toHaveLength(3);
  });
});

/** A renewal falling due, caused rather than waited for. See `renews` below. */
async function renew(widget: BootedWidget) {
  await act(async () => {
    await widget.session.renew();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const renews = () =>
  http.post(`${baseUrl}/widget/sessions/renew`, () =>
    HttpResponse.json({ token: "nvw_2", expiresInSeconds: 1800 }),
  );

const refusesRenewal = () =>
  http.post(`${baseUrl}/widget/sessions/renew`, () =>
    HttpResponse.json(
      { error: { code: "unauthenticated", message: "Session expired" } },
      { status: 401 },
    ),
  );

describe("a session renewed under a conversation", () => {
  /**
   * Ahead of expiry, and provably so: nothing here is ever refused. A client
   * that only renewed in response to a refusal would never renew at all
   * against these handlers, and would be holding a dead credential the moment
   * the API enforced one.
   *
   * One second of life, so the renewal scheduled at boot is due the instant the
   * credential is minted. A real one is thirty minutes; what is being asserted
   * is that booting the Widget is what set the renewal going, and *when* it
   * falls due is `widget-renewal.test.ts`'s question.
   */
  it("is replaced before it lapses, without anything having been refused", async () => {
    api.use(mints(1), renews(), ...reading());

    const widget = boot();
    await press(button(widget, ".nvw-launcher"));
    await settle();

    await until(() => expect(asked).toContain("POST /widget/sessions/renew"));
    expect(store.get("widget")?.accessToken).toBe("nvw_2");
  });

  /**
   * The rebuild, caused rather than waited for.
   *
   * The renewal is asked for directly so that it falls due at a moment this
   * test chooses — with the conversation on screen and its Room joined, which
   * is the only arrangement in which "invisible to the Visitor" means anything.
   * It is the same call the scheduler makes, and the credential changing is the
   * whole of what the connection reacts to.
   */
  it("is rebuilt on the new credential, and the Visitor is not interrupted", async () => {
    api.use(mints(), renews(), ...reading());

    const widget = await readingOne();
    expect(wire.connections().map((held) => held.token)).toEqual(["nvw_1"]);

    await renew(widget);

    // Rebuilt rather than left riding: a second handshake, with the credential
    // held now, and the socket the first opened gone rather than left reading.
    await until(() => expect(wire.connections().map((held) => held.token)).toEqual(["nvw_2"]));
    expect(wire.handshakes().map((shake) => shake.token)).toEqual(["nvw_1", "nvw_2"]);

    // Invisible from the Visitor's side: same conversation, still on screen,
    // still being read to.
    await until(() => expect(wire.subscribers(TICKET)).toBe(1));
    expect(said(widget).at(0)).toContain("Where is my order?");

    wire.emit(
      TICKET,
      "message.created",
      message({ id: "msg_2", body: "It ships tomorrow.", authorKind: "user", authorId: "usr_1" }),
    );

    await until(() => expect(said(widget).at(-1)).toContain("It ships tomorrow."));
    expect(said(widget)).toHaveLength(2);
  });
});

describe("a session that lapsed anyway", () => {
  /**
   * A laptop asleep through the renewal, or a session revoked at the API. The
   * Widget must say so: a panel that goes on looking like a working one while
   * every send is refused is the failure this exists to prevent.
   */
  it("says so plainly and offers a fresh start", async () => {
    api.use(mints(), refusesRenewal(), ...reading());

    const widget = await readingOne();
    await renew(widget);

    await until(() => expect(inside(widget, "[role=alert]")?.textContent).toMatch(/ended/i));
    expect(store.get("widget")).toBeUndefined();

    const words = inside(widget, "[role=alert]")!.textContent ?? "";
    // Plain, and honest about what starting again costs: a new session is a new
    // anonymous Visitor, and nothing the last one raised is reachable from it.
    expect(words).not.toMatch(/error|failed|unauthenticated/i);
    expect(words).toMatch(/new conversation/i);

    // And the connection went with the credential. A session that has ended
    // must stop being read to.
    await until(() => expect(wire.connections()).toHaveLength(0));
  });

  it("starts again as somebody new, carrying nothing from the last one", async () => {
    let mint = 0;
    api.use(
      http.post(`${baseUrl}/widget/sessions`, () => {
        mint += 1;
        return HttpResponse.json({ token: "nvw_1", expiresInSeconds: 1800 });
      }),
      refusesRenewal(),
      ...reading(),
    );

    const widget = await readingOne();
    await renew(widget);
    await until(() => expect(inside(widget, "[role=alert]")?.textContent).toMatch(/ended/i));

    // The list the new session is answered with is empty, because a fresh
    // Visitor is anonymous until their first write and has no Contact behind
    // them. What must not happen is the previous Visitor's conversation being
    // shown to this one out of the cache.
    api.use(http.get(`${baseUrl}/widget/tickets`, () => conversations()));

    await press(button(widget, ".nvw-send"));
    await settle();

    expect(mint).toBe(2);
    expect(store.get("widget")?.accessToken).toBe("nvw_1");
    // The invitation a Visitor with nothing behind them is shown.
    expect(inside(widget, ".nvw-greeting")?.textContent).toMatch(/help/i);
    expect(widget.host.root.textContent).not.toContain("Where is my order");
  });

  /**
   * The same rule, reached the other way. A session can lapse with the panel
   * closed — the renewal runs whether or not anybody is looking — and the
   * Visitor's next move is the Launcher rather than a notice. That press mints,
   * so it is a new Visitor by exactly the same argument, and it must not open
   * onto the last one's conversation out of the cache.
   */
  it("does not hand the last Visitor's conversation to the next one", async () => {
    api.use(mints(), refusesRenewal(), ...reading());

    const widget = await readingOne();
    await press(button(widget, ".nvw-close"));
    await renew(widget);

    expect(store.get("widget")).toBeUndefined();

    api.use(http.get(`${baseUrl}/widget/tickets`, () => conversations()));
    await press(button(widget, ".nvw-launcher"));
    await settle();

    expect(inside(widget, ".nvw-greeting")?.textContent).toMatch(/help/i);
    expect(widget.host.root.textContent).not.toContain("Where is my order");
  });
});
