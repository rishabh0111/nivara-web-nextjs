import { getApiEndpoints } from "@/config/api";
import { SignInStage } from "@/dashboard/sign-in-stage";
import { Wordmark } from "@/ui/logo";
import { ThemeToggle } from "@/ui/theme";

/**
 * The four Surfaces, in the order they were built.
 *
 * `held` is the whole point of the page: what separates these is not what they
 * render but which credential they carry, and a reader who leaves with only
 * that has the architecture.
 *
 * The three password Surfaces carry `?demo`, so a card opens the Surface signed
 * in as its seeded account rather than on a form asking for one.
 */
const surfaces = [
  {
    name: "Portal",
    href: "/portal?demo",
    held: "A Contact, signed in with a password",
    does: "Raise a ticket, read the replies, answer them.",
    icon: (
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    ),
  },
  {
    name: "Dashboard",
    href: "/dashboard?demo",
    held: "A User with the agent or admin role",
    does: "Work tickets, reply, leave notes, move things along.",
    icon: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />,
  },
  {
    name: "Widget",
    href: "/widget",
    held: "An anonymous Visitor, on somebody else's page",
    does: "Ask a question from a tenant's own site. No account first.",
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />,
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics?demo",
    held: "An admin",
    does: "Four rates, two percentiles, and what an empty cohort is not.",
    icon: <path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-8" />,
  },
];

export default function HomePage() {
  const { httpBaseUrl } = getApiEndpoints();

  return (
    <>
      <header className="flex h-12 items-center gap-2 px-4 sm:px-6">
        <p className="min-w-0 text-sm">
          <Wordmark />
        </p>
        <span className="ml-auto">
          <ThemeToggle />
        </span>
      </header>

      <main className="sheet">
        <div className="mx-auto w-full max-w-[64rem] px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
            <div className="max-w-xl">
              <h1 className="text-[2.5rem] leading-none font-light tracking-[-0.035em] sm:text-[3.5rem]">
                Nivara Desk
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-pretty text-ink">
                A multitenant customer-support helpdesk with an AI layer. Customers ask from a
                portal, a widget on the company&rsquo;s own site, or Slack; the AI answers what the
                help centre covers and hands the rest to an agent&rsquo;s queue.
              </p>

              <p className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                {/* The one thing most visitors came for: the agent's queue,
                    already signed in as the seeded admin. */}
                <a href="/dashboard?demo" className="btn btn-primary !min-h-12 px-6 text-[0.9375rem]">
                  Open the live demo
                </a>
                <span className="text-sm text-ink-muted">
                  Signed in as the demo admin of Meridian. Nothing to create.
                </span>
              </p>
            </div>

            {/* What the demo will show, before it is opened: the three ways a
                question ends, the strip every ticket in the queue carries. */}
            <SignInStage />
          </div>

          <h2 className="mt-16 text-[0.9375rem] font-medium">The four surfaces</h2>

          {/* A ruled list rather than four cards: four doors, each named by
              what it does and by the credential that holds it. */}
          <ul className="mt-3 border-t border-line">
            {surfaces.map((surface, arrival) => (
              <li
                key={surface.name}
                className="animate-rise border-b border-line"
                style={{ animationDelay: `${arrival * 60}ms` }}
              >
                {/*
                  The whole row is the link. A row with a link inside it gives a
                  reader a small target and a screen reader two things to
                  announce where there is only one destination.
                */}
                <a
                  href={surface.href}
                  className="group grid gap-x-6 gap-y-1 py-4 transition-colors duration-150 hover:bg-sunken sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center sm:px-3"
                >
                  <span className="flex items-center gap-2.5 text-[1.0625rem] font-medium">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-4 text-ink-muted"
                    >
                      {surface.icon}
                    </svg>
                    {surface.name}
                  </span>

                  <span className="text-sm leading-relaxed">
                    {surface.does}{" "}
                    <span className="text-ink-muted">Held by {surface.held.toLowerCase()}.</span>
                  </span>

                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="hidden size-4 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>

          <footer className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-muted">
            <span>Pointed at</span>
            <code className="rounded-md bg-sunken px-2 py-1 text-xs break-all text-ink">
              {httpBaseUrl}
            </code>
          </footer>
        </div>
      </main>
    </>
  );
}
