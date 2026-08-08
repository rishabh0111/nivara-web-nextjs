import type { GroupMetrics } from "./analytics-report";
import { RATE_FIGURES } from "./figures";

/**
 * The day cut, as a line chart.
 *
 * The only cut that is a true series: days are ordered *and* evenly spaced, so
 * the slope between two of them means something. That is what a line claims, and
 * it is why the other three cuts are tables — a line over "portal, widget,
 * slack" would be drawing a trend through an alphabet.
 *
 * A day nobody raised anything on has no rate at all, and the line breaks there
 * rather than dropping to the floor. Plotting an unanswered figure as zero would
 * draw a collapse that never happened, which is the same lie the tiles refuse to
 * tell with a "0%" — told in a shape that is harder to argue with.
 *
 * Identity is never colour alone: every series is named in the legend and again
 * at the end of its own line, which is also what the palette's light-mode
 * contrast requires.
 */
export function DayChart({ groups }: { groups: GroupMetrics[] }) {
  const days = [...groups].sort((a, b) => a.key.localeCompare(b.key));

  const series = RATE_FIGURES.map((figure, index) => ({
    ...figure,
    colour: `var(--series-${index + 1})`,
    values: days.map((day) => day[figure.key].rate),
  }));

  const x = (index: number) =>
    days.length > 1 ? LEFT + (index * PLOT_WIDTH) / (days.length - 1) : LEFT + PLOT_WIDTH / 2;
  const y = (rate: number) => TOP + (1 - rate) * PLOT_HEIGHT;

  const labels = spreadOut(
    series.map((line) => {
      const last = lastAnswered(line.values);
      return last === undefined ? null : { y: y(line.values[last]!), x: x(last) };
    }),
  );

  return (
    <div className="space-y-3">
      <svg
        role="img"
        aria-label={`Rates by day, ${shortDay(days[0]?.key)} to ${shortDay(days.at(-1)?.key)}. ${series
          .map((line) => line.name)
          .join(", ")}. The same figures are in the table below.`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
      >
        {/* Recessive, and behind everything: a grid is for reading a value off,
            not for looking at. */}
        {[0, 0.25, 0.5, 0.75, 1].map((rate) => (
          <g key={rate}>
            <line
              x1={LEFT}
              x2={LEFT + PLOT_WIDTH}
              y1={y(rate)}
              y2={y(rate)}
              className="stroke-line"
              strokeWidth={1}
            />
            <text
              x={LEFT - 8}
              y={y(rate) + 4}
              textAnchor="end"
              className="fill-ink-faint text-[20px] sm:text-[11px]"
            >
              {rate * 100}%
            </text>
          </g>
        ))}

        {/* The ends of the window, named. Every day in between would be a wall of
            text at a month's width, and the table underneath has them all. */}
        {days.length > 0 ? (
          <>
            <text x={LEFT} y={HEIGHT - 8} className="fill-ink-faint text-[20px] sm:text-[11px]">
              {shortDay(days[0]!.key)}
            </text>
            {days.length > 1 ? (
              <text
                x={LEFT + PLOT_WIDTH}
                y={HEIGHT - 8}
                textAnchor="end"
                className="fill-ink-faint text-[20px] sm:text-[11px]"
              >
                {shortDay(days.at(-1)!.key)}
              </text>
            ) : null}
          </>
        ) : null}

        {series.map((line, index) => {
          const label = labels[index];

          return (
            <g key={line.key}>
              <path
                data-series={line.key}
                d={trace(line.values, x, y)}
                fill="none"
                stroke={line.colour}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* A day standing on its own between two days with no answer is a
                  point, not a line, and a path through one point draws nothing. */}
              {line.values.map((rate, day) =>
                rate !== null && alone(line.values, day) ? (
                  <circle key={day} cx={x(day)} cy={y(rate)} r={4} fill={line.colour} />
                ) : null,
              )}

              {label ? (
                <g>
                  <circle cx={label.x + 10} cy={label.y} r={3} fill={line.colour} />
                  {/* The words are ink, not the series colour — the dot beside
                      them carries the identity, and text that wore it would be
                      text chosen for hue rather than for legibility. */}
                  <text
                    x={label.x + 18}
                    y={label.y + 4}
                    className="fill-ink-muted text-[20px] sm:text-[11px]"
                  >
                    {line.column}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        {series.map((line) => (
          <li key={line.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: line.colour }}
            />
            {line.column}
          </li>
        ))}
      </ul>
    </div>
  );
}

const WIDTH = 720;
const HEIGHT = 260;
const LEFT = 44;
const TOP = 12;
/** Room on the right for the labels at the ends of the lines. */
const PLOT_WIDTH = WIDTH - LEFT - 148;
const PLOT_HEIGHT = HEIGHT - TOP - 36;

/**
 * One series, as a path that breaks over every day with no answer.
 *
 * Each run of answered days is its own `M`-started subpath, so the gap is a gap
 * rather than a straight line drawn across it. A line joining the day before to
 * the day after would be an interpolation nobody measured.
 */
function trace(
  values: (number | null)[],
  x: (index: number) => number,
  y: (rate: number) => number,
): string {
  let path = "";
  let drawing = false;

  values.forEach((rate, index) => {
    if (rate === null) {
      drawing = false;
      return;
    }

    path += `${drawing ? "L" : "M"}${x(index).toFixed(1)} ${y(rate).toFixed(1)} `;
    drawing = true;
  });

  return path.trim();
}

/** Whether a day's answer has no answered day beside it to be joined to. */
function alone(values: (number | null)[], day: number): boolean {
  return (values[day - 1] ?? null) === null && (values[day + 1] ?? null) === null;
}

function lastAnswered(values: (number | null)[]): number | undefined {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) return index;
  }
  return undefined;
}

/** Where one line's label sits: the end of the line, and beside it. */
type LabelAt = { x: number; y: number };

/** Enough room for one line of text at this size. */
const LABEL_GAP = 14;

/**
 * The labels at the ends of the lines, pushed apart where they would overlap.
 *
 * Two series that finish the window at the same rate finish at the same pixel,
 * and their labels would be drawn on top of each other — which is the one place
 * a direct label is worse than none. They are nudged apart in order, so the
 * label still points at the line it belongs to and the ordering on the right
 * matches the ordering of the lines.
 */
function spreadOut(labels: (LabelAt | null)[]): (LabelAt | null)[] {
  const placed = labels
    .map((label, index) => ({ label, index }))
    .filter((held): held is { label: LabelAt; index: number } => held.label !== null)
    .sort((a, b) => a.label.y - b.label.y);

  let floor = -Infinity;
  const spread = [...labels];

  for (const held of placed) {
    const y = Math.max(held.label.y, floor + LABEL_GAP);
    floor = y;
    spread[held.index] = { ...held.label, y };
  }

  // Four lines that all finish at the floor of the chart would stack their
  // labels off the bottom of it. The whole stack is lifted back inside rather
  // than the last one being clipped, so they stay in the order the lines are in.
  const overflow = floor - (TOP + PLOT_HEIGHT);
  if (overflow <= 0) return spread;

  const lift = Math.min(overflow, (spread[placed[0]!.index]?.y ?? 0) - TOP);

  return spread.map((label) => (label === null ? null : { ...label, y: label.y - lift }));
}

/** `2026-07-01` as the reader's own 1 Jul, rather than as whatever UTC calls it. */
function shortDay(key: string | undefined): string {
  if (!key) return "";

  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
