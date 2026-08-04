"use client";

import { createSessionContext } from "@/session/session-context";

import { createDashboardSession, type DashboardSession } from "./dashboard-session";

const context = createSessionContext<DashboardSession>({
  surface: "Dashboard",
  create: createDashboardSession,
});

/** Holds the one Dashboard session. Tests supply their own through `session`. */
export const DashboardSessionProvider = context.Provider;
export const useDashboardSession = context.useSession;
/** Whether the Dashboard currently holds a credential. */
export const useDashboardSignedIn = context.useSignedIn;
