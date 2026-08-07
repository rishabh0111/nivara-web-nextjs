import { describe, expect, it } from "vitest";

import { isNextShapedImport, refuseNextShapedImports } from "./widget-build";

describe("what the Widget build refuses to bundle", () => {
  it("refuses Next itself and everything shaped like it", () => {
    for (const source of [
      "next",
      "next/link",
      "next/navigation",
      "next/dist/client/app-index",
      "@next/env",
      "next-themes",
    ]) {
      expect(isNextShapedImport(source)).toBe(true);
    }
  });

  /**
   * The rule is about a framework, not about a prefix. A false positive here
   * would be a module the Widget legitimately needs, refused with a message
   * about a framework it never mentioned.
   */
  it("lets through the modules that merely start the same way", () => {
    for (const source of [
      "react",
      "preact/compat",
      "@/api/client",
      "./widget-session",
      "nextcloud-client",
      "@tanstack/react-query",
    ]) {
      expect(isNextShapedImport(source)).toBe(false);
    }
  });

  it("names the offending import and the file that wrote it", () => {
    const plugin = refuseNextShapedImports();
    const resolveId = plugin.resolveId;
    if (typeof resolveId !== "function") throw new Error("The plugin has no resolveId hook.");

    expect(() => resolveId.call(null as never, "next/link", "src/widget/widget.tsx", {} as never))
      .toThrow(/next\/link.*src\/widget\/widget\.tsx/s);

    expect(
      resolveId.call(null as never, "@/api/client", "src/widget/boot.tsx", {} as never),
    ).toBeNull();
  });
});
