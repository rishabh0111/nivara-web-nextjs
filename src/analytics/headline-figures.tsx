import type { Metrics } from "./analytics-report";
import {
  DURATION_FIGURES,
  formatCohort,
  formatDuration,
  formatRate,
  RATE_FIGURES,
} from "./figures";
import { NoAnswer } from "./no-answer";

/**
 * The six figures over the whole cohort, as tiles.
 *
 * A tile rather than a chart because each one is a single number with nothing to
 * compare it against — a bar of length one is a number drawn badly.
 *
 * Every rate carries the count it rests on, always and not on request. 26% of
 * four Tickets and 26% of four thousand are the same percentage and not the same
 * claim, and a reader shown only the percentage cannot tell which they have.
 *
 * A description list rather than a grid of divs: the pairing of a name to a
 * figure is what a definition list is, and it is what makes each tile read as
 * one thing rather than as two loose pieces of text.
 */
export function HeadlineFigures({ metrics }: { metrics: Metrics }) {
  return (
    <section aria-label="Headline figures" className="space-y-3">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RATE_FIGURES.map((figure) => (
          <Tile key={figure.key} name={figure.name}>
            {/* The explanation is underneath either way. Where there is an
                answer it is the count the rate rests on; where there is none it
                is why — and both are the same sentence about the same cohort. */}
            <Value>{formatRate(metrics[figure.key]) ?? <NoAnswer />}</Value>
            <Beneath>{formatCohort(metrics[figure.key], metrics.cohortSize)}</Beneath>
          </Tile>
        ))}

        {DURATION_FIGURES.map((figure) => {
          const duration = metrics[figure.key];

          return (
            <Tile key={figure.key} name={figure.name}>
              {duration === null ? (
                <>
                  <Value>
                    <NoAnswer />
                  </Value>
                  <Beneath>{figure.unmeasured}</Beneath>
                </>
              ) : (
                <>
                  {/* Both percentiles, because the typical case and the bad case
                      are the two things anyone is asking about — a median alone
                      hides the tail it was computed to summarise. */}
                  <Value>
                    <span>{formatDuration(duration.p50)}</span> <Unit>median</Unit>
                  </Value>
                  <Beneath>
                    <span>{formatDuration(duration.p90)}</span> at the 90th percentile
                  </Beneath>
                </>
              )}
            </Tile>
          );
        })}
      </dl>
    </section>
  );
}

function Tile({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 transition-shadow duration-200 hover:shadow-lift-high">
      <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{name}</dt>
      <dd className="mt-2 space-y-1">{children}</dd>
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-3xl leading-none font-bold tracking-tight text-ink tabular-nums">
      {children}
    </p>
  );
}

function Unit({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-normal text-ink-muted">{children}</span>;
}

function Beneath({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}
