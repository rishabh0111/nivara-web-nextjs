"use client";

import { useState } from "react";

import { describeError } from "@/api/query";
import { SignInForm } from "@/dashboard/sign-in-form";
import { DashboardNav } from "@/dashboard/dashboard-nav";
import { useDashboardSignedIn } from "@/dashboard/dashboard-session-context";
import { canReadAnalytics } from "@/dashboard/staff-principal";
import { useStaffPrincipalRead } from "@/dashboard/use-staff-principal";
import { Field } from "@/ui/field";
import { ReadView } from "@/ui/read-view";

import type { AnalyticsReport } from "./analytics-report";
import type { AnalyticsCut } from "./analytics-window";
import {
  coveredDays,
  describeCoveredWindow,
  EVER_SINCE,
  type AnalyticsWindow,
} from "./analytics-window";
import { CutTable, describeEmptyCut } from "./cut-table";
import { DayChart } from "./day-chart";
import { HeadlineFigures } from "./headline-figures";
import { useAnalyticsReport } from "./use-analytics-report";
import { useWindowTickets } from "./use-window-tickets";
import { RulingCells } from "@/dashboard/ruling-cells";
import { ScreenSkeleton } from "@/ui/skeleton";
import { ToastProvider } from "@/ui/toast";

/**
 * How the team is doing, over one endpoint.
 *
 * Signed in or not is decided here on every paint, from the token store, as it
 * is everywhere else: nothing authenticated is server-rendered, because the
 * browser holds the credential and calls the API directly.
 */
export function Analytics() {
  const signedIn = useDashboardSignedIn();

  // Still asking the refresh cookie whether there is a session to resume. The
  // sign-in form is not the honest thing to show here: most reloads of this
  // screen are by somebody who never signed out.
  if (signedIn === undefined) return <ScreenSkeleton />;

  return <ToastProvider>{signedIn ? <Permitted /> : <SignInForm />}</ToastProvider>;
}

/**
 * Who may read this, decided before anything is asked for.
 *
 * The queue does not offer the link to a User without the permission, and this
 * is the other half of that: somebody who arrived by typing the address is told
 * plainly rather than shown five requests failing one after another. The API
 * refuses them regardless — this is the interface telling the same truth in
 * words a reader can act on.
 *
 * Nothing is asked of the report while the principal is still in flight, so an
 * admin is never told they may not read a screen that is about to appear.
 */
function Permitted() {
  const { principal, isPending, error } = useStaffPrincipalRead();

  return (
    <>
      <DashboardNav current="analytics" principal={principal} />

      <main className="sheet">
        <div className="mx-auto w-full max-w-[76rem] space-y-8 px-4 pt-5 pb-24 sm:px-6 sm:pt-6 sm:pb-8">
        {/* What the screen answers, before the figures do. "Deflection" is the
            trade's word, and a first-time reader should not have to know it. */}
        <h1 className="text-[1.75rem] leading-tight font-light tracking-[-0.02em]">Analytics</h1>

        {isPending ? (
          <p role="status" className="text-sm text-ink-muted">
            Checking what you can read…
          </p>
        ) : error ? (
          <p role="alert" className="text-sm text-danger">
            {describeError(error)}
          </p>
        ) : canReadAnalytics(principal) ? (
          <Report />
        ) : (
          <p className="text-sm text-ink-muted">
            Analytics is not available to your role. Everything else on the Dashboard is.
          </p>
        )}
        </div>
      </main>
    </>
  );
}

/**
 * The report, and the window it is over.
 *
 * Five questions of the same endpoint — the cohort whole, and each of its four
 * cuts — asked side by side and rendered as they arrive. The window is held here
 * because it is the one thing all five have in common; each cut owns nothing but
 * its own answer.
 */
function Report() {
  const [reading, setReading] = useState<AnalyticsWindow>(EVER_SINCE);

  const overall = useAnalyticsReport(reading);

  return (
    <div className="space-y-8">
      <WindowControls window={reading} onChange={setReading} covering={overall.value} />

      <ReadView read={overall} waiting="Reading the figures…">
        {(report) => (
          <HeadlineFigures metrics={report.overall} ruling={<WindowRuling covering={report} />} />
        )}
      </ReadView>

      <Cut cut="priority" window={reading} />
      <Cut cut="source" window={reading} />
      <Cut cut="assignee" window={reading} />
      <Days window={reading} />
    </div>
  );
}

/**
 * The window, chosen by its two ends.
 *
 * Unchosen is empty rather than the last thirty days written into the controls.
 * That window is the API's own and it owns the rule; a client that pre-filled it
 * would be restating a decision it does not make, and would go on restating the
 * old one after the server changed its mind. What the figures actually cover is
 * said underneath, read off the answer, so the reader is never guessing.
 */
