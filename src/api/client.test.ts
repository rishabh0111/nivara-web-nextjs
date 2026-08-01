import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { describeFailure, isApiFailure } from "./errors";

const baseUrl = "https://api.test";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ticket = {
  id: "tkt_1",
  subject: "Printer is on fire",
  state: "open",
  priority: "urgent",
  source: "portal",
  contactId: "con_1",
  assigneeId: null,
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
};

function client(overrides: Parameters<typeof createApiClient>[0] = {}) {
  return createApiClient({ baseUrl, ...overrides });
}

describe("the collection convention", () => {
  it("hands back the page and the cursor, and no call site opens the envelope", async () => {
    server.use(
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket], nextCursor: "cur_2" }),
      ),
    );

    const result = await client().page("/tickets", "get", { token: "tok" });

    expect(result).toEqual({
      ok: true,
      value: { items: [ticket], nextCursor: "cur_2" },
    });
  });

  it("carries an end-of-list cursor through as null rather than inventing a total", async () => {
    server.use(
      http.get(`${baseUrl}/tickets`, () => HttpResponse.json({ data: [], nextCursor: null })),
    );

    const result = await client().page("/tickets", "get", {});

    expect(result.ok && result.value).toEqual({ items: [], nextCursor: null });
  });

  it("refuses to read a single resource as a collection", async () => {
    server.use(http.get(`${baseUrl}/tickets/tkt_1`, () => HttpResponse.json(ticket)));

    const result = await client().page("/tickets/{id}", "get", { params: { id: "tkt_1" } });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure.kind).toBe("transport");
  });
});

describe("the single-resource convention", () => {
  it("hands a single resource back bare", async () => {
    server.use(http.get(`${baseUrl}/tickets/tkt_1`, () => HttpResponse.json(ticket)));

    const result = await client().resource("/tickets/{id}", "get", { params: { id: "tkt_1" } });

    expect(result).toEqual({ ok: true, value: ticket });
  });

  it("fills path parameters into the URL", async () => {
    let seen: string | undefined;
    server.use(
      http.get(`${baseUrl}/tickets/:id/messages`, ({ request }) => {
        seen = new URL(request.url).pathname;
        return HttpResponse.json({ data: [], nextCursor: null });
      }),
    );

    await client().page("/tickets/{id}/messages", "get", { params: { id: "tkt 1/2" } });

    expect(seen).toBe("/tickets/tkt%201%2F2/messages");
  });
});

describe("query parameters", () => {
  it("sends the filters it was given, several values as one comma-separated value", async () => {
    let search: string | undefined;
    server.use(
      http.get(`${baseUrl}/tickets`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({ data: [], nextCursor: null });
      }),
    );

    await client().page("/tickets", "get", {
      query: { state: "open,pending", assigneeId: "none", limit: 50 },
    });

    expect(search).toBe("?state=open%2Cpending&assigneeId=none&limit=50");
  });

  it("omits absent filters rather than sending them empty", async () => {
    let search: string | undefined;
    server.use(
      http.get(`${baseUrl}/tickets`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({ data: [], nextCursor: null });
      }),
    );

    await client().page("/tickets", "get", { query: { state: undefined, priority: "" } });

    expect(search).toBe("");
  });

  it("cannot be given a parameter the API does not define", async () => {
    server.use(
      http.get(`${baseUrl}/tickets`, () => HttpResponse.json({ data: [], nextCursor: null })),
    );

    await client().page("/tickets", "get", {
      // Unknown parameters are a 400, so this must not compile. If the line
      // below ever type-checks, the compiler has stopped enforcing the rule.
      // @ts-expect-error `tenantId` is not a filter on this API, and never will be.
      query: { tenantId: "ten_1" },
    });
  });
});

