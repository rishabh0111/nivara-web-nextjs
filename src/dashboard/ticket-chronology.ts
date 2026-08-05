/**
 * One Ticket's customer-visible thread and its internal Notes, read as a single
 * history.
 *
 * The API holds the two apart on purpose — different tables, different
 * endpoints, and nothing on the server ever assembles a mixed collection that
 * could be serialized to the wrong audience. Interleaving them is therefore the
 * client's job, and it is this module's whole job: the merge happens once, here,
 * so no component is ever holding two lists and deciding for itself what order
 * they go in.
 *
 * What the merge has to be careful about is the page boundary. Each half is
 * cursor-paginated separately, so at any moment one may have arrived further
 * through time than the other, and the tail of the longer half sits in a stretch
 * of time this client cannot yet account for: rows may still land in among it.
 *
 * The answer is to say so rather than to hide it. Withholding those rows was the
 * first thing tried and it is worse than the problem — both halves are read
 * oldest first, so on any Ticket with more than a page of thread the withheld
 * stretch is *today*, and an internal Note a User had just written would vanish
 * under a form that had told them it was added.
 *
 * So the history comes back in two parts. `settled` is everything up to the
 * point both halves have read to, and its order is final. `unsettled` is what
 * lies past it — shown, because it is the newest and most wanted end of the
 * conversation, and marked, because a page arriving later may slot rows into the
 * middle of it. Nothing is ever mislabelled: a Note is a Note in either part.
 */
import type { Message } from "@/tickets/message";
import type { Note } from "@/tickets/note";

/** One half of the history, as far as it has arrived. */
export type Arrived<Item> = { items: Item[]; hasMore: boolean };

/**
 * A row of the history, carrying which of the two it is.
 *
 * A discriminated union rather than a shared shape with an `internal` flag: the
 * two are rendered unmistakably differently, and a boolean that a component
 * could forget to read is exactly the mistake this screen cannot afford.
 */
export type ChronologyRow =
  | { kind: "message"; id: string; at: string; message: Message }
  | { kind: "note"; id: string; at: string; note: Note };

/**
 * One Ticket's history, split at the point past which it may still change.
 *
 * Two lists rather than one list and an index, so a caller cannot render the
 * whole thing by forgetting to slice it.
 */
export type Chronology = {
  /** Everything both halves have read through. Its order is final. */
  settled: ChronologyRow[];
  /** What lies past that, which a later page may still be interleaved into. */
  unsettled: ChronologyRow[];
};

export function mergeChronology(messages: Arrived<Message>, notes: Arrived<Note>): Chronology {
  const rows: ChronologyRow[] = [
    ...messages.items.map<ChronologyRow>((message) => ({
      kind: "message",
      id: message.id,
      at: message.createdAt,
      message,
    })),
    ...notes.items.map<ChronologyRow>((note) => ({
      kind: "note",
      id: note.id,
      at: note.createdAt,
      note,
    })),
  ];

  rows.sort(
    (one, other) =>
      // Oldest first, because a conversation is read downwards. Ties are broken
      // by id rather than left to the sort's own arrangement, so a Message and a
      // Note stamped in the same millisecond do not swap places between one
      // render and the next.
      instant(one.at) - instant(other.at) || (one.id < other.id ? -1 : 1),
  );

  const settledThrough = Math.min(reachedThrough(messages), reachedThrough(notes));
  const boundary = rows.findIndex((row) => instant(row.at) > settledThrough);

  return boundary === -1
    ? { settled: rows, unsettled: [] }
    : { settled: rows.slice(0, boundary), unsettled: rows.slice(boundary) };
}

/**
 * The instant up to which this half can account for what happened.
 *
 * A half with no next cursor has arrived whole, and that includes the time after
 * its own last row — treating its last row as a boundary would mark the tail of
 * every conversation unsettled whenever the other half ran on past it.
 *
 * A half with more to come has read only as far as its last row, and one that
 * has more to come with nothing yet in hand has read nowhere at all.
 *
 * The boundary is inclusive: a row stamped exactly on it is settled. The
 * alternative unsettles a boundary shared by several rows, and the cost is
 * confined to two rows in the same millisecond either side of a page edge.
 */
function reachedThrough(half: Arrived<{ createdAt: string }>): number {
  if (!half.hasMore) return Number.POSITIVE_INFINITY;

  const last = half.items.at(-1);
  return last === undefined ? Number.NEGATIVE_INFINITY : instant(last.createdAt);
}

/**
 * An instant off the wire as a number. An unparseable one sorts to the start
 * rather than poisoning every comparison it takes part in, which is what `NaN`
 * would do.
 */
function instant(iso: string): number {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? Number.NEGATIVE_INFINITY : at;
}
