/**
 * The Widget's own build.
 *
 * The Widget is one file on a stranger's page, and every byte of it is a cost
 * that Tenant pays for their visitors. So it is built here rather than by Next:
 * a single IIFE, no chunks, no runtime to load first, and React swapped for
 * Preact at the alias so the shared components in this repository compile
 * against both without knowing which one they got.
 *
 * The output lands in `public/widget/`, which is how the Next application comes
 * to serve it — the Snippet's `src` points at this application's origin, while
 * the *page* it runs on is the Tenant's. Only the page's origin is what the
 * allowlist judges, so serving the script from here costs nothing.
 */
import { resolve } from "node:path";

import { defineConfig } from "vite";

import { refuseNextShapedImports } from "./scripts/widget-build";

const src = resolve(import.meta.dirname, "src");

export default defineConfig({
  plugins: [refuseNextShapedImports()],

  // The output goes *into* `public/`, so Vite must not also treat `public/` as
  // static assets to copy — it would be copying the build into itself.
  publicDir: false,

  resolve: {
    alias: [
      // Order matters: the longer specifiers first, or `react-dom` swallows
      // `react-dom/client` and the entry loses its renderer.
      { find: /^react-dom\/client$/, replacement: "preact/compat/client" },
      { find: /^react-dom$/, replacement: "preact/compat" },
      { find: /^react\/jsx-runtime$/, replacement: "preact/jsx-runtime" },
      { find: /^react\/jsx-dev-runtime$/, replacement: "preact/jsx-dev-runtime" },
      { find: /^react$/, replacement: "preact/compat" },
      { find: "@", replacement: src },
    ],
  },

  esbuild: {
    jsx: "automatic",
    jsxImportSource: "preact",
  },

  define: {
    // The same one variable that points the Next application at an API points
    // this build at the same one. Inlined rather than read at runtime, because
    // there is no `process` on a Tenant's page — which does mean changing the
    // variable means rebuilding the Widget, and `docs/deployment.md` says so.
    //
    // Unset is inlined as the `undefined` token, not as a blank string, so
    // `resolveApiEndpoints` gives its own "NEXT_PUBLIC_API_URL is not set"
    // error rather than the different one it gives for an unparseable URL. A
    // build with no API is a real state here: it is what a Preview deployment
    // is, deliberately.
    "process.env.NEXT_PUBLIC_API_URL": process.env.NEXT_PUBLIC_API_URL
      ? JSON.stringify(process.env.NEXT_PUBLIC_API_URL)
      : "undefined",
    // `nivara-ai`'s own base URL, on the same discipline as the one above —
    // Next.js inlining `NEXT_PUBLIC_AI_URL` into the *application* bundle
    // never reaches this one, which Vite builds on its own. Left out here,
    // `getAiEndpoints()`'s `process.env.NEXT_PUBLIC_AI_URL` read is not
    // inlined at all, and there is no `process` global on a Tenant's page for
    // it to fall back to at runtime — a deployment with the Vercel variable
    // set correctly would still ship a Widget that can never see it (found
    // live: this is exactly what happened before this line existed).
    "process.env.NEXT_PUBLIC_AI_URL": process.env.NEXT_PUBLIC_AI_URL
      ? JSON.stringify(process.env.NEXT_PUBLIC_AI_URL)
      : "undefined",
    "process.env.NODE_ENV": JSON.stringify("production"),
  },

  build: {
    outDir: resolve(import.meta.dirname, "public/widget"),
    emptyOutDir: true,
    target: "es2020",
    // No source map shipped: it would double what the Tenant's visitors
    // download for a file they are not debugging.
    sourcemap: false,
    lib: {
      entry: resolve(src, "widget/entry.ts"),
      // An IIFE, not a module: one script tag has to work on a page that may
      // predate modules entirely, and there is nothing here to export.
      formats: ["iife"],
      name: "NivaraWidget",
      fileName: () => "widget.js",
    },
    rollupOptions: {
      // `"use client"` is a Next directive on modules this build shares with
      // the Next application. It means nothing here and is correctly dropped;
      // saying so on every build would train the reader to ignore warnings.
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
      output: {
        // The Widget's CSS is a string inside the bundle, so a stylesheet
        // emitted beside it would be a second request the Snippet never makes.
        assetFileNames: "widget.[ext]",
      },
    },
  },
});
