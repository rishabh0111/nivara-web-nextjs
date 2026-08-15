import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// The mocked suite reaches no network, so it supplies its own value rather than
// requiring the real one to be configured to run tests.
//
// Truthiness rather than `??=`: a workflow that names an unset repository
// variable sets this to the empty string, not to nothing, and an empty string
// is a value `??=` keeps. That path is CI's, so it fails only there — and it
// fails as five hundred tests reporting a missing variable, which reads as the
// suite being broken rather than as configuration being absent.
if (!process.env.NEXT_PUBLIC_API_URL) {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
}

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
