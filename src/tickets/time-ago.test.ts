import { describe, expect, it } from "vitest";

import { timeAgo } from "./time-ago";

const now = Date.parse("2026-07-02T12:00:00.000Z");

describe("how long ago something happened", () => {
  it("says just now for the last minute", () => {
    expect(timeAgo("2026-07-02T11:59:30.000Z", now)).toBe("just now");
  });

  it("counts in the largest unit that fits", () => {
    expect(timeAgo("2026-07-02T11:55:00.000Z", now)).toBe("5 minutes ago");
    expect(timeAgo("2026-07-02T09:00:00.000Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-06-30T12:00:00.000Z", now)).toBe("2 days ago");
  });

  it("names the day once counting back stops being a useful answer", () => {
    expect(timeAgo("2026-01-05T12:00:00.000Z", now)).toBe("5 January 2026");
  });

  it("does not report a clock ahead of ours as the future", () => {
    // The API stamps `updatedAt`; a browser clock a few seconds behind it must
    // not turn a Ticket that just changed into one changed "in 4 seconds".
    expect(timeAgo("2026-07-02T12:00:04.000Z", now)).toBe("just now");
  });
});
