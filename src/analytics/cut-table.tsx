import { TICKET_PRIORITY_LABELS, TICKET_SOURCE_LABELS } from "@/tickets/ticket";

import type { AnalyticsCut } from "./analytics-window";
import type { GroupMetrics } from "./analytics-report";
import {
  DURATION_FIGURES,
  formatCohort,
  formatDuration,
  formatRate,
  RATE_FIGURES,
} from "./figures";
import { NoAnswer } from "./no-answer";

/**
 * One cut of the cohort, as a table.
 *
 * A table rather than a chart for the three cuts that are not a series. Priority
 * has an order but no distance; source and assignee have neither. Drawing them
 * as bars would put them on a shared axis and invite the eye to add them up,
 * which is exactly the reading the assignee cut has to be protected from.
 *
 * The caption is the table's name, so what a cut excludes is announced with it
 * rather than found later — a reader who has already added the groups up has
 * been misled, and a footnote elsewhere is where they find that out too late.
 */
export function CutTable({
  cut,
  groups,
  className,
}: {
  cut: AnalyticsCut;
  groups: GroupMetrics[];
  /** How this table is shown. The day cut's copy is for screen readers only. */
  className?: string;
}) {
  const heading = CUT_HEADINGS[cut];

  return (
    // Focusable, and named. A table this wide scrolls sideways, and a scrolling
    // box that cannot be focused is one a reader without a pointer cannot move —
    // the columns past the edge would simply not exist for them. Naming it is
    // what makes the focus stop mean something when it is announced.
    <div
      className={className ?? "card overflow-x-auto p-4"}
      tabIndex={0}
      role="region"
      aria-label={heading.name}
    >
      <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
        <caption className="pb-3 text-left text-sm text-ink-muted">
          <span className="text-base font-semibold tracking-tight text-ink">{heading.name}</span>
          {heading.excludes ? `: ${heading.excludes}` : null}
        </caption>

        <thead>
          <tr className="border-b border-line-strong">
            <Header>{heading.group}</Header>
            <Header>Tickets</Header>
            {RATE_FIGURES.map((figure) => (
              <Header key={figure.key}>{figure.column}</Header>
            ))}
            {DURATION_FIGURES.map((figure) => (
              <Header key={figure.key}>{figure.column} (p50 / p90)</Header>
            ))}
          </tr>
        </thead>

        <tbody>
          {groups.map((group) => (
            <tr
              key={group.key}
              className="border-b border-line transition-colors duration-150 last:border-0 hover:bg-sunken"
            >
              <th scope="row" className="py-2.5 pr-3 font-semibold whitespace-nowrap">
                {nameGroup(cut, group.key)}
              </th>
              <td className="py-2.5 pr-3 tabular-nums">
                {group.cohortSize.toLocaleString("en-US")}
              </td>

              {RATE_FIGURES.map((figure) => {
                const answer = formatRate(group[figure.key]);

                return (
                  <td key={figure.key} className="py-2.5 pr-3 tabular-nums">
                    {answer === null ? (
                      // The reason is in the row's own count, a column away —
                      // which is beside it for a reader who can see the row and
                      // nowhere at all for one reading a cell at a time.
                      <NoAnswer because={formatCohort(group[figure.key], group.cohortSize)} />
                    ) : (
                      <>
                        {answer}{" "}
                        {/* The count travels with the rate here too. A group of
                            three Tickets and a group of three thousand read
                            identically without it. */}
                        <span className="text-ink-muted">({group[figure.key].count})</span>
                      </>
                    )}
                  </td>
                );
              })}

              {DURATION_FIGURES.map((figure) => {
                const duration = group[figure.key];

                return (
                  <td key={figure.key} className="py-2.5 pr-3 tabular-nums">
                    {duration === null ? (
                      <NoAnswer />
                    ) : (
                      `${formatDuration(duration.p50)} / ${formatDuration(duration.p90)}`
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="py-2 pr-3 text-xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase"
    >
      {children}
    </th>
  );
}

/**
 * What each cut is called, what its groups are, what it leaves out, and what
 * having none of them means.
 *
 * One record rather than a cascade per question. Everything that differs between
 * the four cuts differs here, so adding one is filling a row in and a cut this
 * application cannot describe is a compile error.
 *
 * `labels` is the map the rest of the application already renders these values
 * from, not a second spelling of them — priority and source are closed sets with
 * labels, and a copy here is where the two would drift. An assignee has no map
 * and keeps its id: the report names a User the API has not been asked for, and
 * a name invented for them would be invented.
 *
 * The assignee cut's exclusion is not a caveat about that table — it is the
 * table's definition, and it is why `nothing` says something different there.
 * With every Ticket in the window deflected or unassigned, the cut is empty over
 * a cohort that is not, and saying "no Tickets were created" would contradict
 * the figures sitting directly above it.
 */
const CUT_HEADINGS: Record<
  AnalyticsCut,
  {
    name: string;
    group: string;
    labels?: Record<string, string>;
    excludes?: string;
    nothing: string;
  }
> = {
  priority: {
    name: "By priority",
    group: "Priority",
    labels: TICKET_PRIORITY_LABELS,
    nothing: "No Tickets were created in this window, so there are no priorities to report.",
  },
  source: {
    name: "By source",
    group: "Source",
    labels: TICKET_SOURCE_LABELS,
    nothing: "No Tickets were created in this window, so there are no sources to report.",
  },
  assignee: {
    name: "By assignee",
    group: "User",
    excludes:
      "excludes deflected and unassigned Tickets, so these groups do not sum to the figures above",
    nothing:
      "No Ticket in this window was both assigned and worked by a User, which is what this cut counts. The cohort itself may not be empty.",
  },
  day: {
    name: "Day by day",
    group: "Day",
    nothing: "No Tickets were created in this window, so there are no days to draw.",
  },
};

/** What an empty cut means, which is not the same sentence for all four. */
export function describeEmptyCut(cut: AnalyticsCut): string {
  return CUT_HEADINGS[cut].nothing;
}

function nameGroup(cut: AnalyticsCut, key: string): string {
  return CUT_HEADINGS[cut].labels?.[key] ?? key;
}
