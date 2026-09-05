# Deployment

Two origins, deployed separately, and they are meant to be unrelated.

| | | |
|---|---|---|
| The application | Vercel | The four Surfaces. Production is a stable URL, registered on the API's CORS allowlist. |
| The Widget demo host | GitHub Pages, from [`demo-host/`](../demo-host) | Somebody else's site. Allowlisted on the isolation Tenant, and on nothing else. |

## The application

Vercel project, Next.js framework preset, no build overrides. One environment variable —
`NEXT_PUBLIC_API_URL` — set on **Production and Preview**, to the deployed API. See the README for
why there is only one.

It is set on both because there is no committed `.env` to inherit it from, and the build reads it:
an environment without it fails to build rather than building something misconfigured. A Preview
that cannot build cannot render the shell either, which is the one thing Previews are for.

The production origin has to be registered on the API side before a credentialed call from it will
be accepted. That registration is a change in `nivara-api-nestjs`, made once this URL exists, and
it is exact — the origin string, not a pattern.

## nivara-ai

A second, optional environment variable — `NEXT_PUBLIC_AI_URL` — set on **Production and Preview**,
to the deployed `nivara-ai` service. Unlike `NEXT_PUBLIC_API_URL` it is genuinely optional: unset,
`getAiEndpoints()` (`src/config/ai.ts`) returns `undefined` rather than failing the build, and the
Widget's Turn (`src/api/ai-seam.ts`) is simply never triggered — a Visitor can still open a
conversation and be answered by staff, the same as before `nivara-ai` existed. Set it wherever
`nivara-ai` is actually reachable from a browser, which is a different origin from this
application's and needs no allowlisting on this side: `nivara-ai`'s own CORS is wildcarded, because
the Widget presents a bearer credential there and never a cookie (see that repository's
`src/nivara_ai/main.py`).

## Preview deployments do not reach the API, and this is a decision

Every preview gets a unique origin. Credentialed CORS requires exact origins, so accepting previews
would mean either registering each one by hand or wildcarding the hosting platform's domain — and a
wildcard over `*.vercel.app` grants credentialed access to every site anybody hosts there, which is
the whole platform.

So no preview origin is registered, and the API refuses them. Previews render the shell, and their
credentialed calls fail the CORS check. That is the intended behaviour, not a bug to be filed.

The refusal is the **API's**, not a missing variable here. Previews are configured exactly as
Production is and still cannot reach the API, which is the stronger arrangement: it holds whether or
not anyone remembers to leave a setting blank, and it is enforced on the server rather than by the
absence of something on the client.

Review a change against the API by running it locally against the deployed API — `localhost` is a
stable origin and can be registered once.

## The Widget bundle

`npm run build` builds the Widget before it builds the Next application, into `public/widget/`, so
the application serves it at `/widget/widget.js`. It is not committed — it is output, rebuilt by
every build.

That URL is on **this** application's origin, and that is fine: the origin the allowlist judges is
the *page's*, not the script's. Serving the script from here while it renders into the Tenant's own
document is the whole point of
[ADR 0003](adr/0003-the-widget-renders-in-the-host-document.md).

`npm run widget:size` holds the bundle to 60 kB gzipped and runs in CI. See
[ADR 0007](adr/0007-the-widget-is-a-separate-build-under-a-checked-budget.md) for why the number is
enforced rather than remembered.

**`NEXT_PUBLIC_API_URL` is inlined into this bundle at build time**, because there is no `process`
on a Tenant's page to read it from. The one-variable constraint holds — it is still the only input,
and it still points every part of the application at one API — but for the Widget, changing it means
rebuilding rather than restarting. Built with the variable unset (which is what a Preview
deployment is), the Widget names the missing variable in the host page's console in the same words
every other Surface uses, and does nothing else.

## The demo host

`demo-host/` is a static page with no build step, deployed to GitHub Pages by
[`.github/workflows/demo-host.yml`](../.github/workflows/demo-host.yml). It is on a different
origin from the application by construction, which is the only reason it exists: the Widget runs
cross-origin, and the origin it is judged on has to be real before the Widget is built.

