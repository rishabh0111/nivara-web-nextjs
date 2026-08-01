import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    // `e2e/**/*.test.ts` and not `e2e/**/*.e2e.ts`: the browser rules the live
    // path is judged by are ordinary units and belong in the fast suite, while
    // the one live path is a separate run against a deployed API.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "e2e/**/*.test.ts"],
    // Pinned, and deliberately not UTC. A calendar day the reader picks becomes
    // an instant on the wire, and a suite run in UTC would agree with a
    // conversion that ignored the offset entirely. The half-hour offset catches
    // the sloppier version of that too.
    env: { TZ: "Asia/Kolkata" },
  },
});
