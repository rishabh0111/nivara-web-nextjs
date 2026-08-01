/**
 * The one input that points this application at a backend.
 *
 * `NEXT_PUBLIC_API_URL` configures all three of them — the HTTP base, the
 * real-time origin, and the document types are generated from. There is no
 * second variable, because a second variable is a way for two halves of the
 * same application to disagree about which server they are talking to.
 */

/** The real-time namespace, from the API's wire contract. Not configurable. */
const REALTIME_NAMESPACE = "/rt";

/** The API serves its OpenAPI document here. Not configurable. */
const OPENAPI_DOCUMENT_PATH = "/openapi.json";

export type ApiEndpoints = {
  /** Base for every HTTP call. No trailing slash. */
  httpBaseUrl: string;
  /** Socket origin plus the real-time namespace. */
  realtimeUrl: string;
  /** The document the typed client is generated from. */
  openApiDocumentUrl: string;
};

export function resolveApiEndpoints(rawUrl: string | undefined): ApiEndpoints {
  const value = rawUrl?.trim();

  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. It is the only variable that points this application at a Nivara Desk API.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_API_URL must be an absolute URL, such as https://nivara-api-nestjs.onrender.com. Received: ${value}`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `NEXT_PUBLIC_API_URL must use http or https. The socket origin is derived from it, not configured separately. Received: ${value}`,
    );
  }

  const httpBaseUrl = value.replace(/\/+$/, "");

  return {
    httpBaseUrl,
    realtimeUrl: `${httpBaseUrl}${REALTIME_NAMESPACE}`,
    openApiDocumentUrl: `${httpBaseUrl}${OPENAPI_DOCUMENT_PATH}`,
  };
}

/**
 * The endpoints this application is actually pointed at.
 *
 * `process.env.NEXT_PUBLIC_API_URL` is referenced statically so Next.js inlines
 * it into the browser bundle. Resolved on call rather than at module load, so
 * importing this module is free of side effects and a misconfiguration surfaces
 * where it is used.
 */
export function getApiEndpoints(): ApiEndpoints {
  return resolveApiEndpoints(process.env.NEXT_PUBLIC_API_URL);
}
