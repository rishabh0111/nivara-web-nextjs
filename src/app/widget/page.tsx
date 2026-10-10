import Link from "next/link";

import { getAiEndpoints } from "@/config/ai";
import { getApiEndpoints } from "@/config/api";
import { Wordmark } from "@/ui/logo";
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

/** What happens to a question, in the order it happens. */
const STEPS = [
  {
    step: "The session",
    body: "The Widget mints an anonymous session against the API, judged on this page's origin against the tenant's allowlist. No account, no email, no password.",
  },
  {
    step: "The ticket",
    body: "Your message opens a real ticket, on the same queue a human agent works from. Nothing about it is a simulation.",
  },
  {
    step: "The turn",
    body: "nivara-ai retrieves from the tenant's own help centre, and a gate decides whether what came back is worth answering with. If it is, the answer types itself in.",
  },
  {
    step: "Or a person",
    body: "If the gate is not confident, nothing is guessed at you. The ticket goes to the staff queue with a note explaining why, and you are told a person has it.",
  },
];

export default function WidgetPage() {
  const { httpBaseUrl } = getApiEndpoints();
  // Optional by construction: a deployment with no `nivara-ai` still opens
  // Tickets, they just wait for a person instead of being answered first.
  const ai = getAiEndpoints();

  return (
    <>
      <header className="flex h-12 items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="min-w-0 rounded-md text-sm">
          <Wordmark />
        </Link>
        <span className="ml-auto">
          <ThemeToggle />
        </span>
      </header>

      <main className="sheet">
        <div className="mx-auto w-full max-w-[48rem] px-4 pt-10 pb-32 sm:px-8 sm:pt-16">
          <h1 className="text-[2.5rem] leading-none font-light tracking-[-0.035em] sm:text-[3.5rem]">
            Widget
          </h1>

          <p className="mt-6 max-w-[40rem] text-lg leading-relaxed text-pretty">
            One script tag on a tenant&rsquo;s own site. A visitor asks a question without an account
            first, and it is answered before anyone is asked to read it.
          </p>

          {/*
            The point of the page. Said plainly, because a reader who scrolls past
            this looking for a screenshot will not find one — there is no picture of
            the Widget here, only the Widget.
          */}
          <section className="mt-10 rounded-[10px] bg-sunken px-5 py-4">
            <h2 className="text-[0.9375rem] font-medium">The launcher is on this page</h2>
            <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-muted">
              Bottom-right corner, reading <em>Chat with support</em>. It is the real build, running in
              this page&rsquo;s document inside a shadow root — the same file a tenant loads, carrying
              the same Snippet. Ask it something the help centre covers, like{" "}
              <em>how do I change my billing contact?</em>
            </p>
          </section>

          <section className="mt-14">
            <h2 className="text-[0.9375rem] font-medium">What happens when you send one</h2>

            {/* A ruled list in reading order: the position is the sequence. */}
            <ol className="mt-3 border-t border-line">
              {STEPS.map(({ step, body }) => (
                <li
                  key={step}
                  className="grid gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[9rem_minmax(0,1fr)]"
                >
                  <span className="text-[0.9375rem] font-medium">{step}</span>
                  <span className="text-sm leading-relaxed text-ink-muted">{body}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-14">
            <h2 className="text-[0.9375rem] font-medium">What a tenant pastes</h2>
            <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-muted">
              Two values and nothing else to do. The tenant id is public by design — it grants nothing
              on its own, because the request is judged on the origin, which no script can forge.
            </p>

            <pre className="mt-4 overflow-x-auto rounded-[10px] bg-sunken p-5 text-xs leading-relaxed text-ink">
              <code>{SNIPPET}</code>
            </pre>
          </section>

          <section className="mt-14">
            <h2 className="text-[0.9375rem] font-medium">On somebody else&rsquo;s page</h2>
            <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-muted">
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
              className="btn btn-quiet mt-4"
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
                className="size-4 text-ink-muted"
              >
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
          </section>

          <footer className="mt-14 flex flex-col gap-2 text-sm text-ink-muted">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span>Tickets to</span>
              <code className="rounded-md bg-sunken px-2 py-1 text-xs break-all text-ink">
                {httpBaseUrl}
              </code>
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span>Answered by</span>
              <code className="rounded-md bg-sunken px-2 py-1 text-xs break-all text-ink">
                {ai ? ai.httpBaseUrl : "nobody — no nivara-ai configured, so every Ticket waits for a person"}
              </code>
            </span>
          </footer>
        </div>

        {/*
          The Snippet itself, rendered as a real script tag rather than injected
          after hydration: `entry.ts` reads `document.currentScript` at its top
          level, which is only the executing script while it executes, and this is
          the shape a tenant actually pastes.
        */}
        <script src="/widget/widget.js" data-tenant-id={SHOWCASE_TENANT_ID} defer />
      </main>
    </>
  );
}
