/**
 * What the Widget carries across a page load on a Tenant's site.
 *
 * The other Surfaces do not need this. A Contact or a User reloading the Portal
 * or the Dashboard is carried across by an httpOnly refresh cookie the API set
 * on a first-party origin, which the browser keeps and this application never
 * touches. A Visitor has no such cookie: their session is minted against an
 * origin allowlist, renewed by presenting the credential itself, and it lives
 * entirely in this page's memory — which a Visitor destroys the moment they
 * click a link on the Tenant's own site.
 *
 * So the credential is written down, and the honest consequence is stated
 * rather than glossed: it is written into storage belonging to the *host page*,
 * where that page's own scripts can read it. That is the same page the Widget
 * is running in, whose scripts could read the token out of memory anyway; the
 * Tenant already has every Ticket this credential can reach. What it must not
 * become is a credential that outlives the visit, so:
 *
 * - `sessionStorage`, not `localStorage` — it goes when the tab does, and the
 *   next person on a shared machine does not inherit somebody's conversation;
 * - the expiry is checked on the way back in, because a lapsed Widget session
 *   has no grace period and cannot be recovered;
 * - nothing read back out is trusted to be the shape it was written in.
 */
import type { Session } from "@/session/store";

import type { WidgetSession } from "./widget-session";

/** Namespaced, because this key is in a Tenant's storage rather than our own. */
export const WIDGET_MEMORY_KEY = "nivara.widget";

/** Where the Visitor was, so reopening the page is not starting again. */
export type WidgetPlace = {
  open: boolean;
  /** The conversation they were reading, if they were reading one. */
  ticketId?: string;
};

export type RememberedWidget = {
  /** Whose Widget this was. One site can carry two Tenants' Snippets. */
  tenantId: string;
  session: Session;
  place: WidgetPlace;
};

export type WidgetMemory = {
  /** What was kept for this Tenant, if it is still worth having. */
  recall(tenantId: string, now?: number): RememberedWidget | undefined;
  keep(remembered: RememberedWidget): void;
  forget(): void;
};

export function createWidgetMemory(storage: Storage | undefined = pageStorage()): WidgetMemory {
  return {
    recall(tenantId, now = Date.now()) {
      const remembered = read(storage);

      if (!remembered || remembered.tenantId !== tenantId) return undefined;

      if (remembered.session.expiresAt <= now) {
        // Cleared rather than left to rot. Nothing will ever make it good
        // again, and a Visitor who starts a fresh session would otherwise be
        // carrying a dead one alongside it.
        write(storage, undefined);
        return undefined;
      }

      return remembered;
    },

    keep(remembered) {
      write(storage, remembered);
    },

    forget() {
      write(storage, undefined);
    },
  };
}

/** What `resumeWidget` gives back: where the Visitor was, and how to record it. */
export type ResumedWidget = {
  place: WidgetPlace;
  /** Records where the Visitor is now. Ignored while there is no session. */
  moved(place: WidgetPlace): void;
  /** Stops writing through. Called when the Widget comes off the page. */
  stop(): void;
};

/**
 * Takes up whatever the last page left, and keeps writing it down.
 *
 * Write-through on every change to the session, not only on the mint: a session
 * renewed mid-visit replaces the credential, and a memory holding the one it
 * replaced would hand the next page a token the API has already retired.
 */
export function resumeWidget(
  tenantId: string,
  session: WidgetSession,
  memory: WidgetMemory = createWidgetMemory(),
): ResumedWidget {
  const remembered = memory.recall(tenantId);
  if (remembered) session.resume(remembered.session);

  let place: WidgetPlace = remembered?.place ?? { open: false };

  const record = () => {
    const held = session.current();
    // No session, nothing to come back to. This is also how a session that
    // ended — expired, or refused on renewal — takes the place down with it,
    // rather than leaving a Visitor to be reopened onto a conversation they can
    // no longer read.
    if (!held) return memory.forget();
    memory.keep({ tenantId, session: held, place });
  };

  record();
  const stop = session.subscribe(record);

  return {
    get place() {
      return place;
    },

    moved(moved) {
      place = moved;
      record();
    },

    stop,
  };
}

function pageStorage(): Storage | undefined {
  try {
    // The property access itself throws where a browser has storage switched
    // off, which is why this is not a truthiness check.
    return globalThis.sessionStorage ?? undefined;
  } catch {
    return undefined;
  }
}

function read(storage: Storage | undefined): RememberedWidget | undefined {
  try {
    const written = storage?.getItem(WIDGET_MEMORY_KEY);
    return written === null || written === undefined ? undefined : recognise(JSON.parse(written));
  } catch {
    // Unreadable or unparseable is nothing kept. It is not worth reporting on a
    // Tenant's console: there is no session either way, and the Widget's answer
    // is the same one it gives a Visitor who has never been here.
    return undefined;
  }
}

function write(storage: Storage | undefined, remembered: RememberedWidget | undefined): void {
  try {
    if (remembered) storage?.setItem(WIDGET_MEMORY_KEY, JSON.stringify(remembered));
    else storage?.removeItem(WIDGET_MEMORY_KEY);
  } catch {
    // A full or refused storage costs the Visitor a conversation that does not
    // survive their next click, and costs the Tenant's page nothing.
  }
}

/**
 * Whether what came back out is what went in.
 *
 * Checked rather than cast, because this storage is the host page's and their
 * scripts can write into it. A cast here is a token of type `undefined` sent as
 * a bearer credential, or a `ticketId` that is an object being put in a URL.
 */
function recognise(value: unknown): RememberedWidget | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const { tenantId, session, place } = value as Record<string, unknown>;

  if (typeof tenantId !== "string") return undefined;
  if (typeof session !== "object" || session === null) return undefined;
  if (typeof place !== "object" || place === null) return undefined;

  const { accessToken, expiresAt } = session as Record<string, unknown>;
  if (typeof accessToken !== "string" || typeof expiresAt !== "number") return undefined;

  const { open, ticketId } = place as Record<string, unknown>;
  if (typeof open !== "boolean") return undefined;
  if (ticketId !== undefined && typeof ticketId !== "string") return undefined;

  return { tenantId, session: { accessToken, expiresAt }, place: { open, ticketId } };
}