Its origin is allowlisted on the isolation Tenant only. An origin nobody listed is refused by
`POST /widget/sessions`, and that refusal is verified live rather than assumed — see [The gate,
asked rather than assumed](#the-gate-asked-rather-than-assumed) below.

The isolation Tenant is **Sortwood**, `5eed0000-0000-4000-8000-000000000002`, and the three origins
seeded onto it are the whole allowlist:

| | |
|---|---|
| `https://rishabh0111.github.io` | The demo host on GitHub Pages. |
| `http://localhost:4173` | The demo host served locally. A port of its own, because this application's own origin would make the demonstration same-origin and prove nothing. |
| `https://sortwood.example` | Reserved, and listed so the allowlist has an entry no page can ever present. |

Matching is **exact equality** after case and trailing-slash normalization — no prefixes, no
wildcards, and the opaque `null` origin a sandboxed frame presents is refused rather than compared.
A fourth origin means a fourth entry, seeded in `nivara-api-nestjs`.

The page carries the Snippet, and both of its values are set:

| | |
|---|---|
| `src` | `https://nivara-web-nextjs.vercel.app/widget/widget.js` — the application's production origin. It was `https://nivara-web.example` while no correct value existed, a **reserved** RFC 2606 host that can never be registered by anyone; before that it was `https://nivara-web.vercel.app`, which is not an unset value but a live application belonging to somebody else, and a demo host shipping with it would have asked a stranger's origin for a script on every visit. Pinned by exact equality in [`src/widget/demo-host.test.ts`](../src/widget/demo-host.test.ts) rather than by a pattern, which would accept the next plausible neighbour just as readily. |
| `data-tenant-id` | Set: the isolation Tenant above. Public by design; it grants nothing without the origin. |

The page's stylesheet is **deliberately hostile** and is not to be tidied up: a global `!important`
reset, an inherited font and colour, a `box-sizing` opinion, and rules aimed at the element names
the Widget is built from. It is there so a reviewer watches the Widget survive a stranger's CSS
rather than being told it would.

To see it locally: `npm run widget:build`, `npm run dev`, then serve `demo-host/` on **port 4173**
and point the Snippet's `src` at `http://localhost:3000/widget/widget.js`. The port is not free
choice — the allowlist is exact, `4173` is the entry seeded for this, and any other port is refused
by the gate rather than by anything in this repository. Both origins have to be
registered on the API side for the calls to succeed.

## The gate, asked rather than assumed

The allowlist is the Widget's whole anti-Lifting guarantee, and the only claim in this repository
that cannot be established from inside it: the check runs on the API, against the browser-set
origin, on a Tenant row this repository does not own. So it is asked. Against the deployed API, on
the isolation Tenant:

| | | |
|---|---|---|
| `https://rishabh0111.github.io` | `201` | An `nvw_` token, `expiresInSeconds: 1800`. The demo host origin is seeded and live. |
| An origin nobody listed | `403` | `{ "error": { "code": "forbidden", … } }` — refused before a session exists, not after. |

Both are reproducible with `curl`, which is the honest tool for it: `Origin` is a header, the gate
reads that header, and a shell can send one. That is not a hole — the allowlist stops the Widget
being **lifted** onto a site real visitors use, which is a browser-mediated attack with a
browser-mediated defence. It was never a credential, and `nivara-api-nestjs` says so where the
predicate lives.

What this does **not** establish is that the Widget *asks* correctly, only that the API answers
correctly — `curl` sends an `Origin` header where a browser sets one, and that difference is the
whole distinction the allowlist rests on. So the same questions were put to a browser, on the
deployed page at <https://rishabh0111.github.io/nivara-web-nextjs/> and on an unlisted port
(`npx serve demo-host -l 5500`, since the allowlist is exact and `4173` is the only port on it):

| | |
|---|---|
| One script tag renders a Launcher | Yes, on a page that does nothing else to make room for it. |
| A session mints from the allowlisted origin | `201`. |
| An unlisted origin is refused | `403`. The Launcher removes itself and the panel reads *"Support is not available on this site."* |
| Hostile host-page CSS | The Widget is unchanged by a global `!important` Comic Sans, an inherited colour and a `box-sizing` override, and none of the Widget's own styling reaches the host page's elements. |

Both halves of that last row matter and the second is the one that gets skipped: a Widget that
survived the host's CSS while leaking its own onto the host's headings would have failed the
guarantee in the direction nobody was watching.

## The two API-side blockers are cleared

Two changes in `nivara-api-nestjs` are ones no amount of work here substitutes for — CORS never
enabled on the HTTP surface, and refresh cookies scoped `SameSite=Lax`.
Both are **done on the deployed API**, and the live path is what says so rather than a note from
whoever made them:

| | |
|---|---|
| CORS | A preflight from `http://localhost:3000` is answered `204` with that exact origin, `access-control-allow-credentials: true`, and `Retry-After` and the rate-limit headers exposed. |
| The refresh cookie | `nivara_refresh` is set on `/auth` as `HttpOnly; Secure; SameSite=None`, so a browser sends it back cross-site and the session renews. |

Verified by [`npm run test:e2e`](../e2e/README.md), which renews a real session over a `fetch` that
applies a browser's own rules. Neither is asserted from this repository's side of a mock, which is
the point: both were originally found by asking the deployed API, and both are confirmed the same
way.

The allowlist is still exact and still a change in the other repository. `http://localhost:3000` is
registered; the production origin has to be registered when it exists, and previews never are.
