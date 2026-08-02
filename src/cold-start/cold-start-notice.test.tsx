import { act, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getApiClient } from "@/api/client";

import { ColdStartNotice } from "./cold-start-notice";
import { ACKNOWLEDGE_AFTER_MS, EXPLAIN_AFTER_MS } from "./phase";
import { useColdStartPhase } from "./use-cold-start";

const baseUrl = "https://api.test";
const server = setupServer();

/**
 * A response that has not arrived yet. Held open by a promise rather than by a
 * timer, so advancing fake timers moves the clock the phase is measured against
 * without also delivering the response we are waiting on.
 */
let release: (() => void) | undefined;

function hangingHandler(path: string) {
  return http.get(`${baseUrl}${path}`, async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return HttpResponse.json({ status: "ok" });
  });
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  release?.();
  release = undefined;
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
  vi.useRealTimers();
  server.resetHandlers();
});

afterAll(() => server.close());

async function waitFor(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("the Cold-start notice", () => {
  it("says nothing while the API answers promptly", async () => {
    server.use(http.get(`${baseUrl}/health`, () => HttpResponse.json({ status: "ok" })));

    render(<ColdStartNotice />);
    await waitFor(EXPLAIN_AFTER_MS);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("acknowledges the wait, then explains its cause", async () => {
    server.use(hangingHandler("/health"));

    render(<ColdStartNotice />);

    await waitFor(ACKNOWLEDGE_AFTER_MS - 1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await waitFor(1);
    expect(screen.getByRole("status")).toHaveTextContent(/waiting for the api/i);

    await waitFor(EXPLAIN_AFTER_MS - ACKNOWLEDGE_AFTER_MS);
    expect(screen.getByRole("status")).toHaveTextContent(/waking up/i);
  });

  it("names the cause in plain words rather than reporting a timeout", async () => {
    server.use(hangingHandler("/health"));

    render(<ColdStartNotice />);
    await waitFor(EXPLAIN_AFTER_MS);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(/sleeps when idle/i);
    expect(notice).not.toHaveTextContent(/timeout|timed out|error|failed/i);
  });

  it("clears itself when the answer arrives", async () => {
    server.use(hangingHandler("/health"));

    render(<ColdStartNotice />);
    await waitFor(EXPLAIN_AFTER_MS);
    expect(screen.getByRole("status")).toBeInTheDocument();

    release?.();
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not block the interface behind a screen that cannot be dismissed", async () => {
    server.use(hangingHandler("/health"));

    render(
      <>
        <button type="button">Sign in</button>
        <ColdStartNotice />
      </>,
    );
    await waitFor(EXPLAIN_AFTER_MS);

    const signIn = screen.getByRole("button", { name: "Sign in" });
    expect(signIn).toBeVisible();
    expect(signIn).toBeEnabled();

    const notice = screen.getByRole("status");
    expect(notice).not.toHaveAttribute("aria-modal");
    expect(notice.getAttribute("role")).toBe("status");
  });
});

describe("a request that goes slow later in a session", () => {
  function PhaseProbe() {
    // No probe: this is the request-derived half of the signal on its own.
    return <span data-testid="phase">{useColdStartPhase()}</span>;
  }

  it("gets the same treatment with no load-time probe involved", async () => {
    server.use(hangingHandler("/tickets"));

    render(<PhaseProbe />);
    expect(screen.getByTestId("phase")).toHaveTextContent("idle");

    void getApiClient().page("/tickets", "get", {});

    await waitFor(ACKNOWLEDGE_AFTER_MS);
    expect(screen.getByTestId("phase")).toHaveTextContent("acknowledged");

    await waitFor(EXPLAIN_AFTER_MS - ACKNOWLEDGE_AFTER_MS);
    expect(screen.getByTestId("phase")).toHaveTextContent("explained");
  });
});
