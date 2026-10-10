/**
 * What the staff side is, shown rather than said: the three ways a question
 * ends, each as the ruling strip a queue row will carry.
 *
 * On the accent stage with the mark's tail, the one onboarding state the
 * design system lets the app use it on. The three lines are the product page's
 * own words for the three endings; the strips are the same component the
 * queue and the ticket view render.
 */
import { RULING_LABELS, RULING_OUTCOMES, RULINGS, type Ruling } from "@/tickets/ruling";
import { RulingStrip } from "@/tickets/ruling-strip";

const ENDINGS: Record<Ruling, string> = {
  answer: "It answers what the help centre covers.",
  clarify: "When a question could mean two things, it asks.",
  escalate: "Anything else goes to a person, with what it found.",
};

export function SignInStage() {
  return (
    <section aria-labelledby="stage-heading" className="stage">
      <h2
        id="stage-heading"
        className="max-w-[22ch] text-[1.75rem] leading-[1.1] font-light tracking-[-0.025em] xl:text-[2.25rem]"
      >
        Every question ends one of three ways.
      </h2>

      <ul className="mt-6 grid gap-3 rounded-[16px] bg-sheet p-4 text-ink sm:p-5" data-ui="">
        {RULINGS.map((ruling) => (
          <li key={ruling} className="grid gap-2">
            <p className="text-sm">
              <span className="font-medium">{RULING_OUTCOMES[ruling]}.</span>{" "}
              <span className="text-ink-muted">{ENDINGS[ruling]}</span>
            </p>
            <RulingStrip ruling={ruling} />
          </li>
        ))}
      </ul>

      <p className="mt-4 max-w-[48ch] text-sm leading-relaxed">
        Each ticket in the queue carries the strip, so what the AI settled and what is waiting on
        a person read at a glance.
      </p>
    </section>
  );
}

/**
 * The same three endings as one compact strip, each part lit in its own hue:
 * what a phone shows under the heading, above the fold, where the full stage
 * would land below the form.
 */
export function SignInBrief() {
  return (
    <>
      <div className="ruling text-[0.8125rem]" aria-hidden="true">
        {RULINGS.map((ruling) => (
          <span key={ruling} data-lit={ruling} className="!min-h-8">
            {RULING_LABELS[ruling]}
          </span>
        ))}
      </div>
      <p className="sr-only">Every question ends one of three ways: answer, ask or hand over.</p>
    </>
  );
}
