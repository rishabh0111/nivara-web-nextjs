/**
 * The subject of a Ticket a Visitor opened by typing a message.
 *
 * The API opens a Ticket with a subject and takes the first Message afterwards,
 * exactly as it does for the Portal. The Portal asks a Contact for both,
 * because a Contact came to a help centre to file something. A Visitor did not:
 * they were on a Tenant's site, they pressed a Launcher, and asking them to
 * title their question before asking it turns a chat into a form — which is
 * precisely the thing this Surface exists not to be.
 *
 * So the subject is taken from what they said. It is derived rather than
 * invented: staff reading a queue see the Visitor's own opening words, and a
 * long one is cut at a word and marked as cut rather than left to read as a
 * broken record.
 */

/** Long enough to be a sentence, short enough to sit in a queue's row. */
const LONGEST = 72;

/** What a Ticket is called when there is nothing to call it. */
const UNTITLED = "Support request";

export function openingSubject(said: string): string {
  // The first line, because a Visitor who wrote a paragraph wrote the gist of
  // it first; and one run of whitespace, because a paste carries its own.
  const opening = said.split("\n")[0]!.replace(/\s+/g, " ").trim();

  if (opening === "") return UNTITLED;
  if (opening.length <= LONGEST) return opening;

  const cut = opening.slice(0, LONGEST);
  const word = cut.lastIndexOf(" ");

  // A run with no space in it has no word boundary to respect, and is cut where
  // the limit falls — a subject that grew without bound would be worse.
  return `${(word === -1 ? cut : cut.slice(0, word)).trimEnd()}…`;
}
