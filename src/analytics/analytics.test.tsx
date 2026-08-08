/**
 * One screen over one endpoint, and the two things it must not smooth over.
 *
 * A rate the API declined to answer must not render as zero, and no rate may
 * appear without the count it rests on. Both are asserted against a wire that
 * sends the shapes the API actually sends — an empty cohort with every rate
 * `null` and no durations at all.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { renderDashboard, ticket } from "@/dashboard/dashboard.fixtures";
import { SessionStore } from "@/session/store";

import type { AnalyticsReport } from "./analytics-report";
import type { AnalyticsCut } from "./analytics-window";
import {
  baseUrl,
  dashboardApi,
  emptyMetrics,
  group,
  principal,
  renderAnalytics,
  report,
  signedInStore,
} from "./analytics.fixtures";

const server = dashboardApi();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: SessionStore;
beforeEach(() => {
  store = signedInStore();
});

const asAdmin = http.get(`${baseUrl}/auth/me`, () =>
  HttpResponse.json(principal({ role: "admin" })),
);
const asAgent = http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(principal()));

/** The four cuts, as the screen asks for them, plus the report over everything. */
const CUTS: Record<AnalyticsCut, AnalyticsReport> = {
  priority: report({
    groupBy: "priority",
    groups: [group("urgent"), group("normal", { cohortSize: 40 })],
  }),
  source: report({ groupBy: "source", groups: [group("portal"), group("widget")] }),
  assignee: report({ groupBy: "assignee", groups: [group("usr_1"), group("usr_2")] }),
  day: report({
    groupBy: "day",
    groups: [
      group("2026-07-01"),
      // A day nobody raised anything on. Its rates are unanswered, and the line
      // has to break rather than dive to the floor.
      { ...emptyMetrics(), key: "2026-07-02" },
      group("2026-07-03", { deflection: { count: 2, rate: 0.5 } }),
    ],
  }),
};

/**
 * An API that answers whichever question it was asked, so a cut that never
 * reached the wire renders the wrong figures rather than silently passing.
 */
function reporting(asked: URLSearchParams[], overall: AnalyticsReport = report()) {
  return http.get(`${baseUrl}/analytics`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    asked.push(query);

    const cut = query.get("groupBy") as AnalyticsCut | null;
    if (!cut) return HttpResponse.json(overall);

    return HttpResponse.json({ ...CUTS[cut], overall: overall.overall });
  });
}

async function openAnalytics(asked: URLSearchParams[], overall?: AnalyticsReport) {
  server.use(asAdmin, reporting(asked, overall));
  renderAnalytics(store);
  // The headline, not the heading: the screen paints its title before it knows
  // who is reading, and a test that started there would be typing into controls
  // that are not on screen yet.
  await screen.findByRole("region", { name: /headline figures/i });
  return userEvent.setup();
}

/**
 * The value and explanation under one named figure.
 *
 * Scoped to the headline, because the cut tables name the same figures in their
 * column headers — which is the point of them, and not what this is asking about.
 */
