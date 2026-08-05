"use client";

import { useId, useState } from "react";

import type { ApiResult } from "@/api/client";
import { describeFailure } from "@/api/errors";
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATE_LABELS,
  type Ticket,
  type TicketPriority,
} from "@/tickets/ticket";
import { acceptsPriorityChange, TICKET_TRANSITIONS } from "@/tickets/ticket-transitions";
import { useToaster } from "@/ui/toast";

import { useKnownAssignees } from "./known-assignees";
import { useStaffPrincipal } from "./use-staff-principal";
import { useTicketWrites } from "./use-ticket-writes";

/**
 * The three things a User changes about a Ticket.
 *
 * What each control offers is decided by where the Ticket is, so that a User
 * learns the rules from the interface rather than by being refused: a move that
 * the database will not make is not in the list, and an edit a locked record
 * will not take has no control at all — with the reason said in words, because a
 * reader looking for a control they have used before needs to know it is gone on
 * purpose.
 *
 * Nothing is applied before the API has answered. The controls hold what has been
 * chosen — a select that snapped back to the old value the instant it was touched
 * would read as the choice not registering — but the Ticket itself is only ever
 * what the last response said it was. So a refused write needs no unwinding: the
 * chosen value is dropped, the Ticket was never changed, and the reader is told
 * in the same breath. The failure mode this is built against is a User walking
 * away believing a change landed when it did not.
 *
 * One outcome line and one problem line serve all three controls. Three live
 * regions on one small region would compete to announce, and only one of them
 * can have just happened.
 */
export function TicketActions({ ticket }: { ticket: Ticket }) {
  const headingId = useId();
  const toaster = useToaster();
  const [outcome, setOutcome] = useState<string | undefined>();
  const [problem, setProblem] = useState<string | undefined>();

  // Two separate rules that happen to coincide on exactly one state, asked as
  // two questions rather than as `state === "closed"` — the transition table and
  // the priority lock are the API's, and each is allowed to move without the
  // other. Where they ever stop coinciding this reads false and both controls
  // come back, which is visibly wrong rather than quietly wrong.
  const locked =
    TICKET_TRANSITIONS[ticket.state].length === 0 && !acceptsPriorityChange(ticket.state);

  /**
   * Runs one write and says what became of it.
   *
   * What it did is worded before it is attempted, because the caller is the only
   * thing that knows what it asked for — and by the time the answer is back, the
   * screen has already been updated from it, so reconstructing the sentence from
   * the new state would be describing the result rather than the act.
   */
  async function report<T>(said: string, run: () => Promise<ApiResult<T>>) {
    setOutcome(undefined);
    setProblem(undefined);

    const result = await run();

    if (result.ok) {
      setOutcome(said);
      toaster.show("outcome", said);
    } else {
      // The write has already put the screen back; this is the half that says
      // why, in the API's own words rather than a sentence invented here. It
      // interrupts, because the reader has just watched a change undo itself.
      const why = describeFailure(result.failure);
      setProblem(why);
      toaster.show("failure", why);
    }

    return result;
  }

  return (
    <section aria-labelledby={headingId} className="card overflow-hidden">
      <h3
        id={headingId}
        className="flex items-center gap-2 border-b border-line bg-sunken px-4 py-3 text-sm font-semibold tracking-tight"
      >
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
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Change this ticket
      </h3>

      <div className="space-y-4 p-4">
        {/*
        A locked record is one fact about the Ticket and not two absences, so it
        is said once, in place of both controls it removes. Saying it beside the
        state control alone — and letting priority simply vanish — was the first
        version: it left a reader who had come to escalate something looking for
        a control that was gone with nothing on screen about it.
      */}
        {locked ? (
          <p className="text-sm text-ink-muted">
            A closed ticket is final. It cannot be moved to another state and its priority cannot be
            changed. A reply from the customer opens a new linked ticket rather than reviving this
            one.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <StateControl ticket={ticket} report={report} />
            <PriorityControl ticket={ticket} report={report} />
          </div>
        )}

        <AssigneeControl ticket={ticket} report={report} />

        {/*
        Shown, not announced — the toast is what announces these now. This used
        to be the only report a write ever got, which is exactly the problem the
        toaster was added for: on a Ticket screen these two lines sit below the
        conversation, and a reader who has scrolled up never sees either.

        Kept anyway, because "what did I just change" is a question a reader
        asks of the panel after the toast has gone. It is a record beside the
        controls, and records do not need to interrupt.
      */}
        {outcome ? <p className="text-sm text-ink-muted">{outcome}</p> : null}

        {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      </div>
    </section>
  );
}

/** Reports what a write did, in the words the reader will hear. */
type Report = <T>(said: string, run: () => Promise<ApiResult<T>>) => Promise<ApiResult<T>>;

/** Only rendered where the Ticket has somewhere to go; the region decides that. */
function StateControl({ ticket, report }: { ticket: Ticket; report: Report }) {
  const writes = useTicketWrites(ticket.id);

  return (
    <EditedChoice
      label="State"
      name="state"
      action="Change state"
      labels={TICKET_STATE_LABELS}
      current={ticket.state}
      // The Ticket's own state first, because that is what the control is
      // showing, then the moves out of it. It is not itself a destination —
      // moving a Ticket to where it already is changes nothing — so the submit
      // control is what declines to send it.
      options={[ticket.state, ...TICKET_TRANSITIONS[ticket.state]]}
      onWrite={(state) =>
        report(`State is now ${TICKET_STATE_LABELS[state]}.`, () => writes.transition(state))
      }
    />
  );
}

/**
 * Urgency, which is not progress.
 *
 * Its own rule and not a transition — the table is not consulted, and any
 * priority is legal in any state the Ticket can still be worked in. The single
 * exception, a locked record, is the region's to explain, because it removes
 * this control and the state control together.
 */
function PriorityControl({ ticket, report }: { ticket: Ticket; report: Report }) {
  const writes = useTicketWrites(ticket.id);

  return (
    <EditedChoice
      label="Priority"
      name="priority"
      action="Change priority"
      labels={TICKET_PRIORITY_LABELS}
      current={ticket.priority}
      // Every priority in every state. Unlike a transition there is no table:
      // any value is legal from any other, including from itself, and the only
      // reason the current one cannot be sent is that it would change nothing.
      options={Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]}
      onWrite={(priority) =>
        report(`Priority is now ${TICKET_PRIORITY_LABELS[priority]}.`, () =>
          writes.setPriority(priority),
        )
      }
    />
  );
}

