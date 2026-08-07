/**
 * The rule the Widget build enforces, apart from building.
 *
 * The Widget shares modules with the Next application — the request layer, the
 * session client, the Cold-start phase — and nothing in the language stops one
 * of those growing a Next import later. The module boundary here is a
 * convention, and a convention does not stop an import. This does.
 */
import type { Plugin } from "vite";

/** `next`, `next/…`, `@next/…`, `next-…`. Not `nextTick` or `nextCursor`. */
const NEXT_SHAPED = /^(next|next-[^/]*|@next\/.*|next\/.*)$/;

export function isNextShapedImport(source: string): boolean {
  return NEXT_SHAPED.test(source);
}

/**
 * Fails the build where the import was written, naming the file that wrote it.
 * The alternative is discovering it as thirty kilobytes on the size budget with
 * nothing to say where they came from.
 */
export function refuseNextShapedImports(): Plugin {
  return {
    name: "nivara:refuse-next-shaped-imports",
    enforce: "pre",
    resolveId(source, importer) {
      if (!isNextShapedImport(source)) return null;

      throw new Error(
        `The Widget cannot import '${source}'${importer ? ` (from ${importer})` : ""}. It runs on a Tenant's page, where there is no Next application — move what is shared into a module that does not know about one.`,
      );
    },
  };
}
