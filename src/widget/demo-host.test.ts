import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The demo host page is the only place the Widget is judged the way a Tenant
 * judges it, and it is not built, imported or type-checked by anything. Every
 * instruction it carries is prose, and prose is what the reset rule was
 * protected by until a test pinned it.
 *
 * So the values a reviewer's demo actually depends on are pinned here.
 * None of them is exercised by the suite that boots the Widget against a fake
 * wire — that suite supplies its own Snippet.
 */
const page = readFileSync(resolve(import.meta.dirname, "../../demo-host/index.html"), "utf8");

/** The Tenant the demo host's origin is allowlisted on, and the only one. */
const ISOLATION_TENANT_ID = "5eed0000-0000-4000-8000-000000000002";

/** Where the Widget bundle is served from. The application's own origin. */
const PRODUCTION_ORIGIN = "https://nivara-web-nextjs.vercel.app";

const snippet = () => {
  const tag = page.match(/<script\b[^>]*\bdata-tenant-id\b[^>]*>/)?.[0];

  if (tag === undefined) throw new Error("the demo host page carries no Snippet");

  const attribute = (name: string) => {
    const value = tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

    // Named here rather than left to whatever the caller does with `undefined`.
    // A Snippet missing one of its two attributes is the failure this file
    // exists to report, and `new URL(undefined)` reports it as "Invalid URL".
    if (value === undefined) throw new Error(`the Snippet has no ${name}`);

    return value;
  };

  return { src: attribute("src"), tenantId: attribute("data-tenant-id") };
};

describe("the Snippet on the demo host page", () => {
  /**
   * The isolation Tenant, because an embedded Widget opens Tickets on whichever
   * Tenant it bootstraps against and the showcase Tenant's data is curated to
   * be read. An unset value here is not harmless: the page would deploy, the
   * Launcher would appear, and the gate it exists to demonstrate would answer
   * `forbidden` for the wrong reason.
   */
  it("names the isolation Tenant rather than a value nobody set", () => {
    expect(snippet().tenantId).toBe(ISOLATION_TENANT_ID);
  });

  /**
   * The path the build writes the bundle to. The origin in front of it is the
   * next test's business; this one only pins that the Snippet is still pointed
   * at `widget:build`'s output and not at some hand-copied file.
   */
  it("asks for the path the Widget build writes", () => {
    expect(snippet().src).toMatch(/\/widget\/widget\.js$/);
  });

  /**
   * The deployed application's own origin, pinned exactly.
   *
   * A host that resolves but is not ours is the failure worth guarding against:
   * `nivara-web.vercel.app` is a live application belonging to somebody else,
   * and a demo host carrying it would have asked a stranger's origin for a
   * script on every visit. That is why this was a reserved `.example` host
   * while there was no correct value, and why it is an equality rather than a
   * pattern now that there is — a pattern would accept the next plausible
   * neighbour just as readily.
   *
   * `localhost` stays allowed, because the page's own comment describes running
   * the whole thing locally against `next dev`, and a reader following those
   * instructions should not have to red the suite to do it.
   */
  it("points at the origin the Widget is deployed to", () => {
    const { origin, hostname } = new URL(snippet().src);

    expect(origin === PRODUCTION_ORIGIN || hostname === "localhost").toBe(true);
  });

  /**
   * The page's stylesheet is hostile on purpose, and its comment says not to
   * tidy it. That comment is the same protection the reset rule had before it
   * was pinned: a reviewer who does not know why the page is ugly deletes the
   * rules, the Widget still looks right, and the demonstration is gone with no
   * test to say so.
   */
  it("keeps the hostile stylesheet the Widget is demonstrated against", () => {
    expect(page).toMatch(/font-family:\s*"Comic Sans MS"[^;]*!important/);
    expect(page).toMatch(/box-sizing:\s*content-box\s*!important/);
  });
});
