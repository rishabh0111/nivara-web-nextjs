import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobileViewport } from "./viewport";

/**
 * The one hook standing between a bottom tab bar and a horizontal nav that
 * both exist at once — so what it gets right or wrong is not cosmetic. Get it
 * wrong and either a phone loses its primary navigation, or a desktop carries
 * two copies of every destination through a screen reader's rotor.
 */
function mockMatchMedia(initiallyMatches: boolean) {
  let matches = initiallyMatches;
  let onChange: (() => void) | undefined;

  const query = {
    get matches() {
      return matches;
    },
    addEventListener: (_: "change", listener: () => void) => {
      onChange = listener;
    },
    removeEventListener: () => {
      onChange = undefined;
    },
  };

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );

  return {
    change(next: boolean) {
      matches = next;
      onChange?.();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("with no matchMedia in the environment", () => {
  it("answers desktop rather than throwing", () => {
    // No stub installed: this is what a test environment gives it, and it is
    // the fallback this repository already gives an absent IntersectionObserver.
    const { result } = renderHook(() => useIsMobileViewport());

    expect(result.current).toBe(false);
  });
});

describe("with matchMedia available", () => {
  it("reads the viewport once mounted", () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => useIsMobileViewport());

    expect(result.current).toBe(true);
  });

  it("follows the viewport across a resize", () => {
    const media = mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobileViewport());
    expect(result.current).toBe(false);

    act(() => media.change(true));
    expect(result.current).toBe(true);

    act(() => media.change(false));
    expect(result.current).toBe(false);
  });
});
