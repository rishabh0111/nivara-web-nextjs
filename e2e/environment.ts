/**
 * What the live path needs, and what it refuses to run without.
 *
 * Credentials are read from the environment rather than committed: the
 * deployment this runs against is a real one on the public internet, and a
 * password in the repository is a password on the internet. Absent, the suite
 * skips and says which variable was missing — a developer without credentials
 * gets a sentence, not a red run they have to go and interpret.
 *
 * The Tenant is the other half of that. This path writes — it replies to a
 * Ticket — and the showcase Tenant is curated to be read, so the isolation
 * Tenant is the only place it belongs. Naming the showcase Tenant here is
 * refused outright rather than trusted to whoever set the variable.
 */
import { resolveApiEndpoints, type ApiEndpoints } from "@/config/api";

/**
 * The showcase Tenant, from the API's seed anchors, which are stable across
 * reseeds and quoted there for exactly this kind of use.
 */
export const SHOWCASE_TENANT_ID = "5eed0000-0000-4000-8000-000000000001";

/**
 * A Cold start is tens of seconds on a free instance that has gone to sleep.
 * Generous on purpose: the failure this suite is worth having would be hidden
 * by a timeout that fired before the API had finished waking up.
 */
const DEFAULT_COLD_START_BUDGET_MS = 120_000;

/** The origin a developer runs this application on, and a stable one to allowlist. */
const DEFAULT_ORIGIN = "http://localhost:3000";

export type LiveEnvironment = {
  endpoints: ApiEndpoints;
  /** The origin the API is asked to allow — what a page would be served from. */
  origin: string;
  credentials: { tenantId: string; email: string; password: string };
  coldStartBudgetMs: number;
};

export type EnvironmentReading =
  | { ready: true; environment: LiveEnvironment }
  | { ready: false; reason: string };

type Environment = Record<string, string | undefined>;

export function readLiveEnvironment(env: Environment = process.env): EnvironmentReading {
  const missing = [
    "NEXT_PUBLIC_API_URL",
    "NIVARA_E2E_TENANT_ID",
    "NIVARA_E2E_EMAIL",
    "NIVARA_E2E_PASSWORD",
  ].filter((name) => !env[name]?.trim());

  if (missing.length > 0) {
    return {
      ready: false,
      reason: `not configured: ${missing.join(", ")}. See e2e/README.md — this path runs against a deployed API with real credentials, so it is opt-in.`,
    };
  }

  const tenantId = env.NIVARA_E2E_TENANT_ID!.trim();

  if (tenantId === SHOWCASE_TENANT_ID) {
    return {
      ready: false,
      reason:
        "NIVARA_E2E_TENANT_ID names the showcase Tenant, which is curated to be read. This path writes; point it at the isolation Tenant.",
    };
  }

  const budget = Number(env.NIVARA_E2E_COLD_START_MS ?? DEFAULT_COLD_START_BUDGET_MS);

  return {
    ready: true,
    environment: {
      endpoints: resolveApiEndpoints(env.NEXT_PUBLIC_API_URL),
      origin: env.NIVARA_E2E_ORIGIN?.trim() || DEFAULT_ORIGIN,
      credentials: {
        tenantId,
        email: env.NIVARA_E2E_EMAIL!.trim(),
        password: env.NIVARA_E2E_PASSWORD!,
      },
      coldStartBudgetMs: Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_COLD_START_BUDGET_MS,
    },
  };
}
