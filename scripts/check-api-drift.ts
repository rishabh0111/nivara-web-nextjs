/**
 * Fails if the committed types and the API's OpenAPI document disagree.
 *
 * Drift is a property of the server changing, not of anyone pushing a commit,
 * so this runs on a schedule as well as in CI.
 */
import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import { generatedTypesPath, loadApiEndpoints } from "./api-endpoints";
import { generateApiTypes } from "./generate";

const { openApiDocumentUrl } = loadApiEndpoints();

const fresh = await generateApiTypes(openApiDocumentUrl);

let committed: string;
try {
  committed = await readFile(generatedTypesPath, "utf8");
} catch {
  console.error(
    `No committed types at ${relative(process.cwd(), generatedTypesPath)}. Run \`npm run api:types\`.`,
  );
  process.exit(1);
}

if (fresh !== committed) {
  console.error(
    [
      `The committed API types have drifted from ${openApiDocumentUrl}.`,
      "",
      "The API changed under this repository. Run `npm run api:types`, read the diff,",
      "and follow it through the call sites the compiler points at.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`Committed API types match ${openApiDocumentUrl}.`);
