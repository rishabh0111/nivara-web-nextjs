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
   * Until a production origin exists there is no correct host, and a host that
   * resolves is worse than one that does not. `nivara-web.vercel.app` was one:
   * it is a live application belonging to somebody else, so the demo host would
   * have asked a stranger's origin for a script on every visit.
   *
   * Two hosts are allowed, and no others. `.example` is reserved by RFC 2606 and
   * can never be registered by anyone, which is what makes an unset value safe
   * to commit; `localhost` is the local run the page's own comment describes,
   * where the bundle is served by `next dev` and the demo host by port 4173. A
   * reader following those instructions should not have to red the suite to do
   * it.
   *
   * When `02` produces the real origin this expectation is updated along with
   * the page — deliberately, by whoever owns the deployment, which is the point.
   */
  it("points at a host nobody else can answer on", () => {
    const { hostname } = new URL(snippet().src);

    expect(hostname).toMatch(/(\.example|^localhost)$/);
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
