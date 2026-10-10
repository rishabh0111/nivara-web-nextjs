"use client";

/**
 * Where a visitor who pressed "live demo" has landed, said once.
 *
 * Someone arriving from the product page has never seen this queue, and they
 * are signed in as somebody at a company. That much has to be said; what the
 * list is and what the AI did to it are shown by the rows themselves (the
 * ruling at the head of each), so this is one line: who you are, and the two
 * things to try that are not on this screen. Shown only to the seeded demo
 * account, and a press puts it down for good in this browser.
 *
 * It reads nothing and writes nothing to the API. Everything in it is either
 * the principal already on screen or a fact about the seeded data.
 */
import Link from "next/link";
import { useState } from "react";

import { DEMO_STAFF } from "@/session/demo-credentials";

import { STAFF_ROLE_LABELS, type StaffPrincipal } from "./staff-principal";

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
      className="flex items-center gap-x-4 rounded-card bg-sunken py-1 pr-1 pl-4 text-[0.8125rem]"
    >
      <h2 id="demo-orientation-heading" className="min-w-0 truncate font-normal">
        You are {principal.name}, {role} at Meridian, a demo company.
      </h2>

      {/* One line at every width: on a phone the two links give way, and the
          sentence that says who the visitor is stays. */}
      <p className="hidden shrink-0 items-center gap-x-4 md:flex">
        <Link href="/widget" className="link">
          Ask the widget a question
        </Link>
        <Link href="/portal?demo" className="link">
          Raise one as a customer
        </Link>
      </p>

      <button
        type="button"
        onClick={() => {
          writeDismissed();
          setDismissed(true);
        }}
        aria-label="Dismiss this introduction"
        className="btn btn-frame ml-auto !min-h-8 shrink-0 px-2"
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
    </section>
  );
}
