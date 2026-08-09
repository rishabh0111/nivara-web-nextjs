# The live path

One path, run against the **deployed API** and the **isolation Tenant**: sign in, renew, load the
queue, open a Ticket, reply, and watch the reply arrive live.

```bash
NIVARA_E2E_TENANT_ID=… NIVARA_E2E_EMAIL=… NIVARA_E2E_PASSWORD=… npm run test:e2e
```

Unconfigured, it **skips and says which variable is missing**. It is opt-in because it talks to a
real server with a real credential, and a developer without one should get a sentence rather than a
red run to interpret.

## Why it exists

The mocked suite says what this application does with every answer the API can give. It cannot say
whether the answers arrive at all. The failures that would most embarrass this repository are
environmental — a cross-origin refusal, a refresh cookie no browser will send, a socket that never
connects — and a mocked run passes straight through all of them. It already did: both API-side
blockers — CORS never enabled, and a refresh cookie scoped `SameSite=Lax` — were found by asking the
deployed API, not by running the suite.

So this is not a second test suite. It is the proof that the first one is testing the right thing,
and it stays one path.

## What is real, and what is simulated

Everything above the socket is the shipping code — the request layer, the session client, the live
connection. One thing is swapped underneath: `fetch`.

Node's `fetch` is a client, not a user agent. It will happily read a response no browser would hand
to a page, and it has no cookie jar at all, so a "successful" renewal here could be this suite
sending a header a browser would never send. [`browser-rules/`](browser-rules) writes that
enforcement down and applies it:

| | |
|---|---|
| [`cors.ts`](browser-rules/cors.ts) | Which requests are preflighted, and what makes a browser throw the answer away. A wildcard origin is refused on a credentialed request, as it is in a browser. |
| [`cookie-jar.ts`](browser-rules/cookie-jar.ts) | What is kept, and what is sendable from another site — `SameSite=None; Secure`, and nothing else. Path-scoped, so the Portal's and the Dashboard's refresh cookies stay apart. |
| [`browser-fetch.ts`](browser-rules/browser-fetch.ts) | The two above, in front of a real `fetch`. A refusal throws, because in a browser the page never sees the response. |

Those are ordinary units and are tested in the **fast** suite (`e2e/**/*.test.ts`), not here. Only
`*.e2e.ts` runs against a deployed API.

A real browser would be the alternative, and would cost a driver, a headless install and a page to
drive for one path. What a browser adds over this is enforcement — and enforcement is the part that
is written down here where a reviewer can read it.

**Two limits, named rather than left to be discovered.** The cross-origin rules are a model of a
browser and not a browser, so a rule this repository has written down wrongly would be applied
wrongly here too — they are unit-tested against the specifications, which is not the same as being
checked against Chrome. And the **socket does not go through them at all**: `socket.io-client` opens
its own connection, so the handshake's `Origin` is unexercised on the live half. That is the smaller
gap it looks — the gateway's CORS accepts any origin with `credentials: false`, and the handshake's
authority is the token rather than the origin — but it is a gap, and a browser is what would close
it.

## Configuration

| | |
|---|---|
| `NEXT_PUBLIC_API_URL` | The API, as everywhere else. This suite adds no second variable. |
| `NIVARA_E2E_TENANT_ID` | The **isolation** Tenant. Naming the showcase Tenant is refused outright — this path writes, and the showcase Tenant is curated to be read. |
| `NIVARA_E2E_EMAIL`, `NIVARA_E2E_PASSWORD` | A staff credential at that Tenant. Never committed. |
| `NIVARA_E2E_ORIGIN` | The origin the API is asked to allow. Defaults to `http://localhost:3000`, which is registered on the API side. |
| `NIVARA_E2E_COLD_START_MS` | The Cold-start budget. Defaults to 120 s. |

Read from `.env.local` as well as the environment, so credentials sit beside `NEXT_PUBLIC_API_URL`
rather than being exported by hand every run.

The origin matters: the API allowlists exact origins, so this passes from `localhost:3000` and from
the production origin, and fails from anywhere unregistered — which is the check working, not a
broken suite.

## Not in CI

It needs a credential CI does not have, and a red build caused by a sleeping free instance would
train everybody to ignore the build. Run it before a deploy and after any change to the request
layer, the session, or the live connection.
