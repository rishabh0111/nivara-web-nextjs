/**
 * What a browser would have done with the API's answer, as a function.
 *
 * This suite runs in Node, where a cross-origin fetch is not cross-origin at
 * all: `fetch` there is a client, not a user agent, and it will happily read a
 * response no browser would hand to a page. Running the real path without this
 * would prove only that the API answers, which was never in doubt — the failure
 * this exists to catch is the one where it answers and the browser throws the
 * answer away.
 *
 * So the enforcement a browser does is written down here, over the headers the
 * server actually sent. It is the same judgement, made in the same place a
 * browser makes it: after the response, on its headers, and never on the body.
 */

/** Why a browser would have refused, named by the header it read to decide. */
export type CorsRefusal = { header: string; reason: string };

/**
 * Who is asking, and whether a session rides on it.
 *
 * The two travel together because neither decides anything alone: the same
 * headers that let an anonymous read through are refused for a credentialed
 * one, and a wildcard is the case where that difference is the whole answer.
 */
export type CrossOriginRequest = {
  origin: string;
  /** Whether cookies were sent or are being asked for. Wildcards die here. */
  credentialed: boolean;
};

/**
 * Methods a browser will send without asking first — and only these.
 * `PATCH`, which all three of this API's write actions use, is not among them.
 */
const SIMPLE_METHODS = new Set(["GET", "HEAD", "POST"]);

/** The only request headers a browser considers safe to send unannounced. */
const SAFELISTED_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-language",
  "content-type",
]);

/** And `content-type` only where it carries one of these three values. */
const SAFELISTED_CONTENT_TYPES = new Set([
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
]);

export function corsRefusal({
  origin,
  credentialed,
  headers,
}: CrossOriginRequest & { headers: Headers }): CorsRefusal | undefined {
  const allowOrigin = headers.get("access-control-allow-origin");

  if (allowOrigin === null) {
    return {
      header: "access-control-allow-origin",
      reason: `the response carried no access-control-allow-origin, so a page on ${origin} could not read it`,
    };
  }

  if (allowOrigin === "*") {
    // A wildcard is fine for a public read and useless for a session: the
    // browser refuses to pair it with credentials, which is the whole of what
    // this application does.
    if (!credentialed) return undefined;

    return {
      header: "access-control-allow-origin",
      reason: "a credentialed request cannot be answered with a wildcard origin; it needs the exact origin",
    };
  }

  if (allowOrigin !== origin) {
    return {
      header: "access-control-allow-origin",
      reason: `the response allowed ${allowOrigin}, not ${origin}`,
    };
  }

  if (credentialed && headers.get("access-control-allow-credentials") !== "true") {
    return {
      header: "access-control-allow-credentials",
      reason: "cookies were involved and the response did not set access-control-allow-credentials: true",
    };
  }

  return undefined;
}

/** Whether a browser would ask permission before sending this request at all. */
export function preflightRequired(method: string, headers: Headers): boolean {
  if (!SIMPLE_METHODS.has(method.toUpperCase())) return true;

  for (const [name, value] of headers) {
    const header = name.toLowerCase();
    if (!SAFELISTED_HEADERS.has(header)) return true;

    if (header === "content-type") {
      const type = value.split(";")[0]!.trim().toLowerCase();
      if (!SAFELISTED_CONTENT_TYPES.has(type)) return true;
    }
  }

  return false;
}

export function preflightRefusal({
  origin,
  credentialed,
  method,
  requestedHeaders,
  status,
  headers,
}: CrossOriginRequest & {
  method: string;
  requestedHeaders: string[];
  status: number;
  headers: Headers;
}): CorsRefusal | undefined {
  if (status < 200 || status > 299) {
    return {
      header: "status",
      reason: `the preflight was answered ${status}; a browser reads only a 2xx as permission`,
    };
  }

  const origins = corsRefusal({ origin, credentialed, headers });
  if (origins) return origins;

  const allowedMethods = listOf(headers.get("access-control-allow-methods"));
  if (!allows(allowedMethods, method.toUpperCase(), credentialed)) {
    return {
      header: "access-control-allow-methods",
      reason: `${method.toUpperCase()} is not in access-control-allow-methods (${headers.get("access-control-allow-methods") ?? "absent"})`,
    };
  }

  const allowedHeaders = listOf(headers.get("access-control-allow-headers"));
  const missing = requestedHeaders
    .map((header) => header.toLowerCase())
    .filter((header) => !allows(allowedHeaders, header, credentialed));

  if (missing.length > 0) {
    return {
      header: "access-control-allow-headers",
      reason: `${missing.join(", ")} not in access-control-allow-headers (${headers.get("access-control-allow-headers") ?? "absent"})`,
    };
  }

  return undefined;
}

function listOf(header: string | null): string[] {
  if (!header) return [];

  return header
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length > 0);
}

/** A wildcard stands for everything, except on a credentialed request. */
function allows(allowed: string[], wanted: string, credentialed: boolean): boolean {
  if (allowed.includes("*")) return !credentialed;

  return allowed.includes(wanted.toUpperCase());
}
