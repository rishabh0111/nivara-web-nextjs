"use client";

import { useQuery } from "@tanstack/react-query";

import { unwrap } from "@/api/query";

import { dashboardKeys } from "./dashboard-keys";
import { useDashboardSession } from "./dashboard-session-context";
import { readStaffPrincipal, type StaffPrincipal } from "./staff-principal";

/**
 * Who is signed in, once the API has said.
 *
 * Undefined covers both "not answered yet" and "could not be read", because
 * almost every caller does the same thing with either: it offers nothing that
 * depends on holding a permission. The queue does not wait on this — work is not
 * withheld because a name has not arrived.
 */
export function useStaffPrincipal(): StaffPrincipal | undefined {
  return useStaffPrincipalRead().principal;
}

/**
 * The same read, with why the principal is missing.
 *
 * For the one caller that cannot treat "not yet" as "not permitted": a whole
 * screen gated on a permission would otherwise tell an admin they may not read
 * it, and take the words back a moment later when the answer arrived.
 */
export function useStaffPrincipalRead(): {
  principal: StaffPrincipal | undefined;
  isPending: boolean;
  error: unknown;
} {
  const session = useDashboardSession();

  const query = useQuery({
    queryKey: dashboardKeys.principal,
    queryFn: async () => unwrap(await readStaffPrincipal(session)),
  });

  return { principal: query.data, isPending: query.isPending, error: query.error };
}
