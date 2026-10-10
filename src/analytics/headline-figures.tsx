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
 * The figures over the whole cohort: deflection as the headline, set as type
 * beside the ruling (`ruling`, drawn by the caller), and the rest as one plain
 * row of label and value.
 *
 * Deflection leads because it is the AI's figure — the share nobody touched —
 * and it carries the answered green, the same outcome each queue row marks.
 *
 * Every rate carries the count it rests on, always and not on request. 26% of
 * four Tickets and 26% of four thousand are the same percentage and not the same
 * claim, and a reader shown only the percentage cannot tell which they have.
 *
 * Description lists: the pairing of a name to a figure is what a definition
 * list is, and it is what makes each read as one thing.
 */
export function HeadlineFigures({
  metrics,
  ruling,
}: {
  metrics: Metrics;
  /** What the AI did with the window's tickets, beside the headline. */
  ruling?: React.ReactNode;
}) {
  const [deflection, ...rates] = RATE_FIGURES;

  return (
    <section aria-label="Headline figures" className="space-y-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-end md:gap-10">
        {deflection ? (
          <dl>
            <div>
              <dt className="text-sm text-ink-muted">{deflection.name}</dt>
              <dd className="mt-1 space-y-1">
                <p className="text-[2.75rem] leading-none font-light tracking-[-0.03em] text-go tabular-nums">
                  {formatRate(metrics[deflection.key]) ?? <NoAnswer />}
                </p>
                <p className="text-sm text-ink-muted">
                  {formatCohort(metrics[deflection.key], metrics.cohortSize)}
                </p>
              </dd>
            </div>
          </dl>
        ) : null}

        {ruling}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 sm:grid-cols-3 lg:grid-cols-5">
        {rates.map((figure) => (
          <Figure key={figure.key} name={figure.name}>
            <Value>{formatRate(metrics[figure.key]) ?? <NoAnswer />}</Value>
            <Beneath>{formatCohort(metrics[figure.key], metrics.cohortSize)}</Beneath>
          </Figure>
        ))}

        {DURATION_FIGURES.map((figure) => {
          const duration = metrics[figure.key];

          return (
            <Figure key={figure.key} name={figure.name}>
              {duration === null ? (
                <>
                  <Value>
                    <NoAnswer />
                  </Value>
                  <Beneath>{figure.unmeasured}</Beneath>
                </>
              ) : (
                <>
                  {/* Both percentiles: the typical case and the bad case. */}
                  <Value>
                    <span>{formatDuration(duration.p50)}</span> <Unit>median</Unit>
                  </Value>
                  <Beneath>
                    <span>{formatDuration(duration.p90)}</span> at the 90th percentile
                  </Beneath>
                </>
              )}
            </Figure>
          );
        })}
      </dl>
    </section>
  );
}

function Figure({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.8125rem] text-ink-muted">{name}</dt>
      <dd className="mt-1 space-y-0.5">{children}</dd>
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <p className="text-xl leading-tight font-normal text-ink tabular-nums">{children}</p>;
}

function Unit({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.8125rem] font-normal text-ink-muted">{children}</span>;
}

function Beneath({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.8125rem] text-ink-muted">{children}</p>;
}
