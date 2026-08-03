/**
 * One Message in a thread, attributed.
 *
 * Both reading Surfaces show the same thread and both need the same thing from
 * a row: who said it, when, and what they said — with the two sides told apart
 * at a glance, because a support thread read as one undifferentiated column is
 * a thread nobody can skim for the last thing *they* said.
 *
 * Which side is which is the caller's to decide, and the two callers disagree.
 * On the Portal the Contact is "you" and support is the other party; on the
 * Dashboard it is exactly the other way round. So this takes a side rather than
 * working one out from the author — the same Message is "mine" on one Surface
 * and "theirs" on the other, and that is a fact about the reader, not about the
 * record.
 */

/** Which side of the conversation this row is on, from the reader's seat. */
export type Side = "mine" | "theirs";

export function MessageRow({
  author,
  body,
  side,
  children,
}: {
  author: string;
  body: string;
  side: Side;
  /**
   * When it was written, rendered by the caller.
   *
   * The instant is not taken as a prop and formatted here: each Surface words
   * elapsed time its own way and owns its own `<time>` element, and a row that
   * formatted it would be the second place that decides how a date reads.
   */
  children: React.ReactNode;
}) {
  const mine = side === "mine";

  return (
    <li
      className={`card border-l-4 p-3.5 ${mine ? "border-l-accent bg-accent-wash/40" : "border-l-line-strong"}`}
    >
      <div className="flex items-center gap-2.5">
        {/*
          An initial, not a photograph. There are no avatars on this API and
          inventing one would be inventing a person — this is a coloured disc
          that makes the two sides scannable down the left edge, and it is
          hidden from a screen reader because the name is written out beside it.
        */}
        <span
          aria-hidden="true"
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            mine ? "bg-accent text-accent-ink" : "bg-sunken text-ink-muted ring-1 ring-line-strong"
          }`}
        >
          {author.slice(0, 1).toUpperCase()}
        </span>

        <p className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-ink">{author}</p>

        {children}
      </div>

      {/* Plain text, stored verbatim. Markup in it is what someone typed, not
          markup. `break-words` so one unbroken 200-character string is a
          wrapped paragraph rather than a horizontal scrollbar on the page. */}
      <p className="mt-2 leading-relaxed whitespace-pre-wrap break-words">{body}</p>
    </li>
  );
}
