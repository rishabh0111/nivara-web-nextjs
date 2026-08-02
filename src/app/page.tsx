import { getApiEndpoints } from "@/config/api";
import { ThemeToggle } from "@/ui/theme";

/**
 * The four Surfaces, in the order they were built.
 *
 * `held` is the whole point of the page: what separates these is not what they
 * render but which credential they carry, and a reader who leaves with only
 * that has the architecture.
 */
const surfaces = [
  {
    name: "Portal",
    href: "/portal",
    held: "A Contact, signed in with a password",
    does: "Raise a ticket, read the replies, answer them.",
    icon: (
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    ),
  },
  {
    name: "Dashboard",
    href: "/dashboard",
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
    href: "/dashboard/analytics",
    held: "A User holding analytics:read",
    does: "Four rates, two percentiles, and what an empty cohort is not.",
    icon: <path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-8" />,
  },
];

export default function HomePage() {
  const { httpBaseUrl } = getApiEndpoints();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pt-8 pb-24">
      <div className="mb-10 flex justify-end">
        <ThemeToggle />
      </div>

      <header className="max-w-2xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium tracking-wide text-ink-muted uppercase shadow-lift">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-calm" />
          Support desk
        </p>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Nivara Desk
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-pretty text-ink-muted">
          Four front ends and one client. All four run against the same API and are told apart by
          which credential they hold — not by which pages they render.
        </p>
      </header>

      <h2 className="sr-only">The four surfaces</h2>

      <ul className="mt-14 grid gap-4 sm:grid-cols-2">
        {surfaces.map((surface, arrival) => (
          /*
            Staggered by a twentieth of a second each. Enough that the four
            read as arriving in an order rather than appearing at once, and
            short enough that nobody waiting on the last one notices waiting.
          */
          <li
            key={surface.name}
            className="animate-rise"
            style={{ animationDelay: `${arrival * 60}ms` }}
          >
            {/*
              The whole card is the link. A card with a link inside it gives a
              reader a small target and a screen reader two things to announce
              where there is only one destination.
            */}
            <a
              href={surface.href}
              className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-lift transition duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lift-high"
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-wash text-accent transition-transform duration-200 group-hover:scale-110"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                  >
                    {surface.icon}
                  </svg>
                </span>

                <span className="text-base font-semibold tracking-tight">{surface.name}</span>

                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-auto size-4 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>

              <span className="mt-4 text-sm leading-relaxed text-ink-muted">{surface.does}</span>

              <span className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
                Held by {surface.held.toLowerCase()}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <footer className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line bg-sunken px-5 py-4 text-sm text-ink-muted">
        <span>Pointed at</span>
        <code className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs break-all text-ink">
          {httpBaseUrl}
        </code>
      </footer>
    </main>
  );
}
