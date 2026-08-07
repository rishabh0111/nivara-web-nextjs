/**
 * Fails if the Widget has outgrown its budget.
 *
 * The budget is the enforcement. The Widget shares modules with a Next
 * application, and the boundary between them is a convention — the build
 * refuses a Next import by name, but nothing refuses the transitive weight of
 * a query client, a date library, or a component that quietly grew. Sixty
 * kilobytes gzipped is what a Tenant's visitors pay before anyone asks for
 * support, and it is checked rather than remembered.
 */
import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const OUT_DIR = resolve(import.meta.dirname, "..", "public", "widget");

/** Everything the Snippet causes to be downloaded, gzipped, together. */
const BUDGET_BYTES = 60 * 1024;

let files: string[];
try {
  files = await readdir(OUT_DIR);
} catch {
  console.error(`No Widget build at ${relative(process.cwd(), OUT_DIR)}. Run \`npm run widget:build\`.`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`The Widget build at ${relative(process.cwd(), OUT_DIR)} is empty.`);
  process.exit(1);
}

const measured = await Promise.all(
  files.map(async (name) => {
    // Level 9, because a CDN serving this will do at least as well, and a
    // budget measured more loosely than the wire is a budget that lies upward.
    const gzipped = gzipSync(await readFile(resolve(OUT_DIR, name)), { level: 9 }).byteLength;
    return { name, gzipped };
  }),
);

const total = measured.reduce((sum, file) => sum + file.gzipped, 0);

for (const file of measured.sort((a, b) => b.gzipped - a.gzipped)) {
  console.log(`${kilobytes(file.gzipped).padStart(8)}  ${file.name}`);
}

console.log(`${kilobytes(total).padStart(8)}  total, against a budget of ${kilobytes(BUDGET_BYTES)}`);

if (total > BUDGET_BYTES) {
  console.error(
    [
      "",
      `The Widget is ${kilobytes(total - BUDGET_BYTES)} over budget.`,
      "",
      "Something got imported that a Tenant's visitors should not be paying for.",
      "Find it before raising the number — the budget is the only thing enforcing",
      "the module boundary this Widget shares with the Next application.",
    ].join("\n"),
  );
  process.exit(1);
}

function kilobytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`;
}
