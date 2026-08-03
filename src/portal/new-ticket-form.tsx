"use client";

import { useEffect, useId, useRef, useState } from "react";

import { describeFailure } from "@/api/errors";
import type { Ticket } from "@/tickets/ticket";

import { usePortalWrites } from "./use-portal-writes";
import { BackLink } from "@/ui/back-link";

/**
 * Asking for help: a subject, and the first thing to say about it.
 *
 * One form over two writes, because that is how the API is shaped — a Ticket is
 * opened with a subject alone, and the first Message is posted onto it
 * afterwards. The join between them shows in this form rather than being
 * hidden, because the second write can fail after the first has landed: the
 * Ticket exists, and a form that simply re-ran both would leave the Contact
 * with two Tickets for one question. So the Ticket, once opened, is held, and
 * retrying sends only the message.
 */
export function NewTicketForm({
  onOpened,
  onCancel,
}: {
  onOpened: (ticket: Ticket) => void;
  onCancel: () => void;
}) {
  const writes = usePortalWrites();
  const headingId = useId();
  const subjectId = useId();
  const bodyId = useId();
  const problemId = useId();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [opened, setOpened] = useState<Ticket | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();

  // This form replaced the list, and the button that opened it went with it.
  // Focusing the region announces what this is and puts the next tab on "All
  // tickets" rather than at the top of the document.
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    region.current?.focus();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setProblem(undefined);

    let ticket = opened;
    if (!ticket) {
      const result = await writes.open(subject.trim());
      if (!result.ok) {
        setSubmitting(false);
        setProblem(describeFailure(result.failure));
        return;
      }
      ticket = result.value;
      setOpened(ticket);
    }

    // A Ticket this new cannot be closed, so this cannot land anywhere else —
    // but it is the same write as a reply, and reading the answer is what that
    // write's contract asks for either way.
    const said = await writes.reply(ticket, body.trim());
    setSubmitting(false);

    if (!said.sent) {
      setProblem(
        `Your ticket was opened, but the first message could not be sent. ${describeFailure(said.failure)}`,
      );
      return;
    }

    onOpened(said.landedOn ?? ticket);
  }

  return (
    <section ref={region} tabIndex={-1} aria-labelledby={headingId} className="space-y-4">
      <BackLink onClick={onCancel}>All tickets</BackLink>

      <h2 id={headingId} className="text-xl font-semibold tracking-tight">
        Open a ticket
      </h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor={subjectId}
            className="block text-sm font-semibold tracking-tight text-ink"
          >
            Subject
          </label>
          <input
            id={subjectId}
            name="subject"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            // The Ticket exists now and its subject is what was sent. Leaving
            // this editable would offer a change that goes nowhere.
            disabled={opened !== undefined}
            className="input disabled:opacity-60"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={bodyId} className="block text-sm font-semibold tracking-tight text-ink">
            Message
          </label>
          <textarea
            id={bodyId}
            name="body"
            rows={5}
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            aria-describedby={problem ? problemId : undefined}
            className="input"
          />
        </div>

        {problem ? (
          <p id={problemId} role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || subject.trim() === "" || body.trim() === ""}
          className="btn btn-primary"
        >
          {submitting ? "Sending…" : opened ? "Send message" : "Open ticket"}
        </button>
      </form>
    </section>
  );
}
