import { describe, expect, it } from "vitest";

import { CrossOriginRefused, createBrowserFetch } from "./browser-fetch";

const ORIGIN = "http://localhost:3000";
const API = "https://api.test";

const allowed = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
};

type Call = { url: string; init: RequestInit };

/** A server that allows everything, and remembers what it was asked. */
function server(
  answer: (call: Call) => Response = () => new Response("{}", { status: 200, headers: allowed }),
) {
  const calls: Call[] = [];

  const fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return answer(call);
  }) as typeof globalThis.fetch;

  return { fetch, calls };
}

const headerOn = (call: Call, name: string) => new Headers(call.init.headers).get(name);

describe("a fetch that plays by a browser's rules", () => {
  it("puts this application's origin on every request", async () => {
    const upstream = server();
    const browser = createBrowserFetch({ origin: ORIGIN, fetch: upstream.fetch });

    await browser.fetch(`${API}/health`, { method: "GET" });

    expect(headerOn(upstream.calls[0]!, "origin")).toBe(ORIGIN);
  });

  it("asks permission before a request a browser would preflight", async () => {
    const upstream = server();
    const browser = createBrowserFetch({ origin: ORIGIN, fetch: upstream.fetch });

    await browser.fetch(`${API}/tickets`, {
      method: "GET",
      headers: { authorization: "Bearer nvd_x" },
    });

    const [preflight, actual] = upstream.calls;
    expect(preflight?.init.method).toBe("OPTIONS");
    expect(headerOn(preflight!, "access-control-request-method")).toBe("GET");
    expect(headerOn(preflight!, "access-control-request-headers")).toBe("authorization");
    expect(actual?.init.method).toBe("GET");
  });

  it("sends a plain GET straight out, with no preflight", async () => {
    const upstream = server();
    const browser = createBrowserFetch({ origin: ORIGIN, fetch: upstream.fetch });

    await browser.fetch(`${API}/health`, { method: "GET" });

    expect(upstream.calls).toHaveLength(1);
  });

  it("refuses a response the API did not allow this origin to read", async () => {
    const upstream = server(() => new Response("{}", { status: 200 }));
    const browser = createBrowserFetch({ origin: ORIGIN, fetch: upstream.fetch });

    await expect(browser.fetch(`${API}/health`, { method: "GET" })).rejects.toThrow(
      CrossOriginRefused,
    );
  });

  it("names the preflight when that is what was refused", async () => {
    const upstream = server((call) =>
      call.init.method === "OPTIONS"
        ? new Response(null, { status: 404 })
        : new Response("{}", { status: 200, headers: allowed }),
    );
    const browser = createBrowserFetch({ origin: ORIGIN, fetch: upstream.fetch });

    await expect(
      browser.fetch(`${API}/tickets`, { method: "GET", headers: { authorization: "Bearer x" } }),
    ).rejects.toThrow(/preflight/i);
  });

  it("keeps a cookie the API set and sends it back on a credentialed request", async () => {
    const upstream = server(
      () =>
        new Response("{}", {
          status: 200,
          headers: { ...allowed, "set-cookie": "nvd_refresh=abc; Path=/auth; Secure; SameSite=None" },
        }),
    );
    const browser = createBrowserFetch({ origin: ORIGIN, fetch: upstream.fetch });

    await browser.fetch(`${API}/auth/sign-in`, { method: "POST", credentials: "include" });
    await browser.fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });

    expect(headerOn(upstream.calls.at(-1)!, "cookie")).toBe("nvd_refresh=abc");
  });

  it("sends no cookie on a request that did not ask for one", async () => {
    const upstream = server(
      () =>
        new Response("{}", {
          status: 200,
          headers: { ...allowed, "set-cookie": "nvd_refresh=abc; Path=/; Secure; SameSite=None" },
        }),
    );
    const browser = createBrowserFetch({ origin: ORIGIN, fetch: upstream.fetch });

    await browser.fetch(`${API}/auth/sign-in`, { method: "POST", credentials: "include" });
    await browser.fetch(`${API}/tickets`, { method: "GET" });

    expect(headerOn(upstream.calls.at(-1)!, "cookie")).toBeNull();
  });

  it("sends the request without a cookie a browser would have withheld, and says which", async () => {
    const upstream = server(
      () =>
        new Response("{}", {
          status: 200,
          headers: { ...allowed, "set-cookie": "nvd_refresh=abc; Path=/auth; Secure; SameSite=Lax" },
        }),
    );
    const browser = createBrowserFetch({ origin: ORIGIN, fetch: upstream.fetch });

    await browser.fetch(`${API}/auth/sign-in`, { method: "POST", credentials: "include" });
    await browser.fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });

    expect(headerOn(upstream.calls.at(-1)!, "cookie")).toBeNull();
    expect(browser.jar.withheld("/auth/refresh").map((cookie) => cookie.name)).toEqual([
      "nvd_refresh",
    ]);
  });

  it("hands back the response the API sent, refusals aside", async () => {
    const upstream = server(
      () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: allowed }),
    );
    const browser = createBrowserFetch({ origin: ORIGIN, fetch: upstream.fetch });

    const response = await browser.fetch(`${API}/health`, { method: "GET" });

    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