function WindowControls({
  window,
  onChange,
  covering,
}: {
  window: AnalyticsWindow;
  onChange: (window: AnalyticsWindow) => void;
  /** The window the figures on screen were computed over, once they are here. */
  covering: Pick<AnalyticsReport, "from" | "to"> | undefined;
}) {
  // The controls show the window the figures were computed over, read off the
  // answer, until the reader picks their own: so the dates in the fields and
  // the dates the caption prints are always the same two days.
  const covered = covering ? coveredDays(covering.from, covering.to) : { from: "", to: "" };
  // Once the reader has touched either field the window is theirs, and the
  // fields show exactly what they chose (an emptied field stays empty). The
  // first touch keeps the other field's shown day, so nothing moves under them.
  const [touched, setTouched] = useState(false);
  const shown = touched ? window : { from: window.from || covered.from, to: window.to || covered.to };
  const choose = (next: Partial<AnalyticsWindow>) => {
    onChange({ ...shown, ...next });
    setTouched(true);
  };

  return (
    <section aria-label="The window" className="card space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M3 10h18M8 2v4M16 2v4" />
        </svg>
        The window
      </p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:max-w-md">
        <Field
          name="from"
          label="From"
          type="date"
          // The two ends bound each other in the control rather than being
          // caught after the API refuses them: a window that runs backwards is
          // a 400, and a reader should not have to read one to find out.
          max={shown.to || undefined}
          value={shown.from}
          onChange={(event) => choose({ from: event.target.value })}
        />
        <Field
          name="to"
          label="Until"
          type="date"
          min={shown.from || undefined}
          value={shown.to}
          onChange={(event) => choose({ to: event.target.value })}
        />
      </div>

      {covering ? (
        <p className="text-sm text-ink-muted">
          Tickets created {describeCoveredWindow(covering.from, covering.to)}.
        </p>
      ) : null}
    </section>
  );
}

/** One cut of the cohort, asked for and rendered on its own. */
function Cut({ cut, window }: { cut: Exclude<AnalyticsCut, "day">; window: AnalyticsWindow }) {
  const read = useAnalyticsReport(window, cut);

  return (
    <section className="space-y-2">
      <ReadView read={read} waiting="Reading the cut…">
        {(report) =>
          report.groups && report.groups.length > 0 ? (
            <CutTable cut={cut} groups={report.groups} />
          ) : (
            <Nothing>{describeEmptyCut(cut)}</Nothing>
          )
        }
      </ReadView>
    </section>
  );
}

/**
 * The day cut, drawn and written out.
 *
 * The chart is the reading — a trend is what a line is for — and the table is
 * the same numbers for whoever cannot see it, or wants the figure rather than
 * the shape. Screen-reader-only rather than beside the chart, because a second
 * visible copy of the same numbers is a second thing to keep in step by eye.
 */
function Days({ window }: { window: AnalyticsWindow }) {
  const read = useAnalyticsReport(window, "day");

  return (
    <section className="space-y-2">
      <h2 className="text-[0.9375rem] font-medium text-ink">Day by day</h2>

      <ReadView read={read} waiting="Reading the days…">
        {(report) =>
          report.groups && report.groups.length > 0 ? (
            <>
              <DayChart groups={report.groups} />
              <CutTable cut="day" groups={report.groups} className="sr-only" />
            </>
          ) : (
            <Nothing>{describeEmptyCut("day")}</Nothing>
          )
        }
      </ReadView>
    </section>
  );
}

/**
 * A cut with no groups in it, in words that are true of that cut.
 *
 * Not one sentence for all four. The assignee cut leaves deflected and
 * unassigned Tickets out by definition, so it can be empty over a cohort that is
 * not — and telling a reader no Tickets were created would contradict the
 * figures directly above it.
 */
function Nothing({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="text-sm text-ink-muted">
      {children}
    </p>
  );
}

/**
 * What the AI did with the window's tickets, beside the deflection figure: one
 * cell per ticket in its ruling's hue, and the three counts. Read from the
 * tickets themselves; the report has no ruling to give.
 */
function WindowRuling({ covering }: { covering: Pick<AnalyticsReport, "from" | "to"> }) {
  const listed = useWindowTickets(covering);
  if (!listed || listed.tickets.length === 0) return null;

  return (
    <RulingCells
      tickets={listed.tickets}
      more={listed.more}
      label="Tickets in the window, by what the AI did"
    />
  );
}
