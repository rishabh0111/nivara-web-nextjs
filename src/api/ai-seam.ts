/**
 * The seam for `nivara-ai`.
 *
 * One place in the client where an AI chat call will one day be made. It is
 * empty on purpose: no stub, no mock, no toggle, no types. `nivara-ai` does not
 * exist yet, and anything written here before it does would be a guess that
 * later reads as a contract.
 *
 * A seam is a decision deferred, not a feature half-built. When the service
 * exists, its call goes here, generated from its document the way this API's
 * calls are generated from this API's document — and `NEXT_PUBLIC_API_URL`
 * stays the one variable that points at *this* API, because that service is a
 * different backend and will say so with a name of its own.
 *
 * Nothing imports this file, and until then, nothing should.
 */

export {};
