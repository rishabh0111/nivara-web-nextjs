import { act } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SessionStore } from "@/session/store";
import { message, ticket } from "@/tickets/tickets.fixtures";

import { bootWidget, type BootedWidget } from "./boot";
import {
  aiBaseUrl,
  baseUrl,
  conversations,
  disclosure,
  minted,
  snippet as makeSnippet,
  tenantId,
  turnAnswered,
  widgetSession,
} from "./widget.fixtures";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
let booted: BootedWidget | undefined;

/** Every path the Widget asked for, in order. The Surface's whole reach. */
let asked: string[];

beforeEach(() => {
  store = new SessionStore();
  asked = [];
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  sessionStorage.clear();

  server.events.removeAllListeners();
  server.events.on("request:start", ({ request }) => {
    const path = new URL(request.url).pathname;

    // The socket's own transport, which is not an API route and is not read as
    // one. What the Widget may reach on the wire is a Room the server gates,
    // and that is asserted on the wire in `widget-live.test.tsx`. Nothing here
    // drives a socket; a conversation being read opens one, and it is refused.
    if (path.startsWith("/socket.io/")) return;

    asked.push(`${request.method} ${path}`);
  });

  // Answered rather than left unhandled, so a suite run with
  // `onUnhandledRequest: "error"` does not report the one request these tests
  // deliberately do not serve.
  server.use(http.all(`${baseUrl}/socket.io/*`, () => new HttpResponse(null, { status: 503 })));

  // nivara-ai is a different origin every one of these tests now reaches the
  // moment a message sends. A benign default here, same as `mints()` is not a
  // per-test concern either — the handful of tests actually about what
  // nivara-ai said override it with their own `server.use`.
  server.use(
    // Both take an optional argument with a default (the Answer text, the
    // disclosure text) — called through an arrow rather than passed directly,
    // unlike `mints()`, so MSW's request-info object is never mistaken for it.
    http.post(`${aiBaseUrl}/widget/turns/stream`, () => turnAnswered()),
    http.get(`${aiBaseUrl}/widget/disclosure`, () => disclosure()),
  );
});

afterEach(() => {
  booted?.unmount();
  booted = undefined;
});

/**
 * The Widget as a Visitor meets it: a Snippet on a page, and a session that is
 * this browser's rather than this test's. The store is fresh per test; the
 * storage the Widget writes into is the one a real page would have.
 */
function boot() {
  const script = makeSnippet();
  document.head.append(script);

  let widget: BootedWidget;
  act(() => {
    widget = bootWidget({ script, session: widgetSession(store) });
  });

  booted = widget!;
  return booted;
}

/** Nothing the Widget renders is in the document, so nothing is queried there. */
function inside(widget: BootedWidget, selector: string) {
  return widget.host.root.querySelector(selector);
}

function all(widget: BootedWidget, selector: string) {
  return [...widget.host.root.querySelectorAll(selector)];
}

function button(widget: BootedWidget, selector: string): HTMLButtonElement {
  const found = inside(widget, selector);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`No ${selector} was rendered.`);
  return found;
}

/** The one control on a Tenant's page before anybody asks for support. */
const LAUNCHER = ".nvw-launcher";

/**
 * Lets everything the last act started finish — a read, the render it causes,
 * and the read that render asks for in turn. Two turns rather than one, because
 * a conversation restored from an id is exactly that chain.
 */
