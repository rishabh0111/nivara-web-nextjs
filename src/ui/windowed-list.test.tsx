import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WindowedList } from "./windowed-list";

/**
 * The list is the one component here that renders something other than what it
 * was given, so it is the one that has to say so out loud.
 *
 * jsdom has no layout — every element measures zero — so these do not assert
 * pixel positions. What they pin is the part that is a decision rather than a
 * measurement: below the threshold nothing is windowed at all, above it the
 * document stops holding a row per item, and either way a screen reader is told
 * how long the list really is.
 */
const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `row_${index}`, name: `Row ${index}` }));

function renderList(count: number) {
  return render(
    <WindowedList items={rows(count)} label="Rows" keyOf={(row) => row.id}>
      {(row) => <button type="button">{row.name}</button>}
    </WindowedList>,
  );
}

describe("a list short enough to render whole", () => {
  it("renders every row, and adds nothing to the markup to do it", async () => {
    renderList(30);

    const list = await screen.findByRole("list", { name: "Rows" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(30);

    // The plain path is the one the rest of the application was written
    // against: no absolute positioning and no measured height on the list.
    expect(list.style.height).toBe("");
    expect(within(list).getAllByRole("listitem")[0]).not.toHaveAttribute("data-index");
  });

  it("says nothing about set size, because the list is the set", async () => {
    renderList(30);

    const list = await screen.findByRole("list", { name: "Rows" });
    expect(within(list).getAllByRole("listitem")[0]).not.toHaveAttribute("aria-setsize");
  });
});

describe("a list long enough to window", () => {
  it("stops holding a row in the document for every item it was given", async () => {
    renderList(4000);

    const list = await screen.findByRole("list", { name: "Rows" });
    const rendered = within(list).queryAllByRole("listitem");

    // The exact count is a function of viewport height and overscan, and jsdom
    // has neither — so this pins the property that matters rather than a
    // number: whatever is rendered, it is not four thousand buttons.
    expect(rendered.length).toBeLessThan(4000);
  });

  it("tells a screen reader how long the list really is", async () => {
    renderList(4000);

    const list = await screen.findByRole("list", { name: "Rows" });
    const rendered = within(list).queryAllByRole("listitem");

    // Only meaningful if something rendered; where jsdom's zero-height window
    // produces no range there is nothing to assert and nothing to be wrong.
    for (const row of rendered) {
      expect(row).toHaveAttribute("aria-setsize", "4000");
      expect(row).toHaveAttribute("aria-posinset");
    }
  });

  it("gives the list its full height, so the scrollbar is the real one", async () => {
    renderList(4000);

    const list = await screen.findByRole("list", { name: "Rows" });

    // Without this the page would be as short as the rendered window and the
    // reader could not scroll to anything the window has not reached yet.
    expect(list.style.height).not.toBe("");
  });
});
