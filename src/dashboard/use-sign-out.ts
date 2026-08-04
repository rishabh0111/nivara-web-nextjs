"use client";

import { useQueryClient } from "@tanstack/react-query";

import { dashboardKeys } from "./dashboard-keys";
import { useDashboardSession } from "./dashboard-session-context";

/**
 * Signing out, all the way.
 *
 * Ending the session is not enough on its own: everything in the cache was read
 * with the credential just given up, and it would otherwise be painted to
 * whoever signs in next on this machine — their colleague's queue and their
 * colleague's name, for as long as a refetch takes. So the reads go when the
 * credential does.
 */
export function useSignOut(): () => Promise<void> {
  const session = useDashboardSession();
  const cache = useQueryClient();

  return async () => {
    await session.signOut();
    cache.removeQueries({ queryKey: dashboardKeys.surface });
  };
}
