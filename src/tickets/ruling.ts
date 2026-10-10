/**
 * What the AI decided about a Ticket: answer, ask, or hand over.
 *
 * The API does not record a ruling as a field — a Ticket has a state, a
 * priority and an assignee, and nothing that says what `nivara-ai` did with
 * it. What it does record is what Automation *wrote*, and each ruling writes
 * something different, so the ruling is read back from that:
 *
 * - **Hand over** writes an internal Note, authored by the service credential,
 *   whose first line is `Escalation reason: <code>`. That is the one rule for a
 *   hand-over, here and in `handOverReason`.
 * - **Ask** posts one clarifying question as a reply and waits on the customer.
 * - **Answer** posts the answer as a reply.
 *
 * Which came last wins: an escalation note followed by a later reply from
 * Automation reads as that reply, compared by `createdAt`.
 *
 * Ask and answer are both a reply from Automation, and the record does not say
 * which it was. It is read as a question only when all of these hold: it is the
 * last message on the Ticket (nobody has answered it), the Ticket is still open
 * or pending, it ends in a question mark, and it is a single sentence. The last
 * condition is what keeps an answer that closes with a courtesy question ("…
 * from the import screen. Does that help?") an answer. The limit: a clarifying
 * question written as two sentences reads as an answer. If the API ever stamps
 * the ruling on the Ticket, this is the one function that changes.
 *
 * `authorKind` is server-stamped from the writing credential and cannot be
 * claimed by a request, which is what makes it safe to read a ruling from.
 * Input order does not matter; everything is compared by `createdAt`.
 */
import type { Message } from "./message";
import type { Note } from "./note";
import type { TicketState } from "./ticket";

export type Ruling = "answer" | "clarify" | "escalate";

/** The three, in the order the strip always shows them. */
export const RULINGS: readonly Ruling[] = ["answer", "clarify", "escalate"];

/** The word on each part of the strip: what the AI can do. */
export const RULING_LABELS: Record<Ruling, string> = {
  answer: "Answer",
  clarify: "Ask",
  escalate: "Hand over",
};

/** What it did, as a row says it. */
export const RULING_OUTCOMES: Record<Ruling, string> = {
  answer: "Answered",
  clarify: "Asked",
  escalate: "Handed over",
};

/** Said wherever a ruling is shown, because it is a reading and not a record. */
export const RULING_SOURCE = "Read from what Automation wrote";

type Written = Pick<Message, "authorKind" | "body" | "createdAt">;
type Noted = Pick<Note, "authorKind" | "body" | "createdAt">;

const ESCALATION = /^Escalation reason:\s*([a-z_]+)/;
const WAITING: readonly TicketState[] = ["open", "pending"];

/** A Note Automation left when it handed a Ticket over. */
export function isEscalation(note: Noted): boolean {
  return note.authorKind === "service" && ESCALATION.test(note.body);
}

export function rulingOf(
  state: TicketState,
  messages: readonly Written[],
  notes: readonly Noted[],
): Ruling | undefined {
  const escalation = latestBy(notes.filter(isEscalation));
  const reply = latestBy(messages.filter((message) => message.authorKind === "service"));

  if (escalation && (!reply || escalation.createdAt >= reply.createdAt)) return "escalate";
  if (!reply) return undefined;

  return isQuestion(reply, latestBy(messages), state) ? "clarify" : "answer";
}

function isQuestion(reply: Written, last: Written | undefined, state: TicketState): boolean {
  return last === reply && WAITING.includes(state) && readsAsQuestion(reply.body);
}

/**
 * Whether one reply from Automation is worded as its one clarifying question:
 * a single sentence ending in a question mark.
 *
 * The wording half of the rule above, without the Ticket's standing. A Ticket's
 * ruling also asks whether the question is still waiting; a reply in a thread
 * is a question or an answer whatever came after it, which is how the Widget
 * marks each of Automation's turns.
 */
export function readsAsQuestion(body: string): boolean {
  const said = body.trim();
  return (
    said.endsWith("?") &&
    // One sentence: nothing ends before the closing question mark.
    !/[.!?](\s|$)/.test(said.slice(0, -1))
  );
}

/**
 * Why it was handed over, from the first line of Automation's latest
 * escalation Note.
 *
 * The code is the service's own vocabulary; the words beside it are this
 * Surface's reading of it, and a code it has no words for is shown as it came.
 */
export type HandOverReason = { code: string; words: string };

const REASON_WORDS: Record<string, string> = {
  model_declined: "the model declined to answer",
  gate_uncertain: "the gate wasn't sure of the help centre",
  no_model_answer: "no usable answer came back from the model",
};

export function handOverReason(notes: readonly Noted[]): HandOverReason | undefined {
  const note = latestBy(notes.filter(isEscalation));
  const code = note?.body.match(ESCALATION)?.[1];
  if (!code) return undefined;

  return { code, words: REASON_WORDS[code] ?? `Automation gave the reason ${code}` };
}

/**
 * The retrieval figures an escalation Note states, when it states them.
 *
 * The gate writes "retrieval top score 1.07, post-rerank margin 0.01" into the
 * Notes it leaves; a model that declined writes prose instead. Read only when
 * both numbers are there, never estimated.
 */
export type GateSignals = { topScore: number; margin: number };

export function gateSignals(notes: readonly Noted[]): GateSignals | undefined {
  const body = latestBy(notes.filter(isEscalation))?.body ?? "";
  const top = body.match(/top score (\d+(?:\.\d+)?)/)?.[1];
  const margin = body.match(/margin (\d+(?:\.\d+)?)/)?.[1];
  if (top === undefined || margin === undefined) return undefined;

  return { topScore: Number(top), margin: Number(margin) };
}

/** The verdict in one line, as the ticket view states it under the subject. */
export function verdictOf(ruling: Ruling | undefined, reason: HandOverReason | undefined): string {
  switch (ruling) {
    case "answer":
      return "Answered by Automation.";
    case "clarify":
      return "Automation asked the customer one question.";
    case "escalate":
      return reason ? `Handed to a person: ${reason.words}.` : "Handed to a person.";
    default:
      return "No AI ruling on this ticket.";
  }
}

function latestBy<T extends { createdAt: string }>(items: readonly T[]): T | undefined {
  let latest: T | undefined;
  for (const item of items) {
    if (!latest || item.createdAt > latest.createdAt) latest = item;
  }
  return latest;
}
