/**
 * Who is holding this credential, and what that lets them reach.
 *
 * The answer comes from `GET /auth/me` rather than from anything the sign-in
 * form typed: the principal is resolved from the presented credential alone, and
 * a client that decided for itself what role it had would be describing a
 * permission the server never granted. Gating here is so the interface tells the
 * truth about what is available — the API refuses regardless.
 */
import type { ApiResult } from "@/api/client";
import type { components } from "@/api/generated/openapi";
import type { SessionClient } from "@/session/session-client";

export type StaffPrincipal = components["schemas"]["PrincipalDto"];
export type StaffRole = StaffPrincipal["role"];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = { agent: "Agent", admin: "Admin" };

/**
 * Whether this principal reads the analytics report.
 *
 * The API gates that endpoint on the `analytics:read` scope, and a User
 * principal carries no scopes — the document publishes a scope list for service
 * tokens only, so the role is the whole of what a client can read this from.
 * Admin is the role that holds it. Named for the permission rather than for the
 * role, because the permission is the thing being asked about: the day a scope
 * appears on `PrincipalDto`, this reads it and no call site changes.
 *
 * The queue is deliberately not gated at all: both roles work the same Tickets,
 * and an interface that narrowed an agent's queue would make the team's work
 * look smaller than it is.
 *
 * Unknown does not hold it. While the principal is still in flight, or its read
 * has failed, an admin-only affordance would be put in front of an agent and
 * then taken away again.
 */
export function canReadAnalytics(principal: StaffPrincipal | undefined): boolean {
  return principal?.role === "admin";
}

export function readStaffPrincipal(session: SessionClient): Promise<ApiResult<StaffPrincipal>> {
  return session.resource("/auth/me", "get", {});
}
