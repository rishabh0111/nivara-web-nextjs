/**
 * The request layer: hand-written middleware that owns this API's conventions
 * once, so no call site re-derives how the API answers.
 *
 * What it owns:
 *
 * - collections carry their page and a cursor and no total, singles arrive bare
 *   — `page()` and `resource()`, and nothing unwraps either by hand;
 * - errors branch on the stable code from the closed catalog, never on wording;
 * - a rate-limited response is backed off using the interval the server gave;
 * - a not-found answer is never surfaced as a permission error;
 * - a query parameter the API does not define cannot be sent.
 */
import { getApiEndpoints } from "@/config/api";

import { requestActivity, type RequestActivity } from "./activity";
import type { ApiErrorCode, ApiFailure } from "./errors";
import type {
  ApiPath,
  BodyOf,
  CollectionOf,
  MethodOn,
  Operation,
  PathParamsOf,
  QueryOf,
  SuccessOf,
} from "./operations";

export type ApiResult<T> = { ok: true; value: T } | { ok: false; failure: ApiFailure };

/** A collection, as this application holds one. No total, because there is none. */
export type Page<Item> = { items: Item[]; nextCursor: string | null };

/**
 * A `Retry-After` far enough out that waiting on it would look like a hang.
 * Past this the failure is handed back with the interval on it, so the surface
 * can say how long rather than sit there.
 */
const MAX_HONOURED_RETRY_AFTER_SECONDS = 30;

/** Rate limits are transient; three attempts is enough to ride out a burst. */
const MAX_ATTEMPTS = 3;

type QueryPart<O> = [QueryOf<O>] extends [never] ? { query?: never } : { query?: QueryOf<O> };
type ParamsPart<O> = [PathParamsOf<O>] extends [never]
  ? { params?: never }
  : { params: PathParamsOf<O> };
type BodyPart<O> = [BodyOf<O>] extends [never] ? { body?: never } : { body: BodyOf<O> };

type CommonOptions = {
  /** Bearer credential. Which one decides which Surface this call is made as. */
  token?: string;
  /**
   * Send and accept cookies. Only the refresh and sign-out endpoints want this;
   * the refresh cookie is httpOnly and path-scoped, so nothing else benefits.
   */
  withCookies?: boolean;
  signal?: AbortSignal;
};

export type RequestOptions<P extends ApiPath, M extends MethodOn<P>> = CommonOptions &
  QueryPart<Operation<P, M>> &
  ParamsPart<Operation<P, M>> &
  BodyPart<Operation<P, M>>;

export type ApiClientDeps = {
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
  /** Where a Cold start is noticed. Every call is reported, in flight and done. */
  activity: RequestActivity;
};

export type ApiClient = {
  /** A single resource. It arrives bare, and is handed back bare. */
  resource<P extends ApiPath, M extends MethodOn<P>>(
    path: P,
    method: M,
    options: RequestOptions<P, M>,
  ): Promise<ApiResult<SuccessOf<Operation<P, M>>>>;

  /** A collection. The envelope is opened here and nowhere else. */
  page<P extends ApiPath, M extends MethodOn<P>>(
    path: P,
    method: M,
    options: RequestOptions<P, M>,
  ): Promise<ApiResult<Page<CollectionOf<Operation<P, M>>>>>;
};