async function tile(name: string): Promise<HTMLElement> {
  const headline = await screen.findByRole("region", { name: /headline figures/i });
  const term = within(headline).getByText(name, { exact: true });
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No figure under "${name}".`);
  return value;
}

describe("the headline figures", () => {
  it("reports four rates over the window, each with the count behind it", async () => {
    await openAnalytics([]);

    expect(within(await tile("Deflection")).getByText("26%")).toBeVisible();
    expect(within(await tile("Deflection")).getByText("312 of 1,204 Tickets")).toBeVisible();

    expect(within(await tile("Resolution")).getByText("75%")).toBeVisible();
    expect(within(await tile("Resolution")).getByText("900 of 1,204 Tickets")).toBeVisible();

    expect(within(await tile("First-response SLA breaches")).getByText("5%")).toBeVisible();
    expect(within(await tile("Resolution SLA breaches")).getByText("2%")).toBeVisible();
  });

  it("reports both duration percentiles, so the typical and the bad case are both visible", async () => {
    await openAnalytics([]);

    const firstResponse = within(await tile("First response time"));
    expect(firstResponse.getByText("4h 12m")).toBeVisible();
    expect(firstResponse.getByText("9h")).toBeVisible();

    const resolution = within(await tile("Resolution time"));
    expect(resolution.getByText("2d 3h")).toBeVisible();
    expect(resolution.getByText("5d")).toBeVisible();
  });

  /** Read off the answer, which carries the window it was computed over. */
  it("states the window the figures cover, ending on the last day inside it", async () => {
    await openAnalytics([]);

    expect(await screen.findByText(/1 Jul 2026/)).toBeVisible();
    expect(screen.getByText(/31 Jul 2026/)).toBeVisible();
  });
});

describe("an empty cohort", () => {
  it("renders no answer with an explanation, never a rate of zero", async () => {
    await openAnalytics([], report({ overall: emptyMetrics() }));

    const deflection = within(await tile("Deflection"));
    expect(deflection.getByText("—")).toBeVisible();
    expect(deflection.getByText("No Tickets in this window")).toBeVisible();

    // Nowhere among the figures. The chart's axis is labelled 0% and always is
    // — that is a scale, not a claim about a cohort.
    const headline = screen.getByRole("region", { name: /headline figures/i });
    expect(within(headline).queryByText("0%")).not.toBeInTheDocument();
  });

  /** The dash is a mark on a screen. A reader who cannot see it gets the words. */
  it("says there is no answer to a screen reader rather than showing it a dash", async () => {
    await openAnalytics([], report({ overall: emptyMetrics() }));

    expect(within(await tile("Deflection")).getByText("No answer")).toBeInTheDocument();
  });

  it("says a duration nothing was measured for is unmeasured, not instant", async () => {
    await openAnalytics([], report({ overall: emptyMetrics() }));

    const firstResponse = within(await tile("First response time"));
    expect(firstResponse.getByText("—")).toBeVisible();
    expect(firstResponse.getByText(/no ticket in this window was replied to/i)).toBeVisible();
  });
});

describe("choosing the window", () => {
  it("asks nothing about the window until the reader chooses one", async () => {
    const asked: URLSearchParams[] = [];
    await openAnalytics(asked);

    await waitFor(() => expect(asked.length).toBeGreaterThan(0));
    for (const query of asked) {
      expect(query.get("from")).toBeNull();
      expect(query.get("to")).toBeNull();
    }
  });

  it("asks every cut about the window the reader chose", async () => {
    const asked: URLSearchParams[] = [];
    const user = await openAnalytics(asked);

    await user.type(screen.getByLabelText(/^from$/i), "2026-07-01");
    await user.type(screen.getByLabelText(/^until$/i), "2026-07-31");

    await waitFor(() => {
      const windowed = asked.filter((query) => query.get("to") !== null);
      // Every cut and the report over everything: five questions, one window.
      expect(new Set(windowed.map((query) => query.get("groupBy"))).size).toBe(5);

      for (const query of windowed) {
        expect(query.get("from")).toBe("2026-06-30T18:30:00.000Z");
        // Exclusive, so the reader's last day is inside the window.
        expect(query.get("to")).toBe("2026-07-31T18:30:00.000Z");
      }
    });
  });
});

describe("the cuts", () => {
  it("breaks the figures down by priority and by source, as tables", async () => {
    await openAnalytics([]);

    const priority = await screen.findByRole("table", { name: /by priority/i });
    expect(within(priority).getByRole("row", { name: /urgent/i })).toBeVisible();
    expect(within(priority).getByRole("row", { name: /normal/i })).toBeVisible();

    const source = await screen.findByRole("table", { name: /by source/i });
    expect(within(source).getByRole("row", { name: /portal/i })).toBeVisible();
    expect(within(source).getByRole("row", { name: /widget/i })).toBeVisible();
  });

  /**
   * Where it is read, not in a footnote elsewhere. The groups do not sum to the
   * overall figure, and a reader who works that out for themselves has already
   * been misled once.
   */
  it("states the assignee cut's exclusion inside the assignee table", async () => {
    await openAnalytics([]);

    const assignee = await screen.findByRole("table", { name: /by assignee/i });
    expect(within(assignee).getByText(/excludes deflected and unassigned tickets/i)).toBeVisible();
  });

  /**
   * The assignee cut excludes deflected and unassigned Tickets by definition, so
   * it can be empty over a cohort that is not. Saying no Tickets were created
   * would contradict the figures sitting directly above it.
   */
  it("says why the assignee cut is empty without denying the cohort", async () => {
    server.use(
      asAdmin,
      http.get(`${baseUrl}/analytics`, ({ request }) => {
        const cut = new URL(request.url).searchParams.get("groupBy") as AnalyticsCut | null;
        if (cut === "assignee")
          return HttpResponse.json(report({ groupBy: "assignee", groups: [] }));
        return HttpResponse.json(cut ? CUTS[cut] : report());
      }),
    );
    renderAnalytics(store);

    expect(await screen.findByText(/was both assigned and worked by a user/i)).toBeVisible();
    expect(screen.queryByText(/no tickets were created in this window/i)).not.toBeInTheDocument();
  });

  /**
   * A rate with no answer inside a table has no room for the sentence a tile
   * puts underneath it, and the count that explains it is a column away.
   */
  it("explains an unanswered rate in a table cell, where the count is not beside it", async () => {
    server.use(
      asAdmin,
      http.get(`${baseUrl}/analytics`, ({ request }) => {
        const cut = new URL(request.url).searchParams.get("groupBy") as AnalyticsCut | null;
        if (cut === "priority") {
          return HttpResponse.json(
            report({ groupBy: "priority", groups: [{ ...emptyMetrics(), key: "urgent" }] }),
          );
        }
        return HttpResponse.json(cut ? CUTS[cut] : report());
      }),
    );
    renderAnalytics(store);

    const priority = await screen.findByRole("table", { name: /by priority/i });
    expect(within(priority).getAllByText(/no answer: no tickets in this window/i).length).toBe(4);
  });

  /**
   * The table is wider than the screen and scrolls sideways. A scrolling box
   * that cannot be focused is one a reader without a pointer cannot move, and
   * the columns past the edge would not exist for them.
   */
  it("lets a reader without a pointer scroll a table that is wider than the screen", async () => {
    await openAnalytics([]);

    // A div with no tabindex cannot take focus at all, so asking for it and
    // getting it is the whole assertion.
    const scrolling = await screen.findByRole("region", { name: /by priority/i });
    scrolling.focus();

    expect(scrolling).toHaveFocus();
  });

  it("draws the day cut as a line chart, because it is the only true series", async () => {
    await openAnalytics([]);

    expect(await screen.findByRole("img", { name: /by day/i })).toBeVisible();
  });

  /** A chart is a picture. The same numbers are there in words underneath it. */
  it("offers the day cut's numbers as a table as well as a picture", async () => {
    await openAnalytics([]);

    const days = await screen.findByRole("table", { name: /day by day/i });
    expect(within(days).getByRole("row", { name: /2026-07-01/ })).toBeInTheDocument();
  });

  /**
   * A day nobody raised anything on has no rate, and drawing it as zero would
   * put a crash in the trend that never happened.
   */
  it("breaks the line over a day with an empty cohort rather than plotting zero", async () => {
    await openAnalytics([]);

    const days = await screen.findByRole("table", { name: /day by day/i });
    const empty = within(days).getByRole("row", { name: /2026-07-02/ });
    expect(within(empty).getAllByText("—").length).toBeGreaterThan(0);

    // One path per series, and each breaks where the day with no answer sits.
    const chart = await screen.findByRole("img", { name: /by day/i });
    const drawn = chart.querySelectorAll("path[data-series]");
    expect(drawn.length).toBe(4);
    for (const path of drawn) {
      expect(path.getAttribute("d")).toMatch(/M.*M/s);
    }
  });
});

describe("who the screen is offered to", () => {
  it("is not linked to from the queue for a User without the permission", async () => {
    server.use(
      asAgent,
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket()], nextCursor: null }),
      ),
    );
    renderDashboard(store);
    await screen.findByRole("list", { name: /^tickets$/i });

    expect(screen.queryByRole("link", { name: /analytics/i })).not.toBeInTheDocument();
  });

  it("is linked to from the queue for a User who has it", async () => {
    server.use(
      asAdmin,
      http.get(`${baseUrl}/tickets`, () =>
        HttpResponse.json({ data: [ticket()], nextCursor: null }),
      ),
    );
    renderDashboard(store);

    expect(await screen.findByRole("link", { name: /analytics/i })).toBeVisible();
  });

  /** Reached by its URL anyway: refused in words, without asking a question. */
  it("says so plainly rather than asking the API a question it will refuse", async () => {
    const asked: URLSearchParams[] = [];
    server.use(asAgent, reporting(asked));
    renderAnalytics(store);

    expect(await screen.findByText(/not available to your role/i)).toBeVisible();
    expect(asked).toHaveLength(0);
    expect(screen.getByRole("link", { name: /tickets/i })).toBeVisible();
  });

  it("shows the sign-in form to somebody holding no credential at all", async () => {
    server.use(asAdmin, reporting([]));
    renderAnalytics(new SessionStore());

    expect(await screen.findByRole("button", { name: /sign in/i })).toBeVisible();
  });
});

describe("a refused report", () => {
  it("says what went wrong rather than rendering an empty screen", async () => {
    server.use(
      asAdmin,
      http.get(`${baseUrl}/analytics`, () =>
        HttpResponse.json(
          { error: { code: "internal_error", message: "Something broke." } },
          { status: 500 },
        ),
      ),
    );
    renderAnalytics(store);

    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
  });
});

describe("reading it without a pointer or a screen", () => {
  it("names the window controls, and reaches them by keyboard", async () => {
    const user = await openAnalytics([]);

    screen.getByLabelText(/^from$/i).focus();
    await user.keyboard("2026-07-01");
    await user.tab();

    expect(screen.getByLabelText(/^until$/i)).toHaveFocus();
    expect(screen.getByLabelText(/^from$/i)).toHaveValue("2026-07-01");
  });

  it("names the figures and the chart for a screen reader", async () => {
    await openAnalytics([]);

    expect(screen.getByRole("region", { name: /headline figures/i })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /by day/i })).toHaveAccessibleName();
  });
});
