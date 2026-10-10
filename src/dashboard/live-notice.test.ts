import { describe, expect, it } from "vitest";

import { nameTicket } from "./live-notice";

/**
 * A notice names its Ticket the way the queue does. A whole UUID in a sentence
 * is a wall nobody reads, and nothing is fetched just to word one better.
 */
describe("naming the Ticket a notice is about", () => {
  const id = "01a177f5-6b8b-71a9-a0d5-47f078a5c332";

  it("uses the subject when it has already been read", () => {
    expect(nameTicket(id, () => "Refund window on an annual plan")).toBe(
      "“Refund window on an annual plan”",
    );
  });

  it("falls back to the start of the id when the subject is not known", () => {
    expect(nameTicket(id, () => undefined)).toBe("ticket 01a177f5");
    expect(nameTicket(id)).toBe("ticket 01a177f5");
  });
});