/**
 * One value chosen from a closed set, written when the reader says so.
 *
 * A select that wrote on change was the obvious shape and is the wrong one here.
 * Arrowing through a native select fires a change per option on several
 * browsers, so a keyboard reader moving from `open` to `resolved` would post two
 * transitions on the way past — and the queue's argument against an apply step
 * does not carry over: a filter that has been chosen but not submitted is a
 * screen disagreeing with itself, whereas a write that has been chosen but not
 * submitted is simply a write that has not been made.
 *
 * The submit control is beside its own select rather than one for the region, so
 * choosing and writing is one movement for a reader tabbing through, and so that
 * what is being changed is never ambiguous.
 */
function EditedChoice<Value extends string>({
  label,
  name,
  action,
  labels,
  current,
  options,
  onWrite,
}: {
  label: string;
  /** The field's name on the wire, given rather than derived from the label copy. */
  name: string;
  /** What the button does, said as the act rather than as "Save". */
  action: string;
  labels: Record<Value, string>;
  /** What the Ticket says now — what the control shows when nothing is chosen. */
  current: Value;
  options: Value[];
  onWrite: (value: Value) => Promise<ApiResult<unknown>>;
}) {
  const id = useId();
  const [chosen, setChosen] = useState<Value | undefined>();
  const [writing, setWriting] = useState(false);

  // What is being looked at: the choice if one has been made, and otherwise the
  // Ticket. A choice that survived the write would be the control speaking for
  // itself rather than for the record.
  const value = chosen ?? current;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (value === current || writing) return;

    setWriting(true);
    await onWrite(value);
    setWriting(false);

    // Handed back to the Ticket either way. Where the write landed, the Ticket
    // now says what was chosen and the control is unchanged by this; where it
    // did not, this is what puts the prior value back on the screen.
    setChosen(undefined);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold tracking-tight text-ink">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={id}
          name={name}
          value={value}
          onChange={(event) => setChosen(event.target.value as Value)}
          className="input"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {labels[option]}
            </option>
          ))}
        </select>

        <button type="submit" disabled={writing || value === current} className="btn btn-quiet">
          {writing ? "Changing…" : action}
        </button>
      </div>
    </form>
  );
}

