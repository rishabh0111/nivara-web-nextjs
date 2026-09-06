import Link from "next/link";

import { getAiEndpoints } from "@/config/ai";
import { getApiEndpoints } from "@/config/api";
import { ThemeToggle } from "@/ui/theme";

export const metadata = { title: "Widget" };

/**
 * Meridian, the showcase Tenant — hardcoded rather than configured.
 *
 * It is the one Tenant the AI layer answers on: `nivara-ai` indexes its Corpus
 * under this id and holds an Assistant token minted for it, so a Ticket opened
 * under any other Tenant is one the AI can retrieve for but never write back
 * to. A `NEXT_PUBLIC_` variable here would be a fourth deploy-time value that
 * can be silently wrong; the seed's id cannot.
 *
 * The demo host (`demo-host/index.html`, served from GitHub Pages) stays on
 * Sortwood and is the *other* half of this: it is a genuinely foreign origin
 * with a deliberately hostile stylesheet, which is what proves the Widget
 * survives a stranger's page and that the origin allowlist is real. This page
 * cannot prove that — it is served from the application's own origin — and is
 * not trying to. It is where the answering actually happens.
 */
const SHOWCASE_TENANT_ID = "5eed0000-0000-4000-8000-000000000001";

const SNIPPET = `<script
  src="https://nivara-web-nextjs.vercel.app/widget/widget.js"
  data-tenant-id="${SHOWCASE_TENANT_ID}"
  defer
></script>`;

export default function WidgetPage() {
  const { httpBaseUrl } = getApiEndpoints();
  // Optional by construction: a deployment with no `nivara-ai` still opens
  // Tickets, they just wait for a person instead of being answered first.
  const ai = getAiEndpoints();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pt-8 pb-32">
      <div className="mb-10 flex justify-end">
        <ThemeToggle />
      </div>

      <header className="max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-accent"
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
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Nivara Desk
        </Link>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">Widget</h1>

        <p className="mt-5 text-lg leading-relaxed text-pretty text-ink-muted">
          One script tag on a tenant&rsquo;s own site. A visitor asks a question without an account
          first, and it is answered before anyone is asked to read it.
        </p>
      </header>

      {/*
        The point of the page. Said plainly, because a reader who scrolls past
        this looking for a screenshot will not find one — there is no picture of
        the Widget here, only the Widget.
      */}
      <section className="mt-12 rounded-card border border-accent/30 bg-accent-wash p-5">
        <h2 className="text-base font-semibold tracking-tight">The launcher is on this page</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Bottom-right corner, reading <em>Chat with support</em>. It is the real build, running in
          this page&rsquo;s document inside a shadow root — the same file a tenant loads, carrying
          the same Snippet. Ask it something the help centre covers, like{" "}
          <em>how do I change my billing contact?</em>
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">What happens when you send one</h2>

        <ol className="mt-5 flex flex-col gap-4">
          {[
            {
              step: "The session",
              body: "The Widget mints an anonymous session against the API, judged on this page's origin against the tenant's allowlist. No account, no email, no password.",
            },
            {
              step: "The Ticket",
              body: "Your message opens a real Ticket, on the same queue a human agent works from. Nothing about it is a simulation.",
            },
            {
              step: "The Turn",
              body: "nivara-ai retrieves from the tenant's own help centre, and a gate decides whether what came back is worth answering with. If it is, the answer types itself in.",
            },
            {
              step: "Or a person",
              body: "If the gate is not confident, nothing is guessed at you. The Ticket goes to the staff queue with a note explaining why, and you are told a person has it.",
            },
          ].map(({ step, body }, index) => (
            <li
              key={step}
              className="flex gap-4 rounded-card border border-line bg-surface p-5 shadow-lift"
            >
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-wash font-mono text-xs font-semibold text-accent"
              >
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-tight">{step}</span>
                <span className="mt-1.5 block text-sm leading-relaxed text-ink-muted">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">What a tenant pastes</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Two values and nothing else to do. The tenant id is public by design — it grants nothing
          on its own, because the request is judged on the origin, which no script can forge.
        </p>

        <pre className="mt-5 overflow-x-auto rounded-card border border-line bg-sunken p-5 font-mono text-xs leading-relaxed text-ink">
          <code>{SNIPPET}</code>
        </pre>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">On somebody else&rsquo;s page</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          This page is served from the application&rsquo;s own origin, so it cannot demonstrate the
          one thing the Widget most needs to be true: that it works, and stays contained, on a site
          nobody here controls. That is what the demo host is for — a genuinely foreign origin
          carrying a deliberately hostile stylesheet, where the Widget is judged the way a
          tenant&rsquo;s visitor would judge it.
        </p>
        <a
          href="https://rishabh0111.github.io/nivara-web-nextjs/"
          target="_blank"
          rel="noopener"
          className="mt-5 inline-flex items-center gap-2 rounded-card border border-line bg-surface px-4 py-2.5 text-sm font-medium shadow-lift transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift-high"
        >
          Open the demo host
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 text-ink-faint"
          >
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </a>
      </section>

      <footer className="mt-16 flex flex-col gap-3 rounded-card border border-line bg-sunken px-5 py-4 text-sm text-ink-muted">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>Tickets to</span>
          <code className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs break-all text-ink">
            {httpBaseUrl}
          </code>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>Answered by</span>
          <code className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs break-all text-ink">
            {ai ? ai.httpBaseUrl : "nobody — no nivara-ai configured, so every Ticket waits for a person"}
          </code>
        </span>
      </footer>

      {/*
        The Snippet itself, rendered as a real script tag rather than injected
        after hydration: `entry.ts` reads `document.currentScript` at its top
        level, which is only the executing script while it executes, and this is
        the shape a tenant actually pastes.
      */}
      <script src="/widget/widget.js" data-tenant-id={SHOWCASE_TENANT_ID} defer />
    </main>
  );
}
