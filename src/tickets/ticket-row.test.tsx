import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MessageRow } from "./message-row";
import { TicketRow } from "./ticket-row";
import type { Ticket } from "./ticket";

/**
 * The two rows carry meaning in colour — a state chip, a priority dot, a side
 * of the conversation — and colour is the thing a reader may not have. So what
 * these pin is not the classes but the words: whatever the tint is doing, the
 * same fact is also written down.
 */
const ticket = (over: Partial<Ticket> = {}): Ticket =>
  ({
    id: "tkt_1",
    subject: "The printer is on fire",
    state: "open",
    priority: "urgent",
    source: "portal",
    contactId: "con_1",
    assigneeId: null,
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-07-02T09:00:00.000Z",
    ...over,
  }) as Ticket;

describe("a Ticket as one row of a list", () => {
  it("writes the state and the priority out, never only as a colour", () => {
    render(<TicketRow ticket={ticket({ state: "on_hold", priority: "high" })} />);

    expect(screen.getByText("On hold")).toBeVisible();
    expect(screen.getByText("High")).toBeVisible();
  });

  it("names the subject first, so the row is announced by what it is about", () => {
    const { container } = render(<TicketRow ticket={ticket()} />);

    // The queue reads the first span as the subject, and the grid places the
    // state chip beside it visually without moving it in the markup.
    expect(container.querySelector("span")).toHaveTextContent("The printer is on fire");
  });

  it("carries the instant alongside the reading of it", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-07-02T12:00:00.000Z"));

    render(<TicketRow ticket={ticket()} />);

    expect(screen.getByText(/3 hours ago/)).toHaveAttribute("datetime", "2026-07-02T09:00:00.000Z");

    vi.useRealTimers();
  });

  it("keeps the priority dot out of the accessibility tree", () => {
    const { container } = render(<TicketRow ticket={ticket({ priority: "urgent" })} />);

    // The word "Urgent" is the accessible fact; the dot beside it is decoration
    // and must not be announced as a second thing.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(screen.getByText("Urgent")).toBeVisible();
  });
});

describe("a Message in a thread", () => {
  it("attributes it by name, not only by which side it sits on", () => {
    render(
      <ul>
        <MessageRow author="Support" body="We are sending someone." side="theirs">
          <time dateTime="2026-07-01T10:00:00.000Z">an hour ago</time>
        </MessageRow>
      </ul>,
    );

    expect(screen.getByText("Support")).toBeVisible();
    expect(screen.getByText("We are sending someone.")).toBeVisible();
  });

  it("renders the initial disc for the eye only", () => {
    const { container } = render(
      <ul>
        <MessageRow author="Ada" body="Still on fire." side="mine">
          <time dateTime="2026-07-01T10:00:00.000Z">an hour ago</time>
        </MessageRow>
      </ul>,
    );

    const disc = container.querySelector('[aria-hidden="true"]');
    expect(disc).toHaveTextContent("A");
    // The name is written out beside it, so the disc is never the only source.
    expect(screen.getByText("Ada")).toBeVisible();
  });

  it("keeps what somebody typed verbatim, including their line breaks", () => {
    render(
      <ul>
        <MessageRow author="Ada" body={"One.\nTwo."} side="mine">
          <time dateTime="2026-07-01T10:00:00.000Z">an hour ago</time>
        </MessageRow>
      </ul>,
    );

    expect(screen.getByText(/One\.\s*Two\./)).toHaveClass("whitespace-pre-wrap");
  });
});
