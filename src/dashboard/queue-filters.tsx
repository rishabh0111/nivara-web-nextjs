"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  TICKET_PRIORITY_LABELS,
  TICKET_SOURCE_LABELS,
  TICKET_STATE_LABELS,
} from "@/tickets/ticket";
import { Field } from "@/ui/field";

import { useKnownAssignees } from "./known-assignees";
import type { AssigneeFilter, QueueSlice, QueueSort } from "./queue-slice";
import { EVERYTHING, isNarrowed, toSortParameter } from "./queue-slice";
import type { StaffPrincipal } from "./staff-principal";

/**
 * The controls that narrow the queue.
 *
 * Every control edits the slice and nothing else — there is no apply step,
 * because a filter that has been chosen but not yet submitted is a screen that
 * disagrees with itself. The slice is lifted to the queue, which is what turns
 * it into a request.
 *
 * State, priority and source are checkbox groups rather than single selects:
 * the API takes several values for each, and an interface that allowed only one
 * would hide a question the server can answer. Assignee is radios, because its
 * options are three mutually exclusive *questions* rather than three values.
 */
export function QueueFilters({
  slice,
  onChange,
  principal,
}: {
  slice: QueueSlice;
  onChange: (slice: QueueSlice) => void;
  /** Whoever is signed in, so "assigned to me" can name them. Absent until known. */
  principal: StaffPrincipal | undefined;
}) {
  const narrowed = isNarrowed(slice);

  return (
    <section aria-label="Filter and sort tickets" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sunken px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 text-ink-muted"
          >
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          Filters
        </p>

        {/* Absent rather than disabled when there is nothing to clear: a control
            that never does anything is one more thing to tab past. */}
        {narrowed ? (
          <button
            type="button"
            onClick={() => onChange({ ...EVERYTHING, sort: slice.sort })}
            className="link text-sm"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="space-y-5 p-4">
        <ChoiceGroup
          legend="State"
          labels={TICKET_STATE_LABELS}
          chosen={slice.state}
          onChange={(state) => onChange({ ...slice, state })}
        />
        <ChoiceGroup
          legend="Priority"
          labels={TICKET_PRIORITY_LABELS}
          chosen={slice.priority}
          onChange={(priority) => onChange({ ...slice, priority })}
        />
        <ChoiceGroup
          legend="Source"
          labels={TICKET_SOURCE_LABELS}
          chosen={slice.source}
          onChange={(source) => onChange({ ...slice, source })}
        />

        <AssigneeChoice
          assignee={slice.assignee}
          principal={principal}
          onChange={(assignee) => onChange({ ...slice, assignee })}
        />

        {/* The typed and dated filters, kept below the switches and behind a
            rule. They are the ones reached for rarely and read slowly, and
            mixing them into the pills above would slow down the ones that are
            one click. */}
        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <SettledField
            name="contactId"
            label="Contact"
            hint="The id of the Contact who raised them."
            value={slice.contactId}
            onSettled={(contactId) => onChange({ ...slice, contactId })}
          />
          <Field
            name="createdAfter"
            label="Created from"
            type="date"
            value={slice.createdAfter}
            onChange={(event) => onChange({ ...slice, createdAfter: event.target.value })}
          />
          <Field
            name="createdBefore"
            label="Created until"
            type="date"
            value={slice.createdBefore}
            onChange={(event) => onChange({ ...slice, createdBefore: event.target.value })}
          />
          <SortChoice sort={slice.sort} onChange={(sort) => onChange({ ...slice, sort })} />
        </div>
      </div>
    </section>
  );
}

/** Long enough that a typed id is one request, short enough to feel immediate. */
const SETTLE_MS = 300;

/**
 * A text filter that reaches the slice once typing stops.
 *
 * The checkboxes and the radios change the slice the moment they are touched,
 * because one click is one whole answer. An id is not: `con_2` typed a letter at
 * a time is five slices, five queries and five requests for four questions
 * nobody asked. So the field holds what is being typed and hands it over when it
 * settles — which is a delay, not an apply step: nothing is waiting to be
 * pressed and the reader is never looking at a filter they have not got.
 */
function SettledField({
  value,
  onSettled,
  ...field
}: { value: string; onSettled: (value: string) => void } & Omit<
  React.ComponentProps<typeof Field>,
  "value" | "onChange"
>) {
  const [typed, setTyped] = useState(value);
  const [held, setHeld] = useState(value);
  const settle = useRef(onSettled);
  settle.current = onSettled;

  // The slice can also change from somewhere else — Clear filters, and later a
  // restored URL. When it does, the field shows what the slice says rather than
  // what somebody last typed into it.
  if (value !== held) {
    setHeld(value);
    setTyped(value);
  }

  useEffect(() => {
    if (typed === value) return;

    const timer = setTimeout(() => settle.current(typed), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [typed, value]);

  return <Field {...field} value={typed} onChange={(event) => setTyped(event.target.value)} />;
}

/**
 * One filter over a closed set of values, several of which may be chosen.
 *
 * The labels are the same `Record` keyed by the generated union that the rest of
 * the application renders from, so a value the API adds and this map has not is
 * a compile error rather than a filter nobody can reach.
 */
function ChoiceGroup<Value extends string>({
  legend,
  labels,
  chosen,
  onChange,
}: {
  legend: string;
  labels: Record<Value, string>;
  chosen: Value[];
  onChange: (chosen: Value[]) => void;
}) {
  const values = Object.keys(labels) as Value[];

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {legend}
      </legend>
      {/* Wrapped rather than stacked. Three columns of five stacked checkboxes
          is a wall a reader has to scan; the same values as pills read as a row
          of switches, and the ones that are on are visible from across it. */}
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <label key={value} className="filter-pill">
            <input
              type="checkbox"
              checked={chosen.includes(value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...chosen, value]
                    : chosen.filter((held) => held !== value),
                )
              }
            />
            {labels[value]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Four questions about an assignee, two of which reach the wire as one id.
 *
 * "Nobody at all" is offered as its own option rather than as an id somebody has
 * to know to type, because the unclaimed pool is the thing a User reaches for
 * when they are looking for work — and it is a different question from "assigned
 * to this person", not a special value of it.
 *
 * Which option is checked is read off the slice's own kind rather than worked
 * out from the id it holds. The derived version looks equivalent right up until
 * a reader types their own id into the by-name field, at which point the last
 * keystroke re-checks "assigned to me" and unmounts the field they were typing
 * in, taking the caret with it.
 */
function AssigneeChoice({
  assignee,
  principal,
  onChange,
}: {
  assignee: AssigneeFilter;
  principal: StaffPrincipal | undefined;
  onChange: (assignee: AssigneeFilter) => void;
}) {
  const suggestionsId = useId();
  const known = useKnownAssignees();

  const options: { kind: AssigneeFilter["kind"]; label: string; choose: () => AssigneeFilter }[] = [
    { kind: "anyone", label: "Anyone", choose: () => ({ kind: "anyone" }) },
    // Offered only once the principal has arrived: "assigned to me" cannot be
    // asked before the API has said who "me" is, and an option that quietly
    // filtered by nobody would answer a question no one asked.
    ...(principal
      ? [
          {
            kind: "mine" as const,
            label: "Assigned to me",
            choose: () => ({ kind: "mine" as const, userId: principal.userId }),
          },
        ]
      : []),
    { kind: "unassigned", label: "Unassigned", choose: () => ({ kind: "unassigned" }) },
    { kind: "user", label: "A named User", choose: () => ({ kind: "user", userId: "" }) },
  ];

  return (
    <div className="space-y-2">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Assignee
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <label key={option.kind} className="filter-pill">
              <input
                type="radio"
                name="assignee"
                value={option.kind}
                checked={assignee.kind === option.kind}
                onChange={() => onChange(option.choose())}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {assignee.kind === "user" ? (
        <>
          <SettledField
            name="assigneeId"
            label="User"
            hint="The id of the User the Tickets are assigned to. Suggestions are ids seen on loaded tickets."
            value={assignee.userId}
            onSettled={(userId) => onChange({ kind: "user", userId })}
            // Passes straight through `Field` to the input. Same shortcut as the
            // assignee control on a Ticket, and the same caveat: a hint, not a
            // roster — the API has no directory either control could read.
            list={suggestionsId}
          />
          <datalist id={suggestionsId}>
            {known.map((one) => (
              <option key={one.userId} value={one.userId} label={one.label} />
            ))}
          </datalist>
        </>
      ) : null}
    </div>
  );
}

/** The four orders the API offers, written as the questions they answer. */
const SORT_OPTIONS: { label: string; sort: QueueSort }[] = [
  { label: "Newest first", sort: { field: "createdAt", direction: "desc" } },
  { label: "Oldest first", sort: { field: "createdAt", direction: "asc" } },
  { label: "Recently updated first", sort: { field: "updatedAt", direction: "desc" } },
  { label: "Stalest first", sort: { field: "updatedAt", direction: "asc" } },
];

/**
 * The order, chosen by name.
 *
 * The option values are the wire spelling, but this does not spell them — it
 * asks the slice, which is the one place that knows how a sort is written. A
 * control that built `-createdAt` itself would be the second such place, and the
 * two would agree until one of them changed.
 */
function SortChoice({ sort, onChange }: { sort: QueueSort; onChange: (sort: QueueSort) => void }) {
  return (
    <div className="space-y-1">
      <label htmlFor="queue-sort" className="block text-sm font-semibold tracking-tight text-ink">
        Order
      </label>
      <select
        id="queue-sort"
        name="sort"
        value={toSortParameter(sort)}
        onChange={(event) => {
          const chosen = SORT_OPTIONS.find(
            (option) => toSortParameter(option.sort) === event.target.value,
          );
          if (chosen) onChange(chosen.sort);
        }}
        className="input"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={toSortParameter(option.sort)} value={toSortParameter(option.sort)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
