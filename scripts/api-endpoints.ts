import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { resolveApiEndpoints, type ApiEndpoints } from "../src/config/api";

const repoRoot = resolve(import.meta.dirname, "..");

/**
 * Next.js loads `.env` and `.env.local` for us; scripts run outside it, so they
 * load the same files in the same precedence order rather than inventing their
 * own configuration.
 */
export function loadApiEndpoints(): ApiEndpoints {
  for (const file of [".env", ".env.local"]) {
    const path = resolve(repoRoot, file);
    if (existsSync(path)) {
      process.loadEnvFile(path);
    }
  }

  return resolveApiEndpoints(process.env.NEXT_PUBLIC_API_URL);
}

export const generatedTypesPath = resolve(repoRoot, "src/api/generated/openapi.ts");
