/**
 * The transition table, checked for the properties the API states — not
 * restated.
 *
 * A test that spelled the table out a second time would pass whenever the two
 * copies agreed and say nothing about whether either was right. What is worth
 * asserting is the shape of the rules: which states are ways out, which are ways
 * in, and which is a dead end.
 */
import { describe, expect, it } from "vitest";

import { TICKET_STATE_LABELS, type TicketState } from "./ticket";
import { acceptsPriorityChange, TICKET_TRANSITIONS } from "./ticket-transitions";

const STATES = Object.keys(TICKET_STATE_LABELS) as TicketState[];

describe("where a Ticket may go from where it is", () => {
  it("models five states, not the realtime document's four", () => {
    expect(STATES).toContain("on_hold");
    expect(Object.keys(TICKET_TRANSITIONS)).toHaveLength(5);
  });

  it("leads nowhere out of closed, which is terminal", () => {
    expect(TICKET_TRANSITIONS.closed).toEqual([]);
  });

  /**
   * The one path to a locked record. Offering it from an active state would
   * skip the resolution the API requires, and the reader would find out by
   * being refused — which is the thing this table exists to prevent.
   */
  it("reaches closed only from resolved", () => {
    const from = STATES.filter((state) => TICKET_TRANSITIONS[state].includes("closed"));
    expect(from).toEqual(["resolved"]);
  });

  it("interconverts the three active states freely, and resolves any of them", () => {
    expect([...TICKET_TRANSITIONS.open].sort()).toEqual(["on_hold", "pending", "resolved"]);
    expect([...TICKET_TRANSITIONS.pending].sort()).toEqual(["on_hold", "open", "resolved"]);
    expect([...TICKET_TRANSITIONS.on_hold].sort()).toEqual(["open", "pending", "resolved"]);
  });

  it("reopens a resolved Ticket to open, and not to the other two active states", () => {
    expect(TICKET_TRANSITIONS.resolved).toContain("open");
    expect(TICKET_TRANSITIONS.resolved).not.toContain("pending");
    expect(TICKET_TRANSITIONS.resolved).not.toContain("on_hold");
  });

  /**
   * A move to where the Ticket already is is not a transition, and the API
   * refuses it. Offered in a list of destinations it would read as a change.
   */
  it("never offers a state as a way out of itself", () => {
    for (const state of STATES) {
      expect(TICKET_TRANSITIONS[state]).not.toContain(state);
    }
  });
});

describe("whether a priority may still be edited", () => {
  it("accepts one in every state a Ticket can be worked in", () => {
    for (const state of STATES.filter((held) => held !== "closed")) {
      expect(acceptsPriorityChange(state)).toBe(true);
    }
  });

  /**
   * Not a permission and not a state transition — a `closed` Ticket is a locked
   * record, and the API answers 409 to a priority edit on one.
   */
  it("refuses one on a closed Ticket", () => {
    expect(acceptsPriorityChange("closed")).toBe(false);
  });
});
