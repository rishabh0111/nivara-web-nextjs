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
  customer = side === "theirs",
  children,
}: {
  author: string;
  body: string;
  side: Side;
  /**
   * Whether the customer wrote it. The customer's words are always the ink
   * bubble and the desk's (a person or Automation) the pale one, on whichever
   * side the reader sits — the same convention the product page uses. Defaults
   * to the staff reading, where the other side is the customer.
   */
  customer?: boolean;
  /**
   * When it was written, rendered by the caller.
   */
  children: React.ReactNode;
}) {
  const mine = side === "mine";

  return (
    <li className={`flex flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
      <div className={`flex items-center gap-2 text-[0.8125rem] ${mine ? "flex-row-reverse" : ""}`}>
        {/*
          An initial, not a photograph. There are no avatars on this API and
          inventing one would be inventing a person — this is a disc that makes
          the two sides scannable, hidden from a screen reader because the name
          is written out beside it.
        */}
        <span
          aria-hidden="true"
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
            customer ? "bg-ink text-sheet" : "bg-raised text-ink"
          }`}
        >
          {author.slice(0, 1).toUpperCase()}
        </span>

        <p className="font-medium text-ink">{author}</p>

        {children}
      </div>

      {/* Plain text, stored verbatim. Markup in it is what someone typed, not
          markup. `break-words` so one unbroken 200-character string is a
          wrapped paragraph rather than a horizontal scrollbar on the page. */}
      <p
        className={`bubble ${customer ? "bubble-them" : "bubble-us"} !m-0 leading-relaxed whitespace-pre-wrap break-words ${
          mine ? "rounded-br-[4px] rounded-bl-[14px]" : "rounded-bl-[4px] rounded-br-[14px]"
        }`}
      >
        {body}
      </p>
    </li>
  );
}
