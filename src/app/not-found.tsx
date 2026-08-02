import Link from "next/link";

/**
 * An address this application does not answer on.
 *
 * It names the four Surfaces rather than saying "page not found" and stopping,
 * because the most likely way to arrive here is a link to a Surface that is not
 * a route — the Widget is the standing example, and it is not a page at all: it
 * runs inside a Tenant's own document, on a Tenant's own origin, and there is
 * no address here that could show it.
 */
const elsewhere = [
  { name: "Portal", href: "/portal", who: "A Contact, with a password" },
  { name: "Dashboard", href: "/dashboard", who: "A User with the agent or admin role" },
  { name: "Analytics", href: "/dashboard/analytics", who: "A User holding analytics:read" },
];

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">404</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight">Nothing lives at this address</h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          The Widget is the usual reason to end up here: it is not a page on this site. It renders
          inside a tenant&apos;s own document, on their origin, from a single script tag.
        </p>

        <ul className="mt-7 space-y-2">
          {elsewhere.map((entry) => (
            <li key={entry.name}>
              <Link
                href={entry.href}
                className="group flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-lift transition duration-200 hover:border-line-strong hover:shadow-lift-high"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold tracking-tight">{entry.name}</span>
                  <span className="block text-xs text-ink-muted">{entry.who}</span>
                </span>

                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-7">
          <Link href="/" className="link text-sm">
            Back to the front page
          </Link>
        </p>
      </div>
    </main>
  );
}
