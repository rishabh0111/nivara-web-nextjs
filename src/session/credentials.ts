/**
 * What a password sign-in is made of, on the Surfaces that have one.
 *
 * The Portal and the Dashboard sign in the same way against different routes:
 * `(tenantId, email)` names the account and the password proves it. The tenant
 * is a routing input to that lookup and nothing else — it is never held after
 * the credential is minted, never sent on a later request, and never put in a
 * URL, because the API resolves it from the credential every time.
 */
export type PasswordCredentials = { tenantId: string; email: string; password: string };