async function settle() {
  for (let turn = 0; turn < 2; turn += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function press(control: HTMLButtonElement) {
  await act(async () => {
    control.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Types into the composer and sends, the way a keyboard would. */
async function say(widget: BootedWidget, said: string) {
  const box = inside(widget, ".nvw-box");
  if (!(box instanceof HTMLTextAreaElement)) throw new Error("No composer was rendered.");

  await act(async () => {
    // The setter is called through the prototype so React's own value tracker
    // sees a change; assigning to `.value` directly is swallowed.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, said);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await press(button(widget, ".nvw-send"));
}

/** Opens the Launcher on a session that mints cleanly. */
async function open(widget: BootedWidget) {
  await press(button(widget, LAUNCHER));
  await settle();
}

function mints() {
  return http.post(`${baseUrl}/widget/sessions`, minted);
}

describe("a Visitor who has never asked for anything", () => {
  /**
   * The first thing every Visitor is ever shown is nothing, because a Visitor is
   * anonymous until their first write: the session has no Contact behind it and
   * the API creates none for a read. So an empty answer here is the ordinary
   * starting state and is rendered as an invitation, never as an empty-state
   * report and never as something having gone wrong.
   */
  it("is shown a box to type in rather than an empty list", async () => {
    server.use(
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
    );

    const widget = boot();
    await open(widget);

    expect(inside(widget, ".nvw-box")).not.toBeNull();
    expect(inside(widget, "[role=alert]")).toBeNull();
    expect(inside(widget, ".nvw-greeting")?.textContent).toMatch(/help/i);
  });

  /**
   * Opening the Ticket is the write that makes a Contact exist. Reading the
   * list before it does not, which is why the Widget is free to ask.
   */
  it("becomes a Contact by writing, and by nothing before it", async () => {
    server.use(
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
      http.post(`${baseUrl}/widget/tickets`, () => HttpResponse.json(ticket({ source: "widget" }))),
      http.post(`${baseUrl}/widget/tickets/tkt_1/messages`, () => HttpResponse.json(message())),
      http.get(`${baseUrl}/widget/tickets/tkt_1`, () =>
        HttpResponse.json(ticket({ source: "widget" })),
      ),
      http.get(`${baseUrl}/widget/tickets/tkt_1/messages`, () =>
        HttpResponse.json({ data: [message()], nextCursor: null }),
      ),
    );

    const widget = boot();
    await open(widget);

    expect(asked.filter((path) => path.startsWith("POST /widget/tickets"))).toHaveLength(0);

    await say(widget, "It is definitely on fire.");
    await settle();

    expect(asked).toContain("POST /widget/tickets");
    expect(asked).toContain("POST /widget/tickets/tkt_1/messages");
    // Landed on the conversation it opened, reading its own message back.
    expect(inside(widget, "[aria-label='Conversation']")?.textContent).toContain(
      "It is definitely on fire.",
    );
  });

  /**
   * A Visitor did not come to file a ticket; they came to ask a question. So
   * there is no subject field, and the subject staff will read is taken from
   * what the Visitor actually said.
   */
  it("is never asked to title their question", async () => {
    let opened: unknown;
    server.use(
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
      http.post(`${baseUrl}/widget/tickets`, async ({ request }) => {
        opened = await request.json();
        return HttpResponse.json(ticket({ source: "widget" }));
      }),
      http.post(`${baseUrl}/widget/tickets/tkt_1/messages`, () => HttpResponse.json(message())),
      http.get(`${baseUrl}/widget/tickets/tkt_1`, () => HttpResponse.json(ticket())),
      http.get(`${baseUrl}/widget/tickets/tkt_1/messages`, () =>
        HttpResponse.json({ data: [], nextCursor: null }),
      ),
    );

    const widget = boot();
    await open(widget);

    expect(all(widget, "input")).toHaveLength(0);

    await say(widget, "My order has not arrived");

    expect(opened).toEqual({ subject: "My order has not arrived" });
  });

  /**
   * Two writes, and the second can fail after the first has landed. Pressing
   * send again must send only the message: a Visitor with one question must
   * never end up with two conversations for it.
   */
  it("does not open a second conversation when only the message failed", async () => {
    let opens = 0;
    let attempts = 0;
    server.use(
      mints(),
      // Answers with the half-opened Ticket once it exists, as the API would.
      // The box the Visitor is typing in is shown *because* this list is empty,
      // so a client that re-asked it between the two writes would replace that
      // box with a list — and take their text and the retry with it.
      http.get(`${baseUrl}/widget/tickets`, () =>
        opens === 0 ? conversations() : conversations(ticket({ source: "widget" })),
      ),
      http.post(`${baseUrl}/widget/tickets`, () => {
        opens += 1;
        return HttpResponse.json(ticket({ source: "widget" }));
      }),
      http.post(`${baseUrl}/widget/tickets/tkt_1/messages`, () => {
        attempts += 1;
        return attempts === 1 ? HttpResponse.error() : HttpResponse.json(message());
      }),
      http.get(`${baseUrl}/widget/tickets/tkt_1`, () => HttpResponse.json(ticket())),
      http.get(`${baseUrl}/widget/tickets/tkt_1/messages`, () =>
        HttpResponse.json({ data: [message()], nextCursor: null }),
      ),
    );

    const widget = boot();
    await open(widget);
    await say(widget, "It is definitely on fire.");
    // Everything the half-opened Ticket set off is allowed to land before the
    // box is looked at, because the thing being asserted is that none of it
    // took the box away.
    await settle();

    expect(inside(widget, ".nvw-problem")?.textContent).toMatch(/could not be sent/i);
    // The text is still in the box, because nothing was said.
    expect(inside(widget, ".nvw-box")).toHaveProperty("value", "It is definitely on fire.");

    await press(button(widget, ".nvw-send"));
    await settle();

    expect(opens).toBe(1);
    expect(attempts).toBe(2);
  });
});

describe("a Visitor who has been here before", () => {
  const earlier = ticket({ id: "tkt_1", subject: "Where is my order", source: "widget" });
  const other = ticket({ id: "tkt_2", subject: "Wrong size", source: "widget" });

  function reading() {
    return [
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations(earlier, other)),
      http.get(`${baseUrl}/widget/tickets/tkt_1`, () => HttpResponse.json(earlier)),
      http.get(`${baseUrl}/widget/tickets/tkt_1/messages`, () =>
        HttpResponse.json({
          data: [
            message({ id: "msg_2", authorKind: "user", body: "It ships tomorrow." }),
            message({ id: "msg_1", authorKind: "contact", body: "Where is my order?" }),
          ],
          nextCursor: null,
        }),
      ),
    ];
  }

  it("sees the conversations they have already had", async () => {
    server.use(...reading());

    const widget = boot();
    await open(widget);

    const rows = all(widget, ".nvw-row").map((row) => row.textContent);
    expect(rows[0]).toContain("Where is my order");
    expect(rows[1]).toContain("Wrong size");
  });

  /**
   * Newest last on screen, oldest first, whatever order the wire used. The
   * thread is asked for newest-first so a long conversation opens at its end
   * rather than at its beginning, and reversing the whole of what arrived is
   * what puts it back into reading order.
   */
  it("reads one of them, downwards", async () => {
    server.use(...reading());

    const widget = boot();
    await open(widget);
    await press(button(widget, ".nvw-row"));
    await settle();

    const said = all(widget, "[aria-label='Conversation'] li").map((row) => row.textContent);
    expect(said[0]).toContain("Where is my order?");
    expect(said[1]).toContain("It ships tomorrow.");
    expect(said[1]).toContain("Support");
  });

  it("replies to one of them", async () => {
    let replied: unknown;
    server.use(
      ...reading(),
      http.post(`${baseUrl}/widget/tickets/tkt_1/messages`, async ({ request }) => {
        replied = await request.json();
        return HttpResponse.json(message({ id: "msg_3", ticketId: "tkt_1" }));
      }),
    );

    const widget = boot();
    await open(widget);
    await press(button(widget, ".nvw-row"));
    await settle();
    await say(widget, "Still nothing.");

    expect(replied).toEqual({ body: "Still nothing." });
    expect(inside(widget, "[aria-label='What happened to your message']")?.textContent).toMatch(
      /sent/i,
    );
  });

  /**
   * A `closed` conversation is terminal and is not revived — the reply opens a
   * new linked one and becomes its first Message. The Widget follows the answer
   * rather than the conversation it addressed, because a Visitor left reading
   * the old one would be looking at a thread their message is not in.
   */
  it("is taken to the new conversation when a closed one could not be revived", async () => {
    const continued = ticket({ id: "tkt_9", subject: "Where is my order", state: "open" });
    server.use(
      ...reading(),
      http.post(`${baseUrl}/widget/tickets/tkt_1/messages`, () =>
        HttpResponse.json(message({ id: "msg_3", ticketId: "tkt_9" })),
      ),
      http.get(`${baseUrl}/widget/tickets/tkt_9`, () => HttpResponse.json(continued)),
      http.get(`${baseUrl}/widget/tickets/tkt_9/messages`, () =>
        HttpResponse.json({
          data: [message({ id: "msg_3", ticketId: "tkt_9", body: "It arrived broken." })],
          nextCursor: null,
        }),
      ),
    );

    const widget = boot();
    await open(widget);
    await press(button(widget, ".nvw-row"));
    await settle();
    await say(widget, "It arrived broken.");
    await settle();

    expect(inside(widget, "[aria-label='What happened to your message']")?.textContent).toMatch(
      /new conversation/i,
    );
    expect(inside(widget, "[aria-label='Conversation']")?.textContent).toContain(
      "It arrived broken.",
    );
  });

  /**
   * The conversation is read by id, and that read can fail on its own. Saying
   * so where the state would have been beats letting the Visitor type a
   * paragraph into a box that was never going to send it.
   */
  it("is told when a conversation could not be loaded, before they type into it", async () => {
    server.use(...reading());
    // Its own call, so it is prepended and wins: within one call the first
    // matching handler answers, and `reading()` already names this route.
    server.use(http.get(`${baseUrl}/widget/tickets/tkt_1`, () => HttpResponse.error()));

    const widget = boot();
    await open(widget);
    await press(button(widget, ".nvw-row"));
    await settle();

    expect(inside(widget, "[role=alert]")?.textContent).toMatch(/could not|reach/i);
  });

  it("closes and reopens with the conversation still in front of them", async () => {
    server.use(...reading());

    const widget = boot();
    await open(widget);
    await press(button(widget, ".nvw-row"));
    await settle();

    await press(button(widget, ".nvw-close"));
    expect(inside(widget, LAUNCHER)).not.toBeNull();

    await press(button(widget, LAUNCHER));
    await settle();

    expect(inside(widget, "[aria-label='Conversation']")?.textContent).toContain(
      "Where is my order?",
    );
  });
});

describe("a Visitor who clicks a link on the Tenant's own site", () => {
  const earlier = ticket({ id: "tkt_1", subject: "Where is my order", source: "widget" });

  function reading() {
    return [
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations(earlier)),
      http.get(`${baseUrl}/widget/tickets/tkt_1`, () => HttpResponse.json(earlier)),
      http.get(`${baseUrl}/widget/tickets/tkt_1/messages`, () =>
        HttpResponse.json({ data: [message({ body: "Where is my order?" })], nextCursor: null }),
      ),
    ];
  }

  /**
   * The whole page is destroyed and rebuilt, which is what a navigation on a
   * Tenant's site is. A Visitor has no refresh cookie to carry them across —
   * that is a first-party mechanism and this is somebody else's origin — so the
   * session is written down and taken back up, or the conversation ends every
   * time they click anything.
   */
  it("comes back to the same session and the same conversation", async () => {
    server.use(...reading());

    const first = boot();
    await open(first);
    await press(button(first, ".nvw-row"));
    await settle();

    // The page goes. Everything in memory goes with it — including the store,
    // which is why the second boot gets a new one.
    first.unmount();
    booted = undefined;
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    store = new SessionStore();
    asked = [];

    const next = boot();
    await settle();

    expect(asked).not.toContain("POST /widget/sessions");
    expect(store.get("widget")?.accessToken).toBe("nvw_1");
    expect(inside(next, "[aria-label='Conversation']")?.textContent).toContain(
      "Where is my order?",
    );
  });

  /**
   * Restored, not raised. Focus is moved into the panel when the Visitor opens
   * it, and never when it merely came back open — a Widget that took focus on
   * every page load would be pulling a stranger's visitor out of a stranger's
   * page over and over.
   */
  it("is not dragged out of the page it just navigated to", async () => {
    server.use(...reading());

    const first = boot();
    await open(first);
    first.unmount();
    booted = undefined;
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    store = new SessionStore();

    const next = boot();
    await settle();

    expect(inside(next, "[role=dialog]")).not.toBeNull();
    expect(next.host.root.activeElement).toBeNull();
  });

  /**
   * A Widget session has no grace period and a lapsed one cannot be recovered.
   * Presenting a credential the expiry already condemned would cost a request
   * to be told what was known before it was sent.
   */
  it("starts again where the session lapsed while they were away", async () => {
    server.use(...reading());

    const first = boot();
    await open(first);
    first.unmount();
    booted = undefined;
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    store = new SessionStore();

    const remembered = JSON.parse(sessionStorage.getItem("nivara.widget")!);
    sessionStorage.setItem(
      "nivara.widget",
      JSON.stringify({
        ...remembered,
        session: { ...remembered.session, expiresAt: Date.now() - 1 },
      }),
    );

    const next = boot();
    await settle();

    expect(store.get("widget")).toBeUndefined();
    expect(inside(next, LAUNCHER)).not.toBeNull();
  });
});

describe("what the Widget can and cannot do", () => {
  /**
   * Not a rule the interface enforces — a rule the Surface cannot break. There
   * is no staff route under `/widget`, so a Ticket's state, priority, assignee
   * and internal notes are not things this bundle can name, let alone reach.
   * Everything raised through these routes carries Source `widget`, stamped by
   * the API from the credential rather than claimed by the request.
   */
  it("never asks for anything outside its own Surface", async () => {
    server.use(
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
      http.post(`${baseUrl}/widget/tickets`, () => HttpResponse.json(ticket({ source: "widget" }))),
      http.post(`${baseUrl}/widget/tickets/tkt_1/messages`, () => HttpResponse.json(message())),
      http.get(`${baseUrl}/widget/tickets/tkt_1`, () => HttpResponse.json(ticket())),
      http.get(`${baseUrl}/widget/tickets/tkt_1/messages`, () =>
        HttpResponse.json({ data: [message()], nextCursor: null }),
      ),
    );

    const widget = boot();
    await open(widget);
    await say(widget, "It is definitely on fire.");
    await settle();

    expect(asked.length).toBeGreaterThan(0);
    for (const path of asked) expect(path).toMatch(/^[A-Z]+ \/widget\//);
    for (const path of asked) expect(path).not.toMatch(/\/(state|priority|assignee|notes|audit)$/);
  });
});

describe("a Visitor working the Widget from the keyboard", () => {
  it("is put inside the panel when they open it, and back on the Launcher when they close it", async () => {
    server.use(
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
    );

    const widget = boot();
    await open(widget);

    expect(widget.host.root.activeElement).toBe(inside(widget, "[role=dialog]"));

    await press(button(widget, ".nvw-close"));

    expect(widget.host.root.activeElement).toBe(inside(widget, LAUNCHER));
  });

  it("closes the panel with Escape without the host page hearing it", async () => {
    server.use(
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
    );

    let heard = 0;
    document.addEventListener("keydown", () => {
      heard += 1;
    });

    const widget = boot();
    await open(widget);

    await act(async () => {
      inside(widget, "[role=dialog]")!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
      );
    });

    expect(inside(widget, LAUNCHER)).not.toBeNull();
    expect(heard).toBe(0);
  });

  /**
   * The panel is not modal. It is a box on somebody else's page, and that page
   * stays theirs to use — telling a screen reader otherwise would claim the
   * rest of the site had gone away.
   */
  it("does not claim the Tenant's page has gone away", async () => {
    server.use(
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
    );

    const widget = boot();
    await open(widget);

    const panel = inside(widget, "[role=dialog]")!;
    expect(panel.getAttribute("aria-modal")).toBe("false");
    expect(panel.getAttribute("aria-label")).toBe("Support");
  });
});

describe("the Widget on a page that will not have it", () => {
  /**
   * Storage is not guaranteed on somebody else's site. Where it is refused the
   * Widget still works and simply does not survive a navigation — a degraded
   * Widget rather than no Widget, and never an error on a Tenant's console.
   */
  it("works where the host page's storage is refused", async () => {
    server.use(
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
    );

    const widget = boot();
    // Not injected: this is the module-level default reaching for a storage the
    // browser will not give it, which is the shape of the real failure.
    sessionStorage.clear();

    await open(widget);

    expect(inside(widget, ".nvw-box")).not.toBeNull();
    expect(store.get("widget")?.accessToken).toBe("nvw_1");
  });

  it("keeps two Tenants' Snippets apart", async () => {
    server.use(
      mints(),
      http.get(`${baseUrl}/widget/tickets`, () => conversations()),
    );

    const widget = boot();
    await open(widget);
    widget.unmount();
    booted = undefined;
    document.body.innerHTML = "";
    document.head.innerHTML = "";

    const remembered = JSON.parse(sessionStorage.getItem("nivara.widget")!);
    expect(remembered.tenantId).toBe(tenantId);

    sessionStorage.setItem("nivara.widget", JSON.stringify({ ...remembered, tenantId: "ten_2" }));
    store = new SessionStore();

    const next = boot();
    await settle();

    expect(store.get("widget")).toBeUndefined();
    expect(inside(next, LAUNCHER)).not.toBeNull();
  });
});
