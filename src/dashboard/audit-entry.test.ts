/**
 * The audit log, read as sentences.
 *
 * The API's own words for this are `fromValue` and `toValue` — two nullable
 * strings whose meaning depends entirely on the action beside them. Reading them
 * is the whole of this module, and the reason it is a module: a component that
 * did it inline would end up rendering `open → pending` in one place and a raw
 * `null` in another.
 */
import { describe, expect, it } from "vitest";

import { auditEntry as entry } from "@/tickets/tickets.fixtures";

import { describeAuditAction, describeAuditChange } from "./audit-entry";

describe("what happened", () => {
  it("names the action in the reader's words rather than the wire's", () => {
    expect(describeAuditAction(entry({ action: "ticket.transitioned" }))).toBe("State changed");
    expect(describeAuditAction(entry({ action: "ticket.created" }))).toBe("Ticket opened");
    expect(describeAuditAction(entry({ action: "sla.breached" }))).toBe("SLA breached");
  });
});

describe("what changed", () => {
  it("reads a transition's values as states, because the action says they are", () => {
    const change = describeAuditChange(
      entry({ action: "ticket.transitioned", fromValue: "open", toValue: "on_hold" }),
    );

    expect(change).toBe("Open → On hold");
  });

  it("reads a priority change's values as priorities", () => {
    const change = describeAuditChange(
      entry({ action: "ticket.priority_changed", fromValue: "normal", toValue: "urgent" }),
    );

    expect(change).toBe("Normal → Urgent");
  });

  /**
   * The one action where a null value is the answer rather than the absence of
   * one: nobody was responsible, or nobody is now, and both are changes worth
   * reading.
   */
  it("reads an unset assignee as nobody rather than dropping it", () => {
    expect(
      describeAuditChange(entry({ action: "ticket.assigned", fromValue: null, toValue: "usr_2" })),
    ).toBe("Unassigned → usr_2");

    expect(
      describeAuditChange(entry({ action: "ticket.assigned", fromValue: "usr_2", toValue: null })),
    ).toBe("usr_2 → Unassigned");
  });

  it("has nothing to say where the action carries no values", () => {
    expect(describeAuditChange(entry({ action: "ticket.created" }))).toBeUndefined();
  });

  it("names a destination alone where there was no prior value", () => {
    expect(
      describeAuditChange(
        entry({ action: "ticket.transitioned", fromValue: null, toValue: "open" }),
      ),
    ).toBe("Open");
  });

  /**
   * The value catalogs are the generated unions, and the log outlives the
   * release that wrote it. A state this build has never heard of is shown as it
   * was recorded — an audit entry rendered as blank is the one kind of history
   * that is worse than an ugly one.
   */
  it("shows a value it has no label for rather than hiding the entry", () => {
    const change = describeAuditChange(
      entry({ action: "ticket.transitioned", fromValue: "open", toValue: "escalated" }),
    );

    expect(change).toBe("Open → escalated");
  });
});
