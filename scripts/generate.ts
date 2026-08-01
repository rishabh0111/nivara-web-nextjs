import openapiTS, { astToString } from "openapi-typescript";

const banner = `/**
 * Generated from the Nivara Desk API's OpenAPI document. Do not edit by hand.
 *
 * Regenerate with \`npm run api:types\`; \`npm run api:drift\` fails if this file
 * and the API disagree.
 */

`;

export async function generateApiTypes(openApiDocumentUrl: string): Promise<string> {
  const ast = await openapiTS(new URL(openApiDocumentUrl));

  return banner + astToString(ast);
}