describe("errors", () => {
  it("branches on the stable code, and carries the message without depending on it", async () => {
    server.use(
      http.get(`${baseUrl}/tickets/tkt_1`, () =>
        HttpResponse.json(
          { error: { code: "not_found", message: "Wording nobody should branch on." } },
          { status: 404 },
        ),
      ),
    );

    const result = await client().resource("/tickets/{id}", "get", { params: { id: "tkt_1" } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(isApiFailure(result.failure, "not_found")).toBe(true);
    expect(result.failure).toMatchObject({ kind: "api", status: 404 });
  });

  it("never renders a not-found answer as a permission problem", async () => {
    const notFound = describeFailure({
      kind: "api",
      code: "not_found",
      status: 404,
      message: "Not found",
    });
    const forbidden = describeFailure({
      kind: "api",
      code: "forbidden",
      status: 403,
      message: "Forbidden",
    });

    expect(notFound).not.toMatch(/permission|allow|forbidden|access/i);
    expect(notFound).not.toBe(forbidden);
  });

  it("carries validation details through for the fields that offended", async () => {
    server.use(
      http.post(`${baseUrl}/portal/tickets`, () =>
        HttpResponse.json(
          {
            error: {
              code: "validation_failed",
              message: "Validation failed",
              details: [{ field: "subject", issue: "must not be empty" }],
            },
          },
          { status: 422 },
        ),
      ),
    );

    const result = await client().resource("/portal/tickets", "post", {
      body: { subject: "" },
    });

    expect(result.ok === false && describeFailure(result.failure)).toBe(
      "subject: must not be empty",
    );
  });

  it("reports a body it could not read as transport rather than inventing a code", async () => {
    server.use(
      http.get(`${baseUrl}/tickets/tkt_1`, () =>
        HttpResponse.text("<html>502 Bad Gateway</html>", { status: 502 }),
      ),
    );

    const result = await client().resource("/tickets/{id}", "get", { params: { id: "tkt_1" } });

    expect(result.ok === false && result.failure).toMatchObject({
      kind: "transport",
      reason: "unreadable",
    });
  });

  it("reports an unreachable server as transport", async () => {
    server.use(http.get(`${baseUrl}/tickets/tkt_1`, () => HttpResponse.error()));

    const result = await client().resource("/tickets/{id}", "get", { params: { id: "tkt_1" } });

    expect(result.ok === false && result.failure.kind).toBe("transport");
  });
});

describe("rate limiting", () => {
  it("backs off for the interval the server gave, then succeeds", async () => {
    let attempts = 0;
    server.use(
      http.get(`${baseUrl}/tickets`, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json(
              { error: { code: "rate_limited", message: "Slow down" } },
              { status: 429, headers: { "Retry-After": "7" } },
            )
          : HttpResponse.json({ data: [ticket], nextCursor: null });
      }),
    );

    const sleep = vi.fn(async () => {});
    const result = await client({ sleep }).page("/tickets", "get", {});

    expect(sleep).toHaveBeenCalledExactlyOnceWith(7000);
    expect(result.ok && result.value.items).toEqual([ticket]);
  });

  it("gives up rather than waiting out an interval long enough to look like a hang", async () => {
    server.use(
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json(
          { error: { code: "rate_limited", message: "Slow down" } },
          { status: 429, headers: { "Retry-After": "600" } },
        ),
      ),
    );

    const sleep = vi.fn(async () => {});
    const result = await client({ sleep }).page("/tickets", "get", {});

    expect(sleep).not.toHaveBeenCalled();
    expect(result.ok === false && result.failure).toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 600,
    });
  });

  it("does not retry an interval the server did not supply", async () => {
    let attempts = 0;
    server.use(
      http.get(`${baseUrl}/tickets`, () => {
        attempts += 1;
        return HttpResponse.json(
          { error: { code: "rate_limited", message: "Slow down" } },
          { status: 429 },
        );
      }),
    );

    const sleep = vi.fn(async () => {});
    await client({ sleep }).page("/tickets", "get", {});

    expect(attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops retrying rather than hammering a limit that will not lift", async () => {
    let attempts = 0;
    server.use(
      http.get(`${baseUrl}/tickets`, () => {
        attempts += 1;
        return HttpResponse.json(
          { error: { code: "rate_limited", message: "Slow down" } },
          { status: 429, headers: { "Retry-After": "1" } },
        );
      }),
    );

    const result = await client({ sleep: async () => {} }).page("/tickets", "get", {});

    expect(attempts).toBe(3);
    expect(result.ok).toBe(false);
  });
});

describe("credentials", () => {
  it("sends the token it was given as a bearer credential", async () => {
    let authorization: string | null = null;
    server.use(
      http.get(`${baseUrl}/tickets`, ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json({ data: [], nextCursor: null });
      }),
    );

    await client().page("/tickets", "get", { token: "nvw_abc" });

    expect(authorization).toBe("Bearer nvw_abc");
  });

  it("sends no Authorization header when it holds no credential", async () => {
    let authorization: string | null = "unset";
    server.use(
      http.post(`${baseUrl}/widget/sessions`, ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json({ token: "nvw_abc", expiresInSeconds: 1800 });
      }),
    );

    await client().resource("/widget/sessions", "post", { body: { tenantId: "ten_1" } });

    expect(authorization).toBeNull();
  });
});