export function createApiClient(overrides: Partial<ApiClientDeps> = {}): ApiClient {
  const deps: ApiClientDeps = {
    baseUrl: overrides.baseUrl ?? getApiEndpoints().httpBaseUrl,
    fetch: overrides.fetch ?? globalThis.fetch.bind(globalThis),
    sleep: overrides.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    activity: overrides.activity ?? requestActivity,
  };

  async function send(
    path: string,
    method: string,
    options: CommonOptions & { query?: unknown; params?: unknown; body?: unknown },
  ): Promise<ApiResult<unknown>> {
    const finished = deps.activity.begin();
    try {
      return await attempt(path, method, options);
    } finally {
      finished();
    }
  }

  async function attempt(
    path: string,
    method: string,
    options: CommonOptions & { query?: unknown; params?: unknown; body?: unknown },
  ): Promise<ApiResult<unknown>> {
    const url = buildUrl(deps.baseUrl, path, options.params, options.query);

    const headers = new Headers({ Accept: "application/json" });
    if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
    if (options.body !== undefined) headers.set("Content-Type", "application/json");

    const init: RequestInit = {
      method: method.toUpperCase(),
      headers,
      signal: options.signal,
      ...(options.withCookies ? { credentials: "include" as const } : {}),
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    };

    for (let attempt = 1; ; attempt += 1) {
      let response: Response;
      try {
        response = await deps.fetch(url, init);
      } catch (cause) {
        // An aborted request is the caller's own decision, not a failure to report.
        if (cause instanceof Error && cause.name === "AbortError") throw cause;
        return {
          ok: false,
          failure: {
            kind: "transport",
            reason: "unreachable",
            message: cause instanceof Error ? cause.message : "The request did not complete.",
          },
        };
      }

      if (response.ok) return readSuccess(response);

      const failure = await readFailure(response);

      const canRetry =
        failure.kind === "api" &&
        failure.code === "rate_limited" &&
        attempt < MAX_ATTEMPTS &&
        failure.retryAfterSeconds !== undefined &&
        failure.retryAfterSeconds <= MAX_HONOURED_RETRY_AFTER_SECONDS;

      if (!canRetry) return { ok: false, failure };

      // The server said how long. Waiting a self-invented interval is how a
      // client turns one rate limit into several.
      await deps.sleep(
        (failure as Extract<ApiFailure, { kind: "api" }>).retryAfterSeconds! * 1000,
      );
    }
  }

  return {
    async resource(path, method, options) {
      return send(path, method, options) as never;
    },

    async page(path, method, options) {
      const result = await send(path, method, options);
      if (!result.ok) return result;

      const envelope = result.value;
      if (!isCollectionEnvelope(envelope)) {
        return {
          ok: false,
          failure: {
            kind: "transport",
            reason: "unreadable",
            message: `${method.toUpperCase()} ${path} did not answer with a collection.`,
          },
        };
      }

      return { ok: true, value: { items: envelope.data, nextCursor: envelope.nextCursor } } as never;
    },
  };
}

function isCollectionEnvelope(value: unknown): value is { data: unknown[]; nextCursor: string | null } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { data?: unknown; nextCursor?: unknown };
  return (
    Array.isArray(candidate.data) &&
    (candidate.nextCursor === null || typeof candidate.nextCursor === "string")
  );
}

async function readSuccess(response: Response): Promise<ApiResult<unknown>> {
  if (response.status === 204) return { ok: true, value: undefined };

  try {
    return { ok: true, value: await response.json() };
  } catch {
    return {
      ok: false,
      failure: {
        kind: "transport",
        reason: "unreadable",
        message: `${response.status} carried a body that was not JSON.`,
      },
    };
  }
}

async function readFailure(response: Response): Promise<ApiFailure> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      kind: "transport",
      reason: "unreadable",
      message: `${response.status} carried a body that was not JSON.`,
    };
  }

  const error = (body as { error?: { code?: unknown; message?: unknown; details?: unknown } })
    ?.error;

  if (typeof error?.code !== "string" || typeof error.message !== "string") {
    return {
      kind: "transport",
      reason: "unreadable",
      message: `${response.status} did not carry an error from the catalog.`,
    };
  }

  const failure: Extract<ApiFailure, { kind: "api" }> = {
    kind: "api",
    // The catalog is closed, and the generated types say what is in it. A code
    // outside it would be the API changing, which the drift check is for.
    code: error.code as ApiErrorCode,
    status: response.status,
    message: error.message,
  };

  if (Array.isArray(error.details)) {
    failure.details = error.details as Extract<ApiFailure, { kind: "api" }>["details"];
  }

  const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
  if (retryAfter !== undefined) failure.retryAfterSeconds = retryAfter;

  return failure;
}

/** `Retry-After` is either a count of seconds or an HTTP date. Both are answers. */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const when = Date.parse(header);
  if (Number.isNaN(when)) return undefined;

  return Math.max(0, Math.ceil((when - Date.now()) / 1000));
}

function buildUrl(baseUrl: string, path: string, params: unknown, query: unknown): string {
  const filled = path.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = (params as Record<string, unknown> | undefined)?.[name];
    if (value === undefined || value === null) {
      throw new Error(`${path} needs a path parameter '${name}'.`);
    }
    return encodeURIComponent(String(value));
  });

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries((query ?? {}) as Record<string, unknown>)) {
    if (value === undefined || value === null || value === "") continue;
    // The API takes several values for one filter as one comma-separated value.
    search.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }

  const queryString = search.toString();
  return `${baseUrl}${filled}${queryString ? `?${queryString}` : ""}`;
}

let shared: ApiClient | undefined;

/** The client this application makes its calls with. */
export function getApiClient(): ApiClient {
  shared ??= createApiClient();
  return shared;
}
