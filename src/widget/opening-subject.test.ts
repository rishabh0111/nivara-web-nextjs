import { describe, expect, it } from "vitest";

import { openingSubject } from "./opening-subject";

describe("the subject a Visitor never typed", () => {
  it("is the message, where the message is short enough to be one", () => {
    expect(openingSubject("My order has not arrived")).toBe("My order has not arrived");
  });

  it("is the first line of a message that has several", () => {
    expect(openingSubject("Card declined\n\nIt says CVV invalid but the CVV is right.")).toBe(
      "Card declined",
    );
  });

  it("tidies the whitespace a paste leaves behind", () => {
    expect(openingSubject("   my   order\tis   late  ")).toBe("my order is late");
  });

  /**
   * Cut at a word, never mid-word, and marked as cut. A staff queue reads these
   * side by side, and "Hello I wanted to ask about the re" reads as a broken
   * record rather than as a long sentence.
   */
  it("cuts a long opening at a word and says it was cut", () => {
    const said =
      "I ordered two of the blue ones on Tuesday and only one of them arrived, and the box was open";

    const subject = openingSubject(said);

    expect(subject.length).toBeLessThanOrEqual(73);
    expect(subject.endsWith("…")).toBe(true);
    expect(said).toContain(subject.slice(0, -1).trimEnd());
    expect(subject).not.toMatch(/\s…$/);
  });

  /** A single unbroken run has no word to cut at, and is still cut. */
  it("cuts a long opening with no words in it at all", () => {
    const subject = openingSubject("x".repeat(200));

    expect(subject.length).toBeLessThanOrEqual(73);
    expect(subject.endsWith("…")).toBe(true);
  });

  /**
   * Never empty. The API requires a subject, and a Visitor who has typed only
   * whitespace has not sent anything — but this must not be the thing that
   * discovers it, because the answer would be a validation error about a field
   * they were never shown.
   */
  it("falls back to words of its own rather than to nothing", () => {
    expect(openingSubject("   ")).toBe("Support request");
    expect(openingSubject("")).toBe("Support request");
  });
});
