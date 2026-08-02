import { describe, expect, it } from "vitest";

import { ACKNOWLEDGE_AFTER_MS, EXPLAIN_AFTER_MS, coldStartPhase, msUntilNextPhase } from "./phase";

describe("coldStartPhase", () => {
  it("says nothing when nothing is waiting", () => {
    expect(coldStartPhase(undefined)).toBe("idle");
  });

  it("says nothing about a wait short enough not to be one", () => {
    expect(coldStartPhase(ACKNOWLEDGE_AFTER_MS - 1)).toBe("idle");
  });

  it("acknowledges a wait, then explains it", () => {
    expect(coldStartPhase(ACKNOWLEDGE_AFTER_MS)).toBe("acknowledged");
    expect(coldStartPhase(EXPLAIN_AFTER_MS - 1)).toBe("acknowledged");
    expect(coldStartPhase(EXPLAIN_AFTER_MS)).toBe("explained");
  });
});

describe("msUntilNextPhase", () => {
  it("lands on the next threshold rather than polling", () => {
    expect(msUntilNextPhase(0)).toBe(ACKNOWLEDGE_AFTER_MS);
    expect(msUntilNextPhase(ACKNOWLEDGE_AFTER_MS)).toBe(EXPLAIN_AFTER_MS - ACKNOWLEDGE_AFTER_MS);
  });

  it("stops once there is nothing further to say", () => {
    expect(msUntilNextPhase(undefined)).toBeUndefined();
    expect(msUntilNextPhase(EXPLAIN_AFTER_MS)).toBeUndefined();
  });
});
