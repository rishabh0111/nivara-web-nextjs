"use client";

/**
 * The bar across the top of every staff screen.
 *
 * One component for the two Surfaces a User moves between, because "where am I
 * and where else can I go" is the same question on both and answering it twice
 * is how the two drift into disagreeing about which screens exist.
 *
 * Which screen is current arrives as a prop rather than being read from the
 * router. Nothing else in this repository asks the router where it is — the
 * pages are rendered directly in tests, with no App Router around them — and a
 * navigation bar that threw outside a router would make every one of those
 * tests a router-mounting exercise.
 */
import Link from "next/link";

import { Wordmark } from "@/ui/logo";
import { ThemeToggle } from "@/ui/theme";

import { NoticeBell } from "./live-notices";
import { useIsMobileViewport } from "@/ui/viewport";
import { isDemoStaff } from "./demo-orientation";
import { canReadAnalytics, STAFF_ROLE_LABELS, type StaffPrincipal } from "./staff-principal";
import { useSignOut } from "./use-sign-out";

/** The screens this bar knows about, named as the reader would name them. */
type Screen = "queue" | "analytics";

const SCREENS: { screen: Screen; label: string; href: string; icon: React.ReactNode }[] = [
  {
    screen: "queue",
    label: "Tickets",
    href: "/dashboard",
    icon: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  },
  {
    screen: "analytics",
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: <path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-8" />,
  },
];

