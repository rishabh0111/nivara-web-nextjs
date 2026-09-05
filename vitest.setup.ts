import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// The mocked suite reaches no network, and its request handlers are registered
// against exactly this origin. So the value is *forced* rather than defaulted:
// whatever the surrounding environment is pointed at, the suite is pointed
// here.
//
// It was a default, and the difference cost a CI run. A real URL in the
// environment — a workflow naming the deployed API, a developer exporting one
// — left the client calling an origin no handler matches, so requests escaped
// the mock and the failures read as broken components rather than as the suite
// talking to the wrong server.
process.env.NEXT_PUBLIC_API_URL = "https://api.test";

// Same reasoning, same fix, for nivara-ai: forced rather than defaulted so the
// suite's Widget tests call a mocked origin `widget.fixtures.ts` actually has
// handlers for, never whatever the surrounding environment happens to point at.
process.env.NEXT_PUBLIC_AI_URL = "https://ai.test";

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
