import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useToaster, type ToastKind } from "./toast";

/**
 * What is pinned here is the difference between the two kinds, because that is
 * the part that is a decision rather than a style: one interrupts and stays,
 * the other waits its turn and leaves.
 */
function Sender({ kind, text }: { kind: ToastKind; text: string }) {
  const toaster = useToaster();

  return (
    <button type="button" onClick={() => toaster.show(kind, text)}>
      say it
    </button>
  );
}

function renderToaster(kind: ToastKind, text: string) {
  return render(
    <ToastProvider>
      <Sender kind={kind} text={text} />
    </ToastProvider>,
  );
}

afterEach(() => vi.useRealTimers());

describe("the region itself", () => {
  it("is watching before anything arrives in it", () => {
    render(
      <ToastProvider>
        <span />
      </ToastProvider>,
    );

    // A live region inserted at the same moment as its content is frequently
    // never announced, so the empty region has to be in the document already.
    const region = screen.getByRole("region", { name: /what just happened/i });
    expect(region).toHaveAttribute("aria-live", "polite");
  });
});

describe("a receipt", () => {
  it("is announced politely, and takes itself away", async () => {
    vi.useFakeTimers();

    renderToaster("outcome", "State is now Pending.");
    // `fireEvent` rather than `userEvent` here on purpose: userEvent's pointer
    // sequence awaits scheduling that a faked clock never delivers, so the two
    // deadlock. Nothing about this test is about how the click was produced.
    fireEvent.click(screen.getByRole("button", { name: "say it" }));

    expect(screen.getByText("State is now Pending.")).toBeVisible();
    // Polite, not an alert: nothing about a receipt should cut across whatever
    // the reader is in the middle of.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByText("State is now Pending.")).not.toBeInTheDocument();
  });
});

describe("a refusal", () => {
  it("interrupts, and stays until it is put down", async () => {
    vi.useFakeTimers();

    renderToaster("failure", "That ticket could not be moved.");
    fireEvent.click(screen.getByRole("button", { name: "say it" }));

    expect(screen.getByRole("alert")).toHaveTextContent("That ticket could not be moved.");

    // Well past the receipt's lifetime. A sentence saying the reader's
    // understanding of the screen is wrong does not time out while they are
    // reading something else.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("can be dismissed", async () => {
    const user = userEvent.setup();

    renderToaster("failure", "That ticket could not be moved.");
    await user.click(screen.getByRole("button", { name: "say it" }));
    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the same thing said twice", () => {
  it("is one line, not a pile of identical ones", async () => {
    const user = userEvent.setup();

    renderToaster("failure", "That ticket could not be moved.");
    const say = screen.getByRole("button", { name: "say it" });

    await user.click(say);
    await user.click(say);
    await user.click(say);

    // One event reported three times — a retry, or two controls reporting the
    // same write — is still one thing that happened.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
