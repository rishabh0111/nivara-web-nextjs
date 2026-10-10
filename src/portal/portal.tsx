"use client";

import { useState } from "react";

import type { Ticket } from "@/tickets/ticket";

import { NewTicketForm } from "./new-ticket-form";
import { PortalChainProvider } from "./portal-chain";
import { Wordmark } from "@/ui/logo";
import { ThemeToggle } from "@/ui/theme";

import { usePortalSession, usePortalSignedIn } from "./portal-session-context";
import { SignInForm } from "./sign-in-form";
import { TicketList } from "./ticket-list";
import { TicketView } from "./ticket-view";
import { ScreenSkeleton } from "@/ui/skeleton";
import { ToastProvider } from "@/ui/toast";

/**
 * The Portal, signed in or not.
 *
 * Nothing authenticated is server-rendered — the browser holds the credential
 * and calls the API directly — so which of these is shown is decided on the
 * client, on every paint, from the token store.
 */
export function Portal() {
  const signedIn = usePortalSignedIn();

  // Still asking the refresh cookie whether there is a session to resume. The
  // sign-in form is not the honest thing to show here: most reloads of this
  // screen are by somebody who never signed out.
  if (signedIn === undefined) return <ScreenSkeleton />;

  return <ToastProvider>{signedIn ? <SignedIn /> : <SignInForm />}</ToastProvider>;
}

/**
 * Where the reader is: on the list, opening a Ticket, or reading one.
 *
 * One value rather than three flags, because "reading a Ticket" and "back on the
 * list, having just closed that one" are the same move seen from either side,
 * and holding them apart is how they drift.
 */
type Reading =
  { view: "ticket"; ticket: Ticket } | { view: "new" } | { view: "list"; closed?: string };

function SignedIn() {
  const session = usePortalSession();
  const [reading, setReading] = useState<Reading>({ view: "list" });

  return (
    // The chain of Tickets a conversation has run through is learned by watching
    // replies land, so it is held for the Portal rather than for one view: the
    // Ticket that records it is the one being navigated away from.
    <PortalChainProvider>
      <>
        {/*
          The mark is not a link. A Contact's Portal is one screen — there is
          nowhere for it to go but here, and a logo that navigates nowhere is a
          tab stop that costs a keyboard reader a press to find that out.
        */}
        <header className="sticky top-0 z-40 bg-frame">
          <div className="flex h-12 w-full items-center gap-2 px-4 sm:px-6">
            <p className="min-w-0 text-sm">
              <Wordmark />
            </p>

            <button
              type="button"
              onClick={() => void session.signOut()}
              className="btn btn-frame ml-auto !min-h-9 px-2.5"
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

            <ThemeToggle />
          </div>
        </header>

        <main className="sheet">
          <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
          <h1 className="text-[1.75rem] leading-tight font-light tracking-[-0.02em]">Your tickets</h1>

          {reading.view === "ticket" ? (
            <TicketView
              ticket={reading.ticket}
              onBack={() => setReading({ view: "list", closed: reading.ticket.id })}
              // Where a reply landed is the API's answer, and this follows it.
              onFollow={(ticket) => setReading({ view: "ticket", ticket })}
            />
          ) : reading.view === "new" ? (
            <NewTicketForm
              onOpened={(ticket) => setReading({ view: "ticket", ticket })}
              onCancel={() => setReading({ view: "list" })}
            />
          ) : (
            <TicketList
              onOpen={(ticket) => setReading({ view: "ticket", ticket })}
              onOpenNew={() => setReading({ view: "new" })}
              returningFrom={reading.closed}
            />
          )}
          </div>
        </main>
      </>
    </PortalChainProvider>
  );
}
