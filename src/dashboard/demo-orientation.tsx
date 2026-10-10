"use client";

/**
 * Where a visitor who pressed "live demo" has landed, said once.
 *
 * Someone arriving from the product page has never seen this queue. They are
 * signed in as somebody, at a company, in front of a list whose rows arrived
 * from three places and some of which the AI has already answered — and none
 * of that is on the screen unless it is said. This says it in three lines and
 * then gets out of the way: it is shown only to the seeded demo account, and a
 * press puts it down for good in this browser.
 *
 * It reads nothing and writes nothing to the API. Everything in it is either
 * the principal already on screen or a fact about the seeded data.
 */
import Link from "next/link";
import { useState } from "react";

import { DEMO_STAFF } from "@/session/demo-credentials";

import { canReadAnalytics, STAFF_ROLE_LABELS, type StaffPrincipal } from "./staff-principal";

/** Where the dismissal is remembered. Per browser, and only a convenience. */
export const ORIENTATION_DISMISSED_KEY = "nivara.demo-orientation.dismissed";

/** Whether this principal is the seeded demo admin the `?demo` link signs in as. */
export function isDemoStaff(principal: StaffPrincipal | undefined): boolean {
  return (
    principal?.email === DEMO_STAFF.credentials.email &&
    principal.tenantId === DEMO_STAFF.credentials.tenantId
  );
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(ORIENTATION_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(ORIENTATION_DISMISSED_KEY, "1");
  } catch {
    // Storage refused (a private window, blocked site data). Dismissed for this
    // visit regardless; it comes back next time, which is harmless.
  }
}

export function DemoOrientation({ principal }: { principal: StaffPrincipal | undefined }) {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed || !principal || !isDemoStaff(principal)) return null;

  const role = STAFF_ROLE_LABELS[principal.role].toLowerCase();

  return (
    <section
      aria-labelledby="demo-orientation-heading"
      className="rounded-card border border-accent/25 bg-accent-wash px-4 py-3.5 sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h2 id="demo-orientation-heading" className="text-sm font-semibold tracking-tight">
            You are {principal.name}, {role} at Meridian, a demo company on Nivara Desk.
          </h2>
          <p className="max-w-[75ch] text-sm leading-relaxed text-ink-muted">
            This is Meridian&rsquo;s support queue. Tickets come in from the portal, the website
            widget and Slack; the AI answers what the help centre covers, signed{" "}
            <em>Automation</em>, and hands the rest to a person.
          </p>
          <p className="max-w-[75ch] text-sm leading-relaxed">
            Open any ticket below, or{" "}
            <Link href="/widget" className="link">
              ask the widget a question
            </Link>
            {canReadAnalytics(principal) ? ", " : " or "}
            <Link href="/portal?demo" className="link">
              raise one as a customer
            </Link>
            {canReadAnalytics(principal) ? (
              <>
                {" "}
                or{" "}
                <Link href="/dashboard/analytics" className="link">
                  read the analytics
                </Link>
              </>
            ) : null}
            .
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            writeDismissed();
            setDismissed(true);
          }}
          aria-label="Dismiss this introduction"
          className="btn btn-quiet !min-h-0 shrink-0 p-2"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </section>
  );
}
