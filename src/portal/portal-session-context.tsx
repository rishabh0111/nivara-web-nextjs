"use client";

import { createSessionContext } from "@/session/session-context";

import { createPortalSession, type PortalSession } from "./portal-session";

const context = createSessionContext<PortalSession>({
  surface: "Portal",
  create: createPortalSession,
});

/** Holds the one Portal session. Tests supply their own through `session`. */
export const PortalSessionProvider = context.Provider;
export const usePortalSession = context.useSession;
/** Whether the Portal currently holds a credential. */
export const usePortalSignedIn = context.useSignedIn;
