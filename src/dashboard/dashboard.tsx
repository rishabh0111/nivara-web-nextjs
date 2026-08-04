"use client";

import { useState } from "react";

import { LiveSilence } from "@/realtime/live-silence";
import { ScreenSkeleton } from "@/ui/skeleton";
import type { Ticket } from "@/tickets/ticket";

import { useDashboardSession, useDashboardSignedIn } from "./dashboard-session-context";
import { DashboardNav } from "./dashboard-nav";
import { LiveNoticesProvider } from "./live-notices";
import { Queue } from "./queue";
import { SignInForm } from "./sign-in-form";
import { TicketView } from "./ticket-view";
import { useLiveAgents } from "./use-live-agents";
import { useStaffPrincipal } from "./use-staff-principal";
import { ToastProvider } from "@/ui/toast";

/**
 * The Dashboard, signed in or not.
 *
 * Nothing authenticated is server-rendered — the browser holds the credential
 * and calls the API directly — so which of these is shown is decided on the
 * client, on every paint, from the token store.
 */
export function Dashboard() {
  const signedIn = useDashboardSignedIn();

  // The notice log wraps the whole of the signed-in Dashboard rather than
  // sitting inside the Ticket view, because what it holds outlives whichever
  // screen raised it: a User told that a reply was never delivered should still
  // have that in front of them after they have gone back to the queue to do
  // something about it.
  /*
    The toaster wraps the Surface rather than the route.
    A provider mounted in `layout.tsx` is only there when Next mounted the
    route, so anything that renders this component directly — every test in this
    repository does — got the silent fallback and reported nothing. Writes are
    now permitted to predict themselves *because* a refusal interrupts, so the
    thing that does the interrupting cannot be optional.
  */
  // Still asking the refresh cookie whether there is a session to resume. The
  // sign-in form is not the honest thing to show here: most reloads of this
  // screen are by somebody who never signed out.
  if (signedIn === undefined) return <ScreenSkeleton />;

  return (
    <ToastProvider>
      {signedIn ? (
        <LiveNoticesProvider>
          <SignedIn />
        </LiveNoticesProvider>
      ) : (
        <SignInForm />
      )}
    </ToastProvider>
  );
}

/**
 * Where the reader is: on the queue, or inside one Ticket.
 *
 * Held here rather than in the address bar, and that is a deliberate line rather
 * than an oversight. The slice *is* in the address bar, because a view of the
 * queue is something a User sends a colleague. A Ticket is at least as
 * shareable, and making it a place means a route — which means deciding what
 * "back to the queue" does for someone who arrived on the link cold, and
 * carrying the slice across a navigation that would otherwise drop it. That is a
 * question worth answering properly and separately; answering it badly here
 * would cost a reader their filters every time they opened a Ticket.
 */
type Reading = { view: "queue"; closed?: string } | { view: "ticket"; ticket: Ticket };

function SignedIn() {
  const principal = useStaffPrincipal();
  const session = useDashboardSession();
  const [reading, setReading] = useState<Reading>({ view: "queue" });

  // Read for the whole session rather than per screen: what arrives here is
  // about the tenant's work, not about whatever is currently open.
  useLiveAgents();

  return (
    <>
      <DashboardNav current="queue" principal={principal} />

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-6 pb-24 sm:px-6 sm:pb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>

        {/* Above everything it is about. What has stopped is not the queue or the
          Ticket but the connection both of them are being kept current by, and
          a reader who has been told that should be told it before they read
          anything under it. */}
        <LiveSilence live={session.live} />

        {/*
        The queue, immediately. There is no landing page to navigate away from —
        and it stays mounted behind an open Ticket only in the sense that its
        pages stay in the cache: coming back re-reads nothing the reader has
        already loaded, and the slice is still in the URL where they left it.
      */}
        {reading.view === "ticket" ? (
          <TicketView
            ticket={reading.ticket}
            onBack={() => setReading({ view: "queue", closed: reading.ticket.id })}
          />
        ) : (
          <Queue
            onOpen={(ticket) => setReading({ view: "ticket", ticket })}
            returningFrom={reading.closed}
          />
        )}
      </main>
    </>
  );
}
