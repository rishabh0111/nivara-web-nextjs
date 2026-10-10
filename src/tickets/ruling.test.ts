import { describe, expect, it } from "vitest";

import { gateSignals, handOverReason, rulingOf, verdictOf } from "./ruling";
import { message, note } from "./tickets.fixtures";

const question = message({
  id: "msg_q",
  authorKind: "contact",
  body: "It's not working.",
  createdAt: "2026-07-01T09:00:00.000Z",
});

const asked = message({
  id: "msg_a",
  authorKind: "service",
  authorId: null,
  body: "Which part isn't working: signing in, or the contact importer?",
  createdAt: "2026-07-01T09:01:00.000Z",
});

const answered = message({
  id: "msg_b",
  authorKind: "service",
  authorId: null,
  body: "The contact importer expects at least the headers email, name and company.",
  createdAt: "2026-07-01T09:01:00.000Z",
});

const escalation = note({
  authorKind: "service",
  authorId: null,
  body: "Escalation reason: model_declined\n\nThe customer asked about the refund window.",
  createdAt: "2026-07-01T09:02:00.000Z",
});

describe("reading the AI's ruling off what Automation wrote", () => {
  it("is a hand-over when Automation left an escalation note", () => {
    expect(rulingOf("open", [question], [escalation])).toBe("escalate");
  });

  it("is a hand-over when the escalation came after Automation's reply", () => {
    expect(rulingOf("open", [question, answered], [escalation])).toBe("escalate");
  });

  it("lets a later answer win over an earlier escalation", () => {
    const later = { ...answered, createdAt: "2026-07-01T10:00:00.000Z" };
    expect(rulingOf("closed", [question, later], [escalation])).toBe("answer");
  });

  it("does not take any note from Automation for a hand-over, only an escalation", () => {
    const aside = { ...escalation, body: "Synced the contact record." };
    expect(rulingOf("closed", [question, answered], [aside])).toBe("answer");
  });

  it("is an answer when Automation replied and the ticket is finished", () => {
    expect(rulingOf("closed", [question, answered], [])).toBe("answer");
  });

  it("is a question when Automation's one-sentence question is the last word and the ticket is open", () => {
    expect(rulingOf("open", [asked, question], [])).toBe("clarify");
  });

  it("reads an answer that closes with a courtesy question as an answer", () => {
    const courtesy = {
      ...answered,
      body: "Download the template from the import screen. Does that help?",
    };
    expect(rulingOf("open", [question, courtesy], [])).toBe("answer");
  });

  it("reads a question the customer has since replied to as an answer", () => {
    const reply = { ...question, id: "msg_r", createdAt: "2026-07-01T09:05:00.000Z" };
    expect(rulingOf("open", [question, asked, reply], [])).toBe("answer");
  });

  it("reads a question on a finished ticket as an answer", () => {
    expect(rulingOf("resolved", [question, asked], [])).toBe("answer");
  });

  it("reads messages in any order, newest first included", () => {
    const later = { ...answered, createdAt: "2026-07-01T10:00:00.000Z" };
    expect(rulingOf("open", [later, asked, question], [])).toBe("answer");
  });

  it("has no ruling where Automation never wrote", () => {
    expect(rulingOf("open", [question], [note()])).toBeUndefined();
  });
});

describe("why a ticket was handed over", () => {
  it("names the reason in words beside the service's own code", () => {
    expect(handOverReason([escalation])).toEqual({
      code: "model_declined",
      words: "the model declined to answer",
    });
    expect(verdictOf("escalate", handOverReason([escalation]))).toBe(
      "Handed to a person: the model declined to answer.",
    );
  });

  it("shows a code it has no words for as it came", () => {
    const odd = { ...escalation, body: "Escalation reason: something_new\n\nDetail." };
    expect(handOverReason([odd])?.words).toBe("Automation gave the reason something_new");
  });

  it("is nothing when only colleagues wrote notes", () => {
    expect(handOverReason([note()])).toBeUndefined();
  });

  it("reads the gate's two figures only when the note states both", () => {
    const gate = {
      ...escalation,
      body: "Escalation reason: gate_uncertain\n\nFree signals: retrieval top score 1.07, post-rerank margin 0.01, sensitive-category score 0.00.",
    };
    expect(gateSignals([gate])).toEqual({ topScore: 1.07, margin: 0.01 });
    expect(gateSignals([escalation])).toBeUndefined();
  });
});
