import { describe, expect, it } from "vitest";

import { readWidgetConfig } from "./widget-config";

function snippet(attributes: Record<string, string>): HTMLScriptElement {
  const script = document.createElement("script");
  for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
  return script;
}

describe("reading the Snippet", () => {
  it("takes the Tenant off the one attribute the Snippet carries", () => {
    expect(readWidgetConfig(snippet({ "data-tenant-id": "ten_1" }))).toEqual({ tenantId: "ten_1" });
  });

  it("tolerates the whitespace a copy-paste leaves behind", () => {
    expect(readWidgetConfig(snippet({ "data-tenant-id": "  ten_1\n" }))).toEqual({
      tenantId: "ten_1",
    });
  });

  /**
   * The Snippet is pasted by hand into somebody else's site, and a missing
   * attribute is the likeliest way it arrives wrong. The person who has to fix
   * it is reading the host page's console, not ours, so the message names the
   * attribute rather than reporting that a value was undefined.
   */
  it("names the attribute when the Snippet arrives without it", () => {
    expect(() => readWidgetConfig(snippet({}))).toThrow(/data-tenant-id/);
    expect(() => readWidgetConfig(snippet({ "data-tenant-id": "   " }))).toThrow(/data-tenant-id/);
  });

  it("says so when there is no Snippet to read at all", () => {
    expect(() => readWidgetConfig(null)).toThrow(/script tag/i);
  });
});
