import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { LiveNotice } from "./live-notice";
import { LiveNoticesProvider, NoticeBell, useLiveNotices } from "./live-notices";

/**
 * The notification centre, and the one thing about it that is easy to get
 * wrong.
 *
 * Moving these out of the page and behind a bell is a layout decision. Keeping
 * them *announced* while the bell is shut is not — a `log` rendered only when
 * the panel is open reports nothing at the moment a breach lands, which is the
 * only moment this component exists for. These tests are mostly about that.
 */
function Raise({ notices }: { notices: LiveNotice[] }) {
  const { raise } = useLiveNotices();

  return (
    <button type="button" onClick={() => notices.forEach(raise)}>
      raise
    </button>
  );
}

const notice = (id: string, what: string): LiveNotice => ({
  id,
  what,
  at: "2026-07-03T09:00:00.000Z",
});

function renderBell(notices: LiveNotice[]) {
  render(
    <LiveNoticesProvider>
      <NoticeBell />
      <Raise notices={notices} />
    </LiveNoticesProvider>,
  );

  return userEvent.setup();
}

const log = () => screen.getByRole("log", { name: /what has happened/i });
const bell = () => screen.getByRole("button", { name: /what has happened/i });

describe("with nothing to report", () => {
  it("is already watching, so the first one is announced", () => {
    renderBell([]);

    // Mounted before anything arrives. A live region inserted at the same
    // moment as its content is frequently never announced at all.
    expect(log()).toBeInTheDocument();
  });

  it("offers nothing to open", () => {
    renderBell([]);

    expect(bell()).toBeDisabled();
  });
});

describe("with the panel shut", () => {
  it("still announces what arrived", async () => {
    const user = renderBell([notice("n1", "SLA breached on tkt_1")]);

    await user.click(screen.getByRole("button", { name: "raise" }));

    // The whole point. The reader has not opened anything, and the breach has
    // been reported regardless.
    expect(bell()).toHaveAttribute("aria-expanded", "false");
    expect(log()).toHaveTextContent("SLA breached on tkt_1");
  });

  it("counts what is waiting in the control's own name", async () => {
    const user = renderBell([notice("n1", "One"), notice("n2", "Two")]);

    await user.click(screen.getByRole("button", { name: "raise" }));

    // In the name, not only in the badge — a badge is a coloured circle, which
    // is a thing you can see or not see.
    expect(screen.getByRole("button", { name: /2 notices/i })).toBeVisible();
  });
});

describe("with the panel open", () => {
  it("lists them, and lets one be put down", async () => {
    const user = renderBell([notice("n1", "One"), notice("n2", "Two")]);
    await user.click(screen.getByRole("button", { name: "raise" }));

    await user.click(bell());
    expect(bell()).toHaveAttribute("aria-expanded", "true");

    // One row per notice, each with its own way to put it down. That there are
    // two of them is what says the panel rendered the list rather than a count.
    const putDown = screen.getAllByRole("button", { name: /^dismiss$/i });
    expect(putDown).toHaveLength(2);

    await user.click(putDown[0]!);

    expect(screen.getByRole("button", { name: /1 notice\./i })).toBeVisible();
  });

  it("closes on Escape and gives the focus back", async () => {
    const user = renderBell([notice("n1", "One")]);
    await user.click(screen.getByRole("button", { name: "raise" }));

    await user.click(bell());
    await user.keyboard("{Escape}");

    expect(bell()).toHaveAttribute("aria-expanded", "false");
    // Closing a panel and leaving the caret at the top of the document is how
    // a keyboard reader loses their place on a screen they had not finished.
    expect(bell()).toHaveFocus();
  });

  it("shuts itself when the last one is dismissed", async () => {
    const user = renderBell([notice("n1", "One")]);
    await user.click(screen.getByRole("button", { name: "raise" }));

    await user.click(bell());
    await user.click(screen.getByRole("button", { name: /^dismiss$/i }));

    // Nothing left to show, so nothing left open — and the control that opened
    // it goes back to reporting that there is nothing to report.
    expect(bell()).toBeDisabled();
    expect(bell()).toHaveAttribute("aria-expanded", "false");
  });
});
