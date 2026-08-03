"use client";

import { useId, useState } from "react";

/**
 * What became of something somebody wrote.
 *
 * Two outcomes with different consequences for the box it was typed into, which
 * is why this is a type rather than a boolean: what was said is kept on a
 * refusal and thrown away on success, and getting that backwards either loses
 * somebody's paragraph or invites them to send it twice.
 *
 * Both carry words, because both have something to say and neither can be
 * worded here — "sent" is not the whole truth on a Surface where a reply can
 * land on a different Ticket than the one it addressed.
 */
export type Composed = { said: true; outcome: string } | { said: false; problem: string };

/**
 * What this form looks like, part by part.
 *
 * Every part is nameable because one of the callers is the Widget, and the
 * Widget renders inside a shadow root where the Next application's stylesheet
 * does not reach — a shared control carrying Tailwind classes would arrive on a
 * Tenant's page with no styling at all. The alternative was a second copy of
 * this component for the Widget, which would have been a second copy of the
 * *sequence* below, and the sequence is where the mistakes are.
 */
export type ComposeClasses = {
  form: string;
  label: string;
  help: string;
  box: string;
  problem: string;
  outcome: string;
  action: string;
};

/** The Next application's, which is where three of the four callers render. */
const DEFAULTS: ComposeClasses = {
  form: "space-y-2",
  label: "block text-sm font-semibold tracking-tight text-ink",
  help: "text-sm leading-relaxed text-ink-muted",
  box: "input resize-y leading-relaxed",
  problem: "text-sm font-medium text-danger",
  // Deliberately not hidden when empty: this is a live region, and a region
  // that is `display: none` until it has something to say is a region a screen
  // reader was never watching.
  outcome: "text-sm text-ink-muted",
  action: "btn btn-primary",
};

/**
 * A box somebody writes into, and the one control that sends it.
 *
 * This exists because there are now three of these — a Contact's reply, a
 * User's reply, and an internal Note — and they were three copies of the same
 * fifteen lines. What they have in common is not the shape but the *sequence*,
 * and the sequence is where the mistakes are: guard an empty submit, hold the
 * control while the write is out, throw the text away only if it landed, say
 * what happened either way. Three copies of that is three places for one of
 * those steps to be dropped, and the one that goes missing is never noticed —
 * a box that keeps its text after a successful send looks fine until somebody
 * presses the button twice.
 *
 * What is deliberately *not* shared is what the writes mean. Where a reply
 * lands, whether a Note reaches the Contact, what to say afterwards — those are
 * each Surface's own business, and they arrive here as the words to show. This
 * component knows the sequence and nothing about tickets.
 */
export function Compose({
  label,
  help,
  action,
  acting,
  announcement,
  classes,
  onSubmit,
}: {
  label: string;
  /** What this box is for, when that is not obvious from its label alone. */
  help?: React.ReactNode;
  /** What the button says, worded as the act rather than as "Save". */
  action: string;
  /** What it says while the write is out. */
  acting: string;
  /**
   * Names the live region.
   *
   * Required rather than optional: a screen with three of these has three live
   * regions, and an unnamed one leaves a reader hearing "sent" with no way to
   * know which form said it.
   */
  announcement: string;
  /**
   * Overrides, part by part. Where styling carries meaning — an internal Note
   * is tinted — and where the Next application's stylesheet cannot reach, which
   * is the Widget's shadow root.
   */
  classes?: Partial<ComposeClasses>;
  onSubmit: (said: string) => Promise<Composed>;
}) {
  const style = { ...DEFAULTS, ...classes };

  const fieldId = useId();
  const problemId = `${fieldId}-problem`;
  const helpId = `${fieldId}-help`;

  const [body, setBody] = useState("");
  const [writing, setWriting] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<string | undefined>();

  const described = [help ? helpId : undefined, problem ? problemId : undefined]
    .filter(Boolean)
    .join(" ");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const said = body.trim();
    if (said === "" || writing) return;

    setWriting(true);
    setProblem(undefined);
    setOutcome(undefined);

    const composed = await onSubmit(said);
    setWriting(false);

    if (!composed.said) {
      // Nothing was written, so nothing typed is thrown away.
      setProblem(composed.problem);
      return;
    }

    // Written, so the box is emptied before anything else: leaving the text
    // there after something that landed is an invitation to send it twice.
    setBody("");
    setOutcome(composed.outcome);
  }

  return (
    <form onSubmit={submit} className={style.form}>
      <label htmlFor={fieldId} className={style.label}>
        {label}
      </label>

      {help ? (
        <p id={helpId} className={style.help}>
          {help}
        </p>
      ) : null}

      <textarea
        id={fieldId}
        name="body"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-describedby={described === "" ? undefined : described}
        className={style.box}
      />

      {problem ? (
        <p id={problemId} role="alert" className={style.problem}>
          {problem}
        </p>
      ) : null}

      {/*
        Rendered whether or not there is anything to say, so a screen reader is
        watching this region before the text arrives in it — a live region
        inserted at the same moment as its content is frequently not announced.
      */}
      <p role="status" aria-label={announcement} className={style.outcome}>
        {outcome}
      </p>

      <button type="submit" disabled={writing || body.trim() === ""} className={style.action}>
        {writing ? acting : action}
      </button>
    </form>
  );
}
