/**
 * A `fetch` that behaves the way a page on this application's origin would.
 *
 * It is handed to the ordinary request layer as its `fetch`, so everything
 * above it — the client, the session, the Surfaces — is the code that ships,
 * unchanged. What this adds underneath is the part Node leaves out: the origin
 * on the request, the preflight before the ones that need one, the refusal of a
 * response the browser would not have handed to a page, and the cookie jar the
 * refresh half of every session depends on. `e2e/README.md` has the argument
 * for simulating that rather than driving a real browser.
 *
 * A refusal throws rather than resolving. A browser surfaces one as a network
 * error and the page never sees the response, so a request layer handed a
 * rejected promise here is being told exactly what it would be told there.
 */
import { CookieJar } from "./cookie-jar";
import { corsRefusal, preflightRefusal, preflightRequired, type CorsRefusal } from "./cors";

/** The browser threw the answer away. Which is a result, and a loud one. */
export class CrossOriginRefused extends Error {
  constructor(
    readonly phase: "preflight" | "response",
    readonly url: string,
    readonly refusal: CorsRefusal,
  ) {
    super(
      `A browser on this origin would have refused the ${phase} for ${url}: ${refusal.reason} (${refusal.header}).`,
    );
    this.name = "CrossOriginRefused";
  }
}

export type BrowserFetch = {
  fetch: typeof globalThis.fetch;
  /** Readable so a failure can say what was held and withheld, and why. */
  jar: CookieJar;
};

export function createBrowserFetch({
  origin,
  fetch = globalThis.fetch.bind(globalThis),
}: {
  /** The origin a page would be served from — what the API is asked to allow. */
  origin: string;
  fetch?: typeof globalThis.fetch;
}): BrowserFetch {
  const jar = new CookieJar();

  const browserFetch: typeof globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    const credentialed = init.credentials === "include";

    if (preflightRequired(method, headers)) {
      const requestedHeaders = [...headers.keys()].map((name) => name.toLowerCase()).sort();
      const answer = await fetch(url, {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": method,
          ...(requestedHeaders.length > 0
            ? { "access-control-request-headers": requestedHeaders.join(",") }
            : {}),
        },
      });

      const refused = preflightRefusal({
        origin,
        credentialed,
        method,
        requestedHeaders,
        status: answer.status,
        headers: answer.headers,
      });

      if (refused) throw new CrossOriginRefused("preflight", url.toString(), refused);
    }

    headers.set("origin", origin);

    // Only where the caller asked for cookies, and only the ones a browser
    // would have sent from another site. What is held but withheld stays on the
    // jar, where whoever is diagnosing the session can read it.
    if (credentialed) {
      const cookie = jar.header(url.pathname);
      if (cookie) headers.set("cookie", cookie);
    }

    const response = await fetch(url, { ...init, method, headers });

    jar.accept(response.headers.getSetCookie());

    const refused = corsRefusal({ origin, credentialed, headers: response.headers });
    if (refused) throw new CrossOriginRefused("response", url.toString(), refused);

    return response;
  };

  return { fetch: browserFetch, jar };
}
