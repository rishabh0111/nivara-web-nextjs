# The Widget is a separate build with Preact aliased in, held to a checked size budget

The other three Surfaces are pages of one Next application, and a page's weight is this application's own problem. The Widget's weight is somebody else's: it is a script tag on a Tenant's site, downloaded by their visitors, most of whom will never ask for support. What it costs is a cost they pay on our behalf, and they have no way to see it and no way to refuse it.

So the Widget is built separately — a single IIFE from `vite.widget.config.ts`, no chunks and no framework runtime to fetch first — and **React is aliased to Preact at build time**. The components in this repository are written against React's API and compile against both; nothing in `src/widget/` knows which one it got. The Next application is untouched by the alias, so the Dashboard keeps real React and its concurrent features.

Preact rather than a hand-rolled renderer, because the Widget shares real modules with the rest of this repository — the request layer, the session client, the Cold-start phase — and sharing them is what stops the Widget's behaviour drifting from the Portal's. A second rendering model would have meant a second copy of everything above those modules, which is where the drift would have started.

**The budget is the enforcement, and it is checked in CI.** Sixty kilobytes gzipped, over everything the Snippet causes to be downloaded, in `scripts/check-widget-size.ts`. This exists because the module boundary here is a convention: `src/widget/` importing `@/dashboard/queue` is not an error in any language the compiler speaks, and nothing about a shared `@/api` module says which half of the repository may use it. Two things stand in the way, and they catch different mistakes.

| | |
|---|---|
| The build refuses Next-shaped imports by name | Catches the direct mistake, at the file that made it, with the import named. `next`, `next/…`, `@next/…`. |
| The budget refuses the weight | Catches everything else — a query client, a date library, a component that grew — where no single import looks wrong. |

The number is not sacred and the current build sits well under it. What matters is that raising it is a decision somebody makes in a diff, rather than a thing that happens quietly over a year of commits.

The cost accepted is a second build to keep working, and a class of bug — a React feature Preact's compatibility layer does not implement — that appears only in the Widget. The alias is therefore applied to the *build*, never to the tests: the test suite runs against real React, so a component that behaves differently under Preact is caught by the deployed demo rather than by a green suite. That is a real gap, and it is the price of not maintaining two test runs of the same components.
