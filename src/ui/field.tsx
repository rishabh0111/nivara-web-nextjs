"use client";

import { useId } from "react";

/**
 * A labelled input.
 *
 * The label is tied to the input by a generated id rather than by wrapping,
 * and the hint by `aria-describedby`, so a screen reader reads the same thing a
 * sighted reader sees beneath the box. Written once because every sign-in form
 * on every Surface needs exactly this and a second copy is where the two drift.
 */
export function Field({
  name,
  label,
  hint,
  ...input
}: { name: string; label: string; hint?: string } & React.ComponentProps<"input">) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold tracking-tight text-ink">
        {label}
      </label>
      <input
        {...input}
        id={id}
        name={name}
        aria-describedby={hint ? hintId : undefined}
        className="input"
      />
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
