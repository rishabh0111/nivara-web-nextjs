import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The demo host pages are the only place the Widget is judged the way a Tenant
 * judges it, and nothing builds, imports or type-checks them. Every instruction
 * they carry is prose, and prose is what the reset rule was protected by until
 * a test pinned it.
 *
 * There are two pages now, and the pair is the demonstration: the same origin,
 * the same script, one attribute apart. One answers because the Corpus is
 * indexed under its Tenant; the other cannot answer anything. Neither is
 * exercised by the suite that boots the Widget against a fake wire — that
 * suite supplies its own Snippet.
 */
const read = (...parts: string[]) =>
  readFileSync(resolve(import.meta.dirname, "../../demo-host", ...parts), "utf8");

const SHOWCASE_TENANT_ID = "5eed0000-0000-4000-8000-000000000001";
const ISOLATION_TENANT_ID = "5eed0000-0000-4000-8000-000000000002";

/** Where the Widget bundle is served from. The application's own origin. */
const PRODUCTION_ORIGIN = "https://nivara-web-nextjs.vercel.app";

const PAGES = [
  { name: "the answering page", file: ["index.html"], tenantId: SHOWCASE_TENANT_ID },
  { name: "the isolation page", file: ["isolation", "index.html"], tenantId: ISOLATION_TENANT_ID },
] as const;

function snippet(page: string) {
  const tag = page.match(/<script\b[^>]*\bdata-tenant-id\b[^>]*>/)?.[0];

  if (tag === undefined) throw new Error("the page carries no Snippet");

  const attribute = (name: string) => {
    const value = tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

    // Named here rather than left to whatever the caller does with `undefined`.
    // A Snippet missing one of its two attributes is the failure this file
    // exists to report, and `new URL(undefined)` reports it as "Invalid URL".
    if (value === undefined) throw new Error(`the Snippet has no ${name}`);

    return value;
  };

  return { src: attribute("src"), tenantId: attribute("data-tenant-id") };
}

describe.each(PAGES)("the Snippet on $name", ({ file, tenantId }) => {
  const page = read(...file);

  /**
   * An unset value here is not harmless: the page would deploy, the Launcher
   * would appear, and the gate it exists to demonstrate would answer
   * `forbidden` for the wrong reason.
   */
  it("names the Tenant this page is for", () => {
    expect(snippet(page).tenantId).toBe(tenantId);
  });

  /**
   * The path the build writes the bundle to. The origin in front of it is the
   * next test's business; this one only pins that the Snippet is still pointed
   * at `widget:build`'s output and not at some hand-copied file.
   */
  it("asks for the path the Widget build writes", () => {
    expect(snippet(page).src).toMatch(/\/widget\/widget\.js$/);
  });

  /**
   * The deployed application's own origin, pinned exactly.
   *
   * A host that resolves but is not ours is the failure worth guarding against:
   * `nivara-web.vercel.app` is a live application belonging to somebody else,
   * and a demo host carrying it would have asked a stranger's origin for a
   * script on every visit. It is an equality rather than a pattern because a
   * pattern would accept the next plausible neighbour just as readily.
   *
   * `localhost` stays allowed, because the page's own comment describes running
   * the whole thing locally against `next dev`.
   */
  it("points at the origin the Widget is deployed to", () => {
    const { origin, hostname } = new URL(snippet(page).src);

    expect(origin === PRODUCTION_ORIGIN || hostname === "localhost").toBe(true);
  });
});

describe("the two pages together", () => {
  const answering = read("index.html");
  const isolation = read("isolation", "index.html");

  /**
   * The whole demonstration. If both pages ever named the same Tenant, the
   * isolation page would answer and there would be nothing left to show — and
   * nothing would fail, because each page would still be internally consistent.
   */
  it("bootstrap different Tenants from the same origin", () => {
    expect(snippet(answering).tenantId).not.toBe(snippet(isolation).tenantId);
  });

  it("load byte-for-byte the same script", () => {
    expect(snippet(answering).src).toBe(snippet(isolation).src);
  });

  /**
   * The answering page is the one a visitor lands on, so it is the one that has
   * to survive a stranger's stylesheet in public. Its comment says not to tidy
   * the rules; that comment is the same protection the reset rule had before it
   * was pinned — a reviewer who does not know why the page is ugly deletes
   * them, the Widget still looks right, and the demonstration is gone with no
   * test to say so.
   */
  it("keep the hostile stylesheet on the page people actually open", () => {
    expect(answering).toMatch(/font-family:\s*"Comic Sans MS"[^;]*!important/);
    expect(answering).toMatch(/box-sizing:\s*content-box\s*!important/);
  });

  /** Each has to be reachable from the other, or the pair is two orphans. */
  it("link to each other", () => {
    expect(answering).toMatch(/href="\.\/isolation\/"/);
    expect(isolation).toMatch(/href="\.\.\/"/);
  });
});
