/**
 * The generated document, read as types.
 *
 * Every call site names a path and a method that exist in the OpenAPI document,
 * and gets its query, path parameters, body and response shape from the
 * document rather than from a hand-written declaration that could disagree with
 * it. A query parameter the API does not define is a compile error, which is
 * the point: unknown parameters are a 400, so a filter is added deliberately or
 * not at all.
 */
import type { paths } from "./generated/openapi";

export type ApiPath = keyof paths;

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/** The methods the document actually defines for a path. */
export type MethodOn<P extends ApiPath> = {
  [M in HttpMethod]: paths[P][M & keyof paths[P]] extends { responses: unknown } ? M : never;
}[HttpMethod];

export type Operation<P extends ApiPath, M> = paths[P][M & keyof paths[P]];

type JsonOf<T> = T extends { content: { "application/json": infer B } } ? B : never;

/** The 2xx body. `204` carries nothing, and is typed as such rather than as `any`. */
export type SuccessOf<O> = O extends { responses: infer R }
  ? 200 extends keyof R
    ? JsonOf<R[200]>
    : 201 extends keyof R
      ? JsonOf<R[201]>
      : 204 extends keyof R
        ? undefined
        : never
  : never;

export type QueryOf<O> = O extends { parameters: { query?: infer Q } }
  ? Exclude<Q, undefined>
  : never;

export type PathParamsOf<O> = O extends { parameters: { path?: infer P } }
  ? Exclude<P, undefined>
  : never;

export type BodyOf<O> = O extends { requestBody?: infer B } ? JsonOf<Exclude<B, undefined>> : never;

/** A collection response, as the API shapes them: the page and a cursor, no total. */
export type CollectionOf<O> =
  SuccessOf<O> extends { data: (infer Item)[]; nextCursor: string | null } ? Item : never;
