/**
 * The ruling, drawn: Answer, Ask, Hand over, in that order, one lit.
 *
 * The same strip the product page shows on its hero, at two sizes. The strip
 * itself is hidden from assistive technology and a sentence says the same
 * thing in words, because three spans read aloud in a row ("Answer Ask Hand
 * over") say nothing about which one happened.
 */
import { RULING_LABELS, RULING_OUTCOMES, RULING_SOURCE, RULINGS, type Ruling } from "./ruling";

/** The full strip, for one Ticket's own screen. */
export function RulingStrip({ ruling }: { ruling: Ruling | undefined }) {
  return (
    <>
      <div className="ruling" aria-hidden="true">
        {RULINGS.map((one) => (
          <span key={one} data-lit={one === ruling ? one : undefined}>
            {RULING_LABELS[one]}
          </span>
        ))}
      </div>
      <p className="sr-only">
        {ruling ? `AI ruling: ${RULING_OUTCOMES[ruling]}.` : "No AI ruling on this ticket."}
      </p>
    </>
  );
}


/**
 * The strip at the size of a queue row: three segments and the outcome's word.
 * The word stays in ink; the lit segment carries the hue, so a row that also
 * says "Needs a person" has one coloured mark, not two.
 *
 * `reading` while the thread is still being read, so an empty strip is never
 * mistaken for "the AI did nothing" before the answer is in.
 */
export function MiniRuling({
  ruling,
  reading = false,
  none = "No AI turn",
}: {
  ruling: Ruling | undefined;
  reading?: boolean;
  /** What a row with no ruling says. */
  none?: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2" title={RULING_SOURCE}>
      <span className="mini-ruling" aria-hidden="true" data-reading={reading ? "" : undefined}>
        {RULINGS.map((one) => (
          <i key={one} data-lit={!reading && one === ruling ? one : undefined} />
        ))}
      </span>
      {reading ? (
        <span className="sr-only">Reading the AI ruling</span>
      ) : ruling ? (
        <span className="truncate font-medium text-ink">
          {RULING_OUTCOMES[ruling]}
        </span>
      ) : (
        <span className="truncate text-ink-muted">{none}</span>
      )}
    </span>
  );
}
