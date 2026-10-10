import { describe, expect, it } from "vitest";

import { ticket } from "@/tickets/tickets.fixtures";

import { holderOf, needsPerson } from "./holder";

describe("who has a ticket now", () => {
  it("needs a person when it is open and nobody has claimed it", () => {
    expect(holderOf(ticket({ state: "open", assigneeId: null }))).toBe("needs-person");
    expect(holderOf(ticket({ state: "pending", assigneeId: null }))).toBe("needs-person");
  });

  it("is with the reader when it is assigned to them", () => {
    expect(holderOf(ticket({ assigneeId: "usr_1" }), "usr_1")).toBe("you");
  });

  it("is with a colleague when it is assigned to someone else", () => {
    expect(holderOf(ticket({ assigneeId: "usr_2" }), "usr_1")).toBe("colleague");
  });

  it("is finished once resolved or closed, whoever had it", () => {
    expect(holderOf(ticket({ state: "resolved", assigneeId: null }))).toBe("finished");
    expect(holderOf(ticket({ state: "closed", assigneeId: "usr_1" }), "usr_1")).toBe("finished");
  });

  it("is on hold, and not waiting on anybody, while parked", () => {
    expect(needsPerson(ticket({ state: "on_hold", assigneeId: null }))).toBe(false);
  });
});
