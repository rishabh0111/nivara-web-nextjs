import type { components } from "./generated/openapi";

/**
 * The API's closed catalog, from `GET /meta/error-codes` by way of the OpenAPI
 * document. Branch on this; never on `message`, which is prose and may be
 * reworded without notice.
 */
export type ApiErrorCode = components["schemas"]["ErrorBodyDto"]["code"];

export type ApiErrorDetail = components["schemas"]["ErrorDetailDto"];

/**
 * Why a call did not produce a resource.
 *
 * Two kinds, because they are not the same question. `api` means the API
 * answered and said no, in its own vocabulary. `transport` means it never
 * answered at all — the catalog has nothing to say about that, and inventing a
 * code for it would put a value in the catalog the server never emits.
 */
export type ApiFailure =
  | {
      kind: "api";
      code: ApiErrorCode;
      status: number;
      /** Human-readable and safe to surface. Never branched on. */
      message: string;
      /** One entry per offending field. Present only on `validation_failed`. */
      details?: ApiErrorDetail[];
      /** Seconds the server asked us to wait. Present only on `rate_limited`. */
      retryAfterSeconds?: number;
    }
  | {
      kind: "transport";
      reason: "unreachable" | "unreadable";
      message: string;
    };

export function isApiFailure(failure: ApiFailure, code: ApiErrorCode): boolean {
  return failure.kind === "api" && failure.code === code;
}

/**
 * What to put in front of a person.
 *
 * `not_found` is the API's answer for anything the caller may not see — a
 * record belonging to another tenant is deliberately indistinguishable from one
 * that does not exist. Rendering it as a permission problem would tell someone
 * that a thing exists which they are not allowed to see, which is the one thing
 * the status code is chosen to avoid. So the two codes get different copy, and
 * `not_found` never mentions permission.
 */
export function describeFailure(failure: ApiFailure): string {
  if (failure.kind === "transport") {
    return failure.reason === "unreachable"
      ? "Could not reach the server."
      : "The server's answer could not be read.";
  }

  switch (failure.code) {
    case "not_found":
      return "Not found.";
    case "forbidden":
      return "Your role does not allow this.";
    case "unauthenticated":
      return "Your session has ended. Sign in again.";
    case "rate_limited":
      return failure.retryAfterSeconds
        ? `Too many requests. Try again in ${failure.retryAfterSeconds}s.`
        : "Too many requests. Try again shortly.";
    case "validation_failed":
      return failure.details?.length
        ? failure.details.map((detail) => `${detail.field}: ${detail.issue}`).join("; ")
        : failure.message;
    case "integration_dormant":
      // Not a fault and not a permission problem — the capability is absent in
      // this deployment and no retry produces it. Hide the affordance.
      return "That option is not available in this deployment.";
    case "conflict":
      return "That has changed since you loaded it. Reload and try again.";
    case "internal_error":
      return "Something went wrong on the server.";
    default:
      return failure.message;
  }
}
