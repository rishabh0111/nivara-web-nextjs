import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionStore } from "@/session/store";

import { createWidgetMemory, resumeWidget, WIDGET_MEMORY_KEY } from "./widget-memory";
import { tenantId, widgetSession } from "./widget.fixtures";

/** Pinned rather than read off the clock, so two calls describe one session. */
const STILL_GOOD = Date.now() + 1_800_000;

function held(expiresAt = STILL_GOOD) {
  return { accessToken: "nvw_1", expiresAt };
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("what the Widget remembers between page loads", () => {
  it("hands back the session and the place it was kept with", () => {
    const memory = createWidgetMemory();
    memory.keep({ tenantId, session: held(), place: { open: true, ticketId: "tkt_1" } });

    expect(createWidgetMemory().recall(tenantId)).toEqual({
      tenantId,
      session: held(),
      place: { open: true, ticketId: "tkt_1" },
    });
  });

  /**
   * There is no grace period on a Widget session and a lapsed one cannot be
   * recovered, so a credential whose thirty minutes ran out while the Visitor
   * was on another page is not worth carrying forward — presenting it would
   * cost a request to be told what the expiry already said.
   */
  it("forgets a session whose thirty minutes have passed", () => {
    const memory = createWidgetMemory();
    memory.keep({ tenantId, session: held(Date.now() - 1), place: { open: true } });

    expect(memory.recall(tenantId)).toBeUndefined();
    expect(sessionStorage.getItem(WIDGET_MEMORY_KEY)).toBeNull();
  });

  /**
   * One site can carry two Tenants' Snippets — an agency's own support Widget
   * beside the one they installed for a client — and a session minted for one
   * is not a session on the other.
   */
  it("ignores what was kept for another Tenant", () => {
    const memory = createWidgetMemory();
    memory.keep({ tenantId: "ten_2", session: held(), place: { open: true } });

    expect(memory.recall(tenantId)).toBeUndefined();
  });

  /**
   * This storage belongs to the Tenant's page, not to us: their own scripts can
   * write anything into it, and a Widget that trusted the shape would read
   * `undefined` into a credential and send it. Anything unrecognisable is
   * treated as nothing kept.
   */
  it("treats what it cannot recognise as nothing kept", () => {
    for (const written of ["not json", "null", '{"tenantId":"ten_1"}', '{"session":{}}']) {
      sessionStorage.setItem(WIDGET_MEMORY_KEY, written);
      expect(createWidgetMemory().recall(tenantId)).toBeUndefined();
    }
  });

  it("forgets everything when told to", () => {
    const memory = createWidgetMemory();
    memory.keep({ tenantId, session: held(), place: { open: true } });
    memory.forget();

    expect(memory.recall(tenantId)).toBeUndefined();
  });

  /**
   * Storage is not guaranteed on somebody else's page — a browser with it
   * switched off throws on the property itself, before anything is read. The
   * Widget works there and simply does not survive a navigation, which is a
   * degraded Widget rather than no Widget.
   */
  it("works on a page where storage is refused", () => {
    const refused = {
      get length(): number {
        throw new Error("The user denied access to storage.");
      },
    } as unknown as Storage;
    Object.defineProperties(refused, {
      getItem: {
        value: () => {
          throw new Error("denied");
        },
      },
      setItem: {
        value: () => {
          throw new Error("denied");
        },
      },
      removeItem: {
        value: () => {
          throw new Error("denied");
        },
      },
    });

    const memory = createWidgetMemory(refused);

    expect(() => memory.keep({ tenantId, session: held(), place: { open: true } })).not.toThrow();
    expect(memory.recall(tenantId)).toBeUndefined();
    expect(() => memory.forget()).not.toThrow();
  });
});

describe("taking the session back up on the next page", () => {
  it("resumes a credential that is still good, without minting another", () => {
    const store = new SessionStore();
    const memory = createWidgetMemory();
    memory.keep({ tenantId, session: held(), place: { open: true, ticketId: "tkt_1" } });

    const resumed = resumeWidget(tenantId, widgetSession(store), memory);

    expect(store.get("widget")?.accessToken).toBe("nvw_1");
    expect(resumed.place).toEqual({ open: true, ticketId: "tkt_1" });
  });

  it("starts closed and anonymous where there is nothing to take up", () => {
    const store = new SessionStore();
    const resumed = resumeWidget(tenantId, widgetSession(store), createWidgetMemory());

    expect(store.get("widget")).toBeUndefined();
    expect(resumed.place).toEqual({ open: false });
  });

  /**
   * Written through on every change rather than only at the mint, because a
   * session renewed mid-visit replaces the credential — and remembering the one
   * it replaced would carry a dead token onto the next page and end the
   * conversation there.
   */
  it("writes the credential through as it changes", () => {
    const store = new SessionStore();
    const session = widgetSession(store);
    const memory = createWidgetMemory();
    resumeWidget(tenantId, session, memory);

    session.adopt({ token: "nvw_1", expiresInSeconds: 1800 });
    expect(memory.recall(tenantId)?.session.accessToken).toBe("nvw_1");

    session.adopt({ token: "nvw_2", expiresInSeconds: 1800 });
    expect(memory.recall(tenantId)?.session.accessToken).toBe("nvw_2");
  });

  it("forgets the place along with the session that ended", () => {
    const store = new SessionStore();
    const session = widgetSession(store);
    const memory = createWidgetMemory();
    const resumed = resumeWidget(tenantId, session, memory);

    session.adopt({ token: "nvw_1", expiresInSeconds: 1800 });
    resumed.moved({ open: true, ticketId: "tkt_1" });
    session.end();

    expect(memory.recall(tenantId)).toBeUndefined();
  });

  it("keeps where the Visitor is, so the next page opens where they left", () => {
    const store = new SessionStore();
    const session = widgetSession(store);
    const memory = createWidgetMemory();
    const resumed = resumeWidget(tenantId, session, memory);

    session.adopt({ token: "nvw_1", expiresInSeconds: 1800 });
    resumed.moved({ open: true, ticketId: "tkt_1" });

    expect(memory.recall(tenantId)?.place).toEqual({ open: true, ticketId: "tkt_1" });
  });

  /** A place with no session behind it is nothing to return to. */
  it("writes no place while the Visitor is still anonymous", () => {
    const store = new SessionStore();
    const memory = createWidgetMemory();
    const resumed = resumeWidget(tenantId, widgetSession(store), memory);

    resumed.moved({ open: true });

    expect(memory.recall(tenantId)).toBeUndefined();
  });

  it("stops writing through once the Widget is off the page", () => {
    const store = new SessionStore();
    const session = widgetSession(store);
    const memory = createWidgetMemory();
    const kept = vi.spyOn(memory, "keep");

    resumeWidget(tenantId, session, memory).stop();
    session.adopt({ token: "nvw_1", expiresInSeconds: 1800 });

    expect(kept).not.toHaveBeenCalled();
  });
});
