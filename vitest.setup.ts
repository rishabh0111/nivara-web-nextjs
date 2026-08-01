import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

process.env.NEXT_PUBLIC_API_URL ??= "https://api.test";

// `globals: false`, so React Testing Library's own auto-cleanup never runs.
afterEach(cleanup);

// The address bar outlives an unmounted tree, and surfaces that keep their
// state there — the Dashboard's queue does — would otherwise hand the next test
// the filters the last one chose. Each test is a fresh page, address included.
afterEach(() => window.history.replaceState(null, "", "/"));

// jsdom has no viewport to scroll, so it throws "not implemented" the moment
// anything asks. The windowed queue asks whenever it puts a reader back on the
// row they left. Stubbed rather than silenced, so a test that wants to know
// whether a scroll was requested can still watch this.
window.scrollTo = () => {};
