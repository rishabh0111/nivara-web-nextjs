import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

/**
 * The live path, and only it. Separate from `vitest.config.ts` because these
 * two runs answer different questions: the fast suite asks whether this
 * application is right, and this one asks whether the environment it is
 * deployed into lets it be. One deserves to run on every save; the other talks
 * to a server on the internet and waits on a Cold start.
 *
 * `node`, not `jsdom`: what is under test here is the real network, and a
 * simulated browser in front of a real socket would only add a fiction to it.
 * The browser's own rules — origin, preflight, cookies — are applied
 * deliberately, in `e2e/browser-rules`, where they can be read.
 */
export default defineConfig({
  // The same two prefixes the application's own variables carry, so a developer
  // keeps their credentials in `.env.local` beside `NEXT_PUBLIC_API_URL` rather
  // than exporting them by hand every run.
  envPrefix: ["NEXT_PUBLIC_", "NIVARA_E2E_"],
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["e2e/**/*.e2e.ts"],
    // A sleeping free instance takes tens of seconds to answer its first
    // request. A tighter timeout would report the one condition this suite
    // exists to survive as the one failure it exists to catch.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // One path, in order, against one deployed API. Nothing here is parallel.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
