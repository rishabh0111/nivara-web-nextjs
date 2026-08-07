/**
 * What the Snippet tells the Widget.
 *
 * One attribute, and deliberately only one: the Tenant. It is public — it is
 * sitting in the page source of the Tenant's own site — and it grants nothing,
 * because the API refuses the mint unless the browser-set origin is on that
 * Tenant's allowlist. Anything else configurable here would be a second place
 * for a Tenant's install to be wrong.
 */

export type WidgetConfig = {
  /** Which Tenant's Widget this is. A routing input, never an authority claim. */
  tenantId: string;
};

const TENANT_ATTRIBUTE = "data-tenant-id";

export function readWidgetConfig(script: HTMLScriptElement | null): WidgetConfig {
  if (!script) {
    throw new Error(
      "The Nivara widget could not find its own script tag. Load it with a plain <script src> rather than by evaluating it.",
    );
  }

  const tenantId = script.getAttribute(TENANT_ATTRIBUTE)?.trim();

  if (!tenantId) {
    throw new Error(
      `The Nivara widget script tag needs a ${TENANT_ATTRIBUTE} attribute naming the workspace it belongs to.`,
    );
  }

  return { tenantId };
}
