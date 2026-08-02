"use client";

/**
 * The form both password Surfaces sign in with.
 *
 * Workspace, address, password — the same three fields against two different
 * routes. What differs between the Portal's and the Dashboard's is the words:
 * what the workspace field means to that reader, and what a refusal is called.
 * The behaviour does not differ, and the part that must not differ is the
 * refusal: one message for every reason, so the form cannot be used to learn
 * which accounts exist.
 */
import { useId, useState } from "react";

import type { ApiResult } from "@/api/client";
import type { PasswordCredentials } from "@/session/credentials";
import { Field } from "@/ui/field";

export function PasswordSignInForm({
  workspaceHint,
  refused,
  standing,
  signIn,
}: {
  /** What the workspace field means on this Surface. */
  workspaceHint: string;
  /** The one message every refusal gets, in this Surface's words. */
  refused: string;
  /**
   * What signing in here gets you, in this Surface's words.
   *
   * Two Surfaces share this form and a reader arriving at either sees the same
   * three fields. This is the line that tells them which door they are at —
   * "Sign in" alone does not, and a Contact who has landed on the staff
   * Dashboard should find that out before they try their password on it.
   */
  standing: string;
  signIn: (credentials: PasswordCredentials) => Promise<ApiResult<unknown>>;
}) {
  const formId = useId();

  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);

    setSubmitting(true);
    setProblem(undefined);

    // The tenant is read off the form and handed straight to the lookup. It is
    // not kept here, so there is nothing to clear and nothing to send again.
    const outcome = await signIn({
      tenantId: String(fields.get("tenantId") ?? ""),
      email: String(fields.get("email") ?? ""),
      password: String(fields.get("password") ?? ""),
    });

    setSubmitting(false);
    if (!outcome.ok) setProblem(refused);
  }

  return (
    // Centred in the viewport rather than sitting at the top of a page that is
    // otherwise empty. There is nothing else on this screen — no queue behind
    // it, no navigation — so anything other than the middle reads as a page
    // that failed to finish loading.
    <div className="flex min-h-[75dvh] items-center justify-center py-8">
      <div className="animate-rise w-full max-w-sm">
        <div className="mb-7 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-lift"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
            </svg>
          </span>

          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{standing}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="card space-y-4 p-6"
          aria-describedby={problem ? formId : undefined}
        >
          <Field name="tenantId" label="Workspace ID" hint={workspaceHint} required />
          <Field name="email" label="Email" type="email" autoComplete="email" required />
          <Field
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
          />

          {problem ? (
            <p
              id={formId}
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-wash px-3 py-2.5 text-sm leading-relaxed text-danger"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="mt-0.5 size-4 shrink-0"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5M12 16h.01" />
              </svg>
              {problem}
            </p>
          ) : null}

          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
