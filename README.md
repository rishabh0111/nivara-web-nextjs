# nivara-web

The front ends for Nivara Desk — the customer Portal, the live agent Dashboard, the embeddable
Widget, and Analytics. Next.js, TypeScript, Tailwind.

The system is multitenant and this application is *implicitly* tenant-scoped: the tenant is
resolved server-side from the token on every request and is never a value the client holds,
passes, or puts in a URL.

## Running it

```bash
npm install
npm run dev
```

## The one variable

`NEXT_PUBLIC_API_URL` is the only input that points this application at a backend. It configures
all three of them:

| | |
|---|---|
| HTTP base | the URL itself |
| Real-time origin | that URL plus `/rt`, never a second variable that could disagree with the first |
| Type generation | that URL plus `/openapi.json` |

There is no committed default. Copy [`.env.example`](.env.example) to `.env.local`, which holds the
deployed API's URL:

```bash
cp .env.example .env.local
```

Unset, nothing starts and nothing builds — [`src/config/api.ts`](src/config/api.ts) names the
missing variable rather than falling back to a value nobody chose, and a committed `.env` would be
that value. Point it at another Nivara Desk API and nothing else in this repository changes.

## Generated types

The typed client's types come from the API's OpenAPI document, never from anyone's hand.

```bash
npm run api:types   # regenerate src/api/generated/openapi.ts
npm run api:drift   # fail if the committed types and the API disagree
```

Generation emits **types only** — no generated runtime, no template overrides. The request layer
is hand-written middleware a reviewer can read. The generated file is committed so that
regenerating produces a diff that reads as drift rather than churn.

`api:drift` runs in CI and on a daily schedule, because the API drifting is a property of the
server changing rather than of anyone pushing a commit.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` is mocked and reaches no network. One path is not: `npm run test:e2e` signs in against the
**deployed** API, renews, opens a Ticket, replies and waits for the reply to arrive live. It is
opt-in — unconfigured, it skips and names the missing variable — and it is the proof that the mocked
suite is testing the right thing. See [`e2e/README.md`](e2e/README.md).
