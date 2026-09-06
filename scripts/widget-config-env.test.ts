import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Reads `vite.widget.config.ts` as text rather than importing it — importing
 * it pulls in Vite's own esbuild-backed tooling, which does not run inside
 * this suite's default jsdom environment (the same reason
 * `demo-host.test.ts` reads its target file rather than executing it).
 */
const configSource = readFileSync(
  resolve(import.meta.dirname, "../vite.widget.config.ts"),
  "utf8",
);

describe("what the Widget build inlines from the environment", () => {
  /**
   * Vite's `define` only ever text-replaces exactly what is listed here — a
   * `NEXT_PUBLIC_` variable the Next application reads but this file never
   * lists is not inlined at all, and there is no `process` global on a
   * Tenant's page for it to fall back to at runtime.
   *
   * Found live: a Vercel deployment had `NEXT_PUBLIC_AI_URL` set (both
   * Production and Preview) and rebuilt from a fresh commit, and the
   * deployed Widget bundle still carried no trace of it — only
   * `NEXT_PUBLIC_API_URL` was ever wired into this config when the AI seam
   * (`src/config/ai.ts`) was built, so `getAiEndpoints()`'s
   * `process.env.NEXT_PUBLIC_AI_URL` read was never inlined at all.
   */
  it("wires NEXT_PUBLIC_AI_URL into define, the same way NEXT_PUBLIC_API_URL already is", () => {
    expect(configSource).toMatch(/"process\.env\.NEXT_PUBLIC_API_URL":/);
    expect(configSource).toMatch(/"process\.env\.NEXT_PUBLIC_AI_URL":/);
  });
});
