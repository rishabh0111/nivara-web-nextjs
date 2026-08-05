/**
 * Two collections read separately and shown as one history.
 *
 * The interesting case is not the merge — it is the page boundary. Messages and
 * Notes are separate endpoints with separate cursors, so at any moment one of
 * them may have arrived further through time than the other, and a page landing
 * later can slot rows into the stretch past that point.
 *
 * Both halves are read oldest first, so that stretch is the *newest* end of the
 * conversation: the part a User has open the Ticket to read, and where a Note
 * they have just written lands. Withholding it is therefore not an option, and
 * pretending it is settled is not either. It comes back separated, and these
 * tests are mostly about where the line falls.
 */
import { describe, expect, it } from "vitest";

import { message as aMessage, note as aNote } from "@/tickets/tickets.fixtures";

import { mergeChronology, type Chronology } from "./ticket-chronology";

// Only the two fields the merge reads. Everything else on a record is the shared
// fixture's business, and naming it here would be a second description of a
// shape this file does not care about.
const message = (id: string, at: string) => aMessage({ id, createdAt: at });
const note = (id: string, at: string) => aNote({ id, createdAt: at });

const ids = (rows: Chronology["settled"]) => rows.map((row) => row.id);

/** Everything the reader would see, in the order they would read it. */
const shown = (history: Chronology) => [...ids(history.settled), ...ids(history.unsettled)];

const whole = { hasMore: false };

describe("one Ticket's history", () => {
  it("reads oldest first, whichever endpoint each row came from", () => {
    const history = mergeChronology(
      {
        items: [
          message("msg_1", "2026-07-01T09:00:00.000Z"),
          message("msg_2", "2026-07-01T11:00:00.000Z"),
        ],
        ...whole,
      },
      { items: [note("not_1", "2026-07-01T10:00:00.000Z")], ...whole },
    );

    expect(shown(history)).toEqual(["msg_1", "not_1", "msg_2"]);
  });

  it("says which of the two a row is, so the interface never has to guess", () => {
    const history = mergeChronology(
      { items: [message("msg_1", "2026-07-01T09:00:00.000Z")], ...whole },
      { items: [note("not_1", "2026-07-01T10:00:00.000Z")], ...whole },
    );

    expect(history.settled.map((row) => row.kind)).toEqual(["message", "note"]);
  });

  it("is empty when nothing has been said and nothing noted", () => {
    expect(mergeChronology({ items: [], ...whole }, { items: [], ...whole })).toEqual({
      settled: [],
      unsettled: [],
    });
  });

  it("is the other collection alone when one of them is empty", () => {
    const history = mergeChronology(
      { items: [], ...whole },
      { items: [note("not_1", "2026-07-01T10:00:00.000Z")], ...whole },
    );

    expect(shown(history)).toEqual(["not_1"]);
  });

  it("settles everything once both halves have arrived whole", () => {
    const history = mergeChronology(
      { items: [message("msg_1", "2026-07-01T09:00:00.000Z")], ...whole },
      {
        items: [
          note("not_1", "2026-07-01T08:00:00.000Z"),
          note("not_2", "2026-07-01T12:00:00.000Z"),
        ],
        ...whole,
      },
    );

    expect(ids(history.settled)).toEqual(["not_1", "msg_1", "not_2"]);
    expect(history.unsettled).toEqual([]);
  });
});

describe("the page boundary", () => {
  /**
   * The Notes have run further into the conversation than the Messages have, so
   * a Message page still on its way could land in between. The rows past that
   * point are still shown — they are the newest end, and hiding them is how a
   * User loses sight of a Note they have just written — but they are held apart,
   * because their order is not yet final.
   */
  it("separates what is past the point the shorter half has reached", () => {
    const history = mergeChronology(
      { items: [message("msg_1", "2026-07-01T09:00:00.000Z")], hasMore: true },
      {
        items: [
          note("not_1", "2026-07-01T08:00:00.000Z"),
          note("not_2", "2026-07-01T12:00:00.000Z"),
        ],
        ...whole,
      },
    );

    expect(ids(history.settled)).toEqual(["not_1", "msg_1"]);
    expect(ids(history.unsettled)).toEqual(["not_2"]);
  });

  /**
   * The case the whole split exists for. A busy Ticket has more thread than one
   * page, so the settled boundary sits back at the oldest page — and the Note
   * this User wrote a second ago is the newest row there is. It has to be on
   * screen, or the form has told them something that is not true.
   */
  it("shows a Note written now on a Ticket whose thread is only partly read", () => {
    const history = mergeChronology(
      { items: [message("msg_1", "2026-06-01T09:00:00.000Z")], hasMore: true },
      { items: [note("not_1", "2026-07-01T12:00:00.000Z")], ...whole },
    );

    expect(shown(history)).toContain("not_1");
    expect(ids(history.unsettled)).toEqual(["not_1"]);
  });

  /**
   * A half that has arrived whole accounts for all of time, including the part
   * after its own last row — that is what "no next cursor" means. Treating its
   * last row as a boundary would mark the tail of a finished conversation
   * unsettled whenever the last thing said was a Message and the last thing
   * noted was older.
   */
  it("lets a finished half account for the time after its own last row", () => {
    const history = mergeChronology(
      {
        items: [
          message("msg_1", "2026-07-01T09:00:00.000Z"),
          message("msg_2", "2026-07-01T15:00:00.000Z"),
        ],
        ...whole,
      },
      { items: [note("not_1", "2026-07-01T10:00:00.000Z")], ...whole },
    );

    expect(ids(history.settled)).toEqual(["msg_1", "not_1", "msg_2"]);
    expect(history.unsettled).toEqual([]);
  });

  /**
   * A half with more to come and nothing yet in hand has reached no point in
   * time at all, so nothing the other half holds has a settled place in the
   * history — but it is all still shown.
   */
  it("settles nothing while a half with more to come is still empty", () => {
    const history = mergeChronology(
      { items: [], hasMore: true },
      { items: [note("not_1", "2026-07-01T10:00:00.000Z")], ...whole },
    );

    expect(history.settled).toEqual([]);
    expect(ids(history.unsettled)).toEqual(["not_1"]);
  });

  it("settles a row sitting exactly on the boundary rather than stalling on it", () => {
    const history = mergeChronology(
      { items: [message("msg_1", "2026-07-01T09:00:00.000Z")], hasMore: true },
      { items: [note("not_1", "2026-07-01T09:00:00.000Z")], hasMore: true },
    );

    expect(ids(history.settled)).toEqual(["msg_1", "not_1"]);
    expect(history.unsettled).toEqual([]);
  });
});
