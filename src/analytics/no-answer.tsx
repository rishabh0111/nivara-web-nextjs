/**
 * The one rendering that means the API had nothing to answer with.
 *
 * A dash is a mark on a screen and reads as nothing at all when it is read
 * aloud — a reader on a screen reader would hear the figure's name and then
 * silence, which is indistinguishable from a figure of zero. So the dash is for
 * the eye and the words are underneath it, and both are always present.
 */
export function NoAnswer({ because }: { because?: string }) {
  return (
    <>
      <span aria-hidden="true">—</span>
      {/* Why there is no answer, where the reason is not already beside the
          dash. A tile says it underneath in words anyone can see; a table cell
          has no room for it and the reason is in the row's own count, which is
          read a column away and not at all if the row is read a cell at a time. */}
      <span className="sr-only">{because ? `No answer: ${because}` : "No answer"}</span>
    </>
  );
}
