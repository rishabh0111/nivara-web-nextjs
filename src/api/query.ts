/**
 * The join between the request layer, which returns failures, and the query
 * cache, which recognises them by their being thrown.
 *
 * The request layer hands back an `ApiResult` on purpose: a refusal from this
 * API is an answer, and a caller that has to remember to catch is a caller that
 * will forget. The cache's contract is the other one. So the conversion happens
 * here, in one place, and the failure itself is carried across intact rather
 * than flattened into a message string a surface would then have to parse back.
 */
import type { ApiResult } from "./client";
import { describeFailure, type ApiFailure } from "./errors";

export class ApiError extends Error {
  readonly failure: ApiFailure;

  constructor(failure: ApiFailure) {
    super(describeFailure(failure));
    this.name = "ApiError";
    this.failure = failure;
  }
}

/** The value, or a throw the query cache will record as this query's error. */
export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new ApiError(result.failure);
  return result.value;
}

/** What went wrong, when a surface has an unknown from the cache and wants words. */
export function describeError(error: unknown): string {
  return error instanceof ApiError
    ? describeFailure(error.failure)
    : "Something went wrong loading this.";
}
