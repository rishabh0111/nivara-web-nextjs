/**
 * The one input that points this application at `nivara-ai`.
 *
 * `NEXT_PUBLIC_AI_URL` is deliberately its own variable rather than a second
 * thing `NEXT_PUBLIC_API_URL` configures — `nivara-ai` is a different backend
 * with a name of its own, exactly as `src/api/ai-seam.ts` said it would be
 * before it existed. Optional at the type level: a deployment that has not
 * stood `nivara-ai` up yet builds and runs with the Widget's AI turn simply
 * never called.
 */

export type AiEndpoints = {
  /** Base for every HTTP call to `nivara-ai`. No trailing slash. */
  httpBaseUrl: string;
};

export function resolveAiEndpoints(rawUrl: string | undefined): AiEndpoints | undefined {
  const value = rawUrl?.trim();

  if (!value) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_AI_URL must be an absolute URL, such as https://nivara-ai.onrender.com. Received: ${value}`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `NEXT_PUBLIC_AI_URL must use http or https. Received: ${value}`,
    );
  }

  return { httpBaseUrl: value.replace(/\/+$/, "") };
}

/**
 * The endpoints `nivara-ai` is reachable at, or `undefined` where it is not
 * configured.
 *
 * `process.env.NEXT_PUBLIC_AI_URL` is referenced statically so Next.js inlines
 * it into the browser bundle, the same discipline `getApiEndpoints` follows.
 */
export function getAiEndpoints(): AiEndpoints | undefined {
  return resolveAiEndpoints(process.env.NEXT_PUBLIC_AI_URL);
}
