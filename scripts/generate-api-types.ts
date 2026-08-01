/**
 * Generates the API's types from its OpenAPI document.
 *
 * Types only: no generated runtime, no template overrides. The request layer is
 * hand-written middleware a reviewer can read, and the generated file is output
 * — committed so that regenerating produces a diff that reads as drift.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { generatedTypesPath, loadApiEndpoints } from "./api-endpoints";
import { generateApiTypes } from "./generate";

const { openApiDocumentUrl } = loadApiEndpoints();

const contents = await generateApiTypes(openApiDocumentUrl);

await mkdir(dirname(generatedTypesPath), { recursive: true });
await writeFile(generatedTypesPath, contents, "utf8");

console.log(`Generated ${generatedTypesPath} from ${openApiDocumentUrl}`);
