"use client";

import { describeFailure } from "@/api/errors";
import { Compose } from "@/ui/compose";

import { useTicketWrites } from "./use-ticket-writes";

const ADDED = "Your internal note was added. The customer cannot see it.";

/**
 * Coordinating with colleagues on a Ticket without the Contact seeing.
 *
 * Its own form, separate from the customer reply, and never a checkbox on one.
 * A single box with a "visible to customer" toggle is one mis-click from posting
 * an internal aside to the person it was about, and no amount of confirming
 * afterwards takes it back — the API models these as two endpoints over two
 * tables for the same reason, and the interface follows rather than flattening
 * them back together.
 *
 * The box is tinted and edged the same way a Note row in the conversation is,
 * which is the one piece of styling this form does not leave to the shared
 * control. It is the same distinction doing the same work in the same colours:
 * a reader who has learnt that a dashed step means "the customer cannot see this" should
 * meet it while typing, not only afterwards.
 */
export function NoteForm({ ticketId }: { ticketId: string }) {
  const writes = useTicketWrites(ticketId);

  return (
    <Compose
      // The label carries who reads it, and the dashed step carries it again:
      // the one mistake this pair exists to prevent is a note typed into the
      // wrong box, and that is said where the eye already is.
      label="Internal note, for colleagues only"
      action="Add internal note"
      acting="Adding…"
      announcement="What happened to your note"
      classes={{ box: "input resize-y border-dashed bg-sunken leading-relaxed", action: "btn btn-quiet" }}
      onSubmit={async (noted) => {
        const written = await writes.writeNote(noted);
        return written.ok
          ? { said: true, outcome: ADDED }
          : { said: false, problem: describeFailure(written.failure) };
      }}
    />
  );
}
