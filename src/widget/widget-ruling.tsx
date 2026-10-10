/**
 * The ruling, at the size of one turn in a conversation.
 *
 * The same three parts as everywhere else in the product (Answer, Ask, Hand
 * over, always in that order) under each thing Automation did, so a Visitor
 * sees which of the three happened rather than reading a notice that says so.
 * It is the Dashboard's strip in this Surface's own classes, because the
 * application's stylesheet does not reach into the shadow root.
 *
 * Four states, as the system defines them: one part lit; `reading` while the
 * Turn is still running (nothing decided yet, so nothing lit); and `off` when
 * the Turn could not reach a ruling at all.
 *
 * The strip is hidden from assistive technology and a sentence says the same
 * thing, because three words read in a row ("Answer Ask Hand over") do not say
 * which one happened.
 */
import { RULING_LABELS, RULINGS, type Ruling } from "@/tickets/ruling";

export type TurnCall = { ruling: Ruling } | { reading: true } | { off: true };

const SPOKEN: Record<Ruling, string> = {
  answer: "Automation answered.",
  clarify: "Automation asked a question.",
  escalate: "Automation handed this to a person.",
};

export function TurnRuling({ call }: { call: TurnCall }) {
  const lit = "ruling" in call ? call.ruling : undefined;

  return (
    <div className="nvw-call">
      <span
        className="nvw-ruling"
        aria-hidden="true"
        data-reading={"reading" in call ? "" : undefined}
        data-off={"off" in call ? "" : undefined}
      >
        {RULINGS.map((one) => (
          <span key={one} data-lit={one === lit ? one : undefined}>
            {RULING_LABELS[one]}
          </span>
        ))}
      </span>
      {lit ? <span className="nvw-only-spoken">{SPOKEN[lit]}</span> : null}
    </div>
  );
}

/**
 * The product mark: a speech bubble cut from the accent square. Decorative
 * wherever it appears, because a word always stands beside it.
 */
export function Mark() {
  return (
    <svg className="nvw-mark" aria-hidden="true" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" className="nvw-mark-field" />
      <path
        d="M25 18.5a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4.5V9.5A2.5 2.5 0 0 1 9 7h13.5A2.5 2.5 0 0 1 25 9.5Z"
        className="nvw-mark-bubble"
      />
    </svg>
  );
}

/** The mark's bubble alone, for the Launcher, which is already on the accent. */
export function Bubble() {
  return (
    <svg className="nvw-icon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 14a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg className="nvw-icon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg className="nvw-icon nvw-icon-small" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function NextIcon() {
  return (
    <svg className="nvw-icon nvw-icon-small" aria-hidden="true" viewBox="0 0 24 24">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