export function DashboardNav({
  current,
  principal,
}: {
  current: Screen;
  /** Whoever is signed in. Absent until the API has said who they are. */
  principal: StaffPrincipal | undefined;
}) {
  const signOut = useSignOut();

  // Read once here and shared with the bar below via a prop, rather than each
  // calling the hook itself: two independent `matchMedia` listeners deciding
  // the same question is two chances for them to answer it differently, if
  // only for the one frame between two renders.
  const narrow = useIsMobileViewport();

  return (
    <>
      {/* Sticky, because the queue is longer than the window and a reader who
          has scrolled to the bottom of it should not have to come back up to
          leave. */}
      <header className="sticky top-0 z-40 bg-frame">
        <div className="flex h-12 w-full items-center gap-2 px-4 sm:gap-x-8 sm:px-6">
          {/*
          The mark is not a link. The only place it could go is the screen the
          reader is already on, and a logo that navigates nowhere is a tab stop
          that costs a keyboard reader a press to discover it does nothing.

          The name is kept on screen at every width, unlike the labels further
          along this bar: it is the one word that says which product this is.
          On the demo account the workspace follows it, because "Meridian" is
          who the visitor is working for and nothing else on screen says so.
        */}
          <p className="flex min-w-0 shrink-0 items-center gap-2 text-sm">
            <Wordmark />
            {isDemoStaff(principal) ? (
              <span className="hidden text-ink-muted md:inline">
                <span aria-hidden="true" className="px-1.5 text-line-strong">
                  /
                </span>
                Meridian
              </span>
            ) : null}
          </p>

          {/*
            Not rendered at all below `sm`, where `DashboardBottomNav` carries
            the same two destinations as a tab bar instead — freeing the width
            the wordmark above needs, and putting primary navigation where a
            thumb already expects it on a phone.

            The `hidden sm:flex` classes are not what makes that true: they only
            hide this element visually, in a real browser, once a stylesheet is
            there to apply them. `narrow` is what actually decides whether this
            exists — the same state `DashboardBottomNav` is gated on — because
            only one of the two navs can be mounted at once without a phone's
            screen reader reading two "Analytics" links off its rotor.
          */}
          {!narrow ? (
            <nav aria-label="Dashboard" className="hidden h-full items-stretch gap-5 sm:flex">
              {SCREENS.map((entry) => {
                // Analytics is offered on the role and refused by the API. Absent
                // rather than disabled for an agent: an affordance that is there but
                // refuses is a promise the role does not keep.
                if (entry.screen === "analytics" && !canReadAnalytics(principal)) return null;

                const here = entry.screen === current;

                const inner = (
                  <>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-4"
                    >
                      {entry.icon}
                    </svg>
                    <span className="sr-only sm:not-sr-only">{entry.label}</span>
                  </>
                );

                // The active tab is a 2px ink underline and nothing else: the
                // frame stays grey, and the colour on this screen is the work's.
                const shape =
                  "flex items-center gap-2 border-b-2 pt-0.5 text-sm font-medium transition-colors duration-150";

                // The current screen is text, not a link. It is marked `aria-current`
                // for a reader who cannot see which one is lit, and it is deliberately
                // not focusable: a link to the page you are already on is a tab stop
                // that goes nowhere.
                return here ? (
                  <span
                    key={entry.screen}
                    aria-current="page"
                    className={`${shape} border-ink text-ink`}
                  >
                    {inner}
                  </span>
                ) : (
                  <Link
                    key={entry.screen}
                    href={entry.href}
                    className={`${shape} border-transparent text-ink-muted hover:text-ink`}
                  >
                    {inner}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/*
            Before the identity and the way out, because it is the only control
            on this bar that is about the tenant's work rather than about the
            reader. What it reports is frequently a Ticket that is not the one
            on screen, which is exactly why it belongs to the whole Surface and
            not to any screen inside it.
          */}
            <NoticeBell />

            {principal ? (
              <p className="flex items-center gap-2 pl-1 sm:pr-2">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-medium text-ink"
                >
                  {principal.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="block text-[0.8125rem] font-medium">
                    {principal.name}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {STAFF_ROLE_LABELS[principal.role]}
                  </span>
                </span>
              </p>
            ) : null}

            {/*
            The word is kept beside the icon rather than replaced by it. This is
            the one control on the bar that ends the session, and an icon alone
            is a guess a reader makes with their credential.
          */}
            <button
              type="button"
              onClick={() => void signOut()}
              className="btn btn-frame !min-h-9 px-2.5"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              <span className="sr-only sm:not-sr-only">Sign out</span>
            </button>

            {/*
            Last, both in the markup and on screen. The first Tab on this
            screen is meant to land on Analytics — a preference control nobody
            came here to set should not stand in front of the work.
          */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <DashboardBottomNav narrow={narrow} current={current} principal={principal} />
    </>
  );
}

/**
 * The same two destinations, as a tab bar a thumb can reach.
 *
 * A second component rather than a media-queried branch inside the header,
 * because it is not a restyling of the same markup — it is fixed to the foot
 * of the viewport rather than flowing with the page, and it needs the reader's
 * own content padded so the last row of the queue does not disappear under it.
 *
 * Gated on `useIsMobileViewport` rather than a `sm:hidden` class, and that is
 * the whole reason this can share `current` and `SCREENS` with the header
 * above without the two ever disagreeing about which destinations exist: CSS
 * visibility hides an element but leaves it in the tab order and in the
 * accessibility tree, so a horizontal nav merely hidden by width would still
 * cost a keyboard reader a press on desktop, and a phone would carry two
 * copies of "Analytics" through a screen reader's rotor. Rendering nothing at
 * all on a wide viewport is the only way to make both bars mean what they say.
 */
function DashboardBottomNav({
  narrow,
  current,
  principal,
}: {
  narrow: boolean;
  current: Screen;
  principal: StaffPrincipal | undefined;
}) {
  if (!narrow) return null;

  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-frame"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {SCREENS.map((entry) => {
          // The same rule as the header above, said once and read twice: an
          // affordance that is there but refuses is a promise the role does
          // not keep.
          if (entry.screen === "analytics" && !canReadAnalytics(principal)) return null;

          const here = entry.screen === current;

          const inner = (
            <>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
              >
                {entry.icon}
              </svg>
              {/* Labelled in full here, unlike the icon-only condensed header —
                  a tab bar with unlabelled icons is a guessing game, and there
                  is no shortage of width in a column this narrow. */}
              <span className="text-xs font-medium">{entry.label}</span>
            </>
          );

          const shape = "flex flex-1 flex-col items-center justify-center gap-1 py-2.5";

          return here ? (
            <span key={entry.screen} aria-current="page" className={`${shape} text-ink`}>
              {inner}
            </span>
          ) : (
            <Link
              key={entry.screen}
              href={entry.href}
              className={`${shape} text-ink-muted transition-colors duration-150 active:bg-sheet-step`}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