/**
 * Who is responsible for a Ticket, and the three ways that changes.
 *
 * Responsibility has exactly one holder or none — there are no teams on this API
 * — so this is one value with three ways to set it rather than a list to manage.
 * "Nobody" is one of the three and is offered as its own control: the unclaimed
 * pool is where a User goes looking for work, and returning a Ticket to it is a
 * deliberate act rather than the absence of an assignment.
 *
 * A colleague is named by id, and that is not a shortcut. Nothing on this API
 * turns a User id into a person — there is no directory endpoint — so a picker
 * would have to invent its options from whichever Tickets happened to be loaded,
 * offering some colleagues and not others with nothing on screen to say which.
 * A field that asks for what the API actually takes is the honest version until
 * there is something to populate a picker from.
 */
function AssigneeControl({ ticket, report }: { ticket: Ticket; report: Report }) {
  const writes = useTicketWrites(ticket.id);
  const principal = useStaffPrincipal();
  const id = useId();
  const hintId = `${id}-hint`;
  const suggestionsId = `${id}-known`;
  const known = useKnownAssignees();

  const [typed, setTyped] = useState("");
  const [writing, setWriting] = useState(false);

  async function assign(assigneeId: string | null, said: string) {
    if (writing) return;

    setWriting(true);
    const written = await report(said, () => writes.setAssignee(assigneeId));
    setWriting(false);

    // Emptied only where it landed: leaving an id in the box after a successful
    // hand-over invites the next reader to make it again, and clearing it after
    // a refusal would throw away something they would have to retype.
    if (written.ok) setTyped("");
  }

  const mine = principal !== undefined && principal.userId === ticket.assigneeId;

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold tracking-tight text-ink">Assignee</legend>

      <p className="text-sm text-ink-muted">
        {ticket.assigneeId
          ? `Assigned to ${ticket.assigneeId}${mine ? " (you)." : "."}`
          : "Nobody has claimed this ticket."}
      </p>

      <div className="flex flex-wrap gap-2">
        {/* Offered only once the API has said who "me" is, and not when the
            answer is already this reader. */}
        {principal && !mine ? (
          <button
            type="button"
            disabled={writing}
            onClick={() => void assign(principal.userId, "This ticket is now yours.")}
            className="btn btn-quiet"
          >
            Assign to me
          </button>
        ) : null}

        {ticket.assigneeId ? (
          <button
            type="button"
            disabled={writing}
            onClick={() => void assign(null, "This ticket is back in the unclaimed pool.")}
            className="btn btn-quiet"
          >
            Unassign
          </button>
        ) : null}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const colleague = typed.trim();
          if (colleague !== "") void assign(colleague, `This ticket is now with ${colleague}.`);
        }}
        className="space-y-1"
      >
        <label htmlFor={id} className="block text-sm font-semibold tracking-tight text-ink">
          Assign to a colleague
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={id}
            name="assigneeId"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            aria-describedby={hintId}
            // A native datalist rather than a listbox of our own. The browser
            // gives keyboard navigation, filtering as you type, a mobile picker
            // and screen-reader support for free — and, unlike a combobox, it
            // leaves the field free text, which matters when the suggestions are
            // a handful of ids seen in passing rather than a roster.
            list={suggestionsId}
            className="input"
          />
          <datalist id={suggestionsId}>
            {known.map((one) => (
              <option key={one.userId} value={one.userId} label={one.label} />
            ))}
          </datalist>
          <button type="submit" disabled={writing || typed.trim() === ""} className="btn btn-quiet">
            Assign
          </button>
        </div>
        <p id={hintId} className="text-xs leading-relaxed text-ink-muted">
          The id of the User to make responsible.{" "}
          {known.length > 0
            ? "Suggestions are ids already seen on loaded tickets. This API has no directory, so anyone who has not appeared in them has to be typed in full."
            : "This API has no directory to look one up in."}
        </p>
      </form>
    </fieldset>
  );
}
