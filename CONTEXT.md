# nivara-web

The front ends for Nivara Desk. The domain entities belong to the API; the language below is what *this* repository adds on top of them — the vocabulary of surfaces, credentials, live delivery and embedding.

## Language

### Surfaces

**Surface**:
One of the four front ends in this repository — Portal, Dashboard, Widget, Analytics. What distinguishes them is which credential they hold, not which pages they render.
_Avoid_: App, client, frontend (all four are one application)

**Portal**:
The surface a Contact signs into with a password to manage their own Tickets.
_Avoid_: Customer app, help centre

**Dashboard**:
The staff surface, held by a User with the `agent` or `admin` role.
_Avoid_: Admin panel, agent app, console

**Widget**:
The surface embedded in a Tenant's own site, held by an anonymous Visitor.
_Avoid_: Chat, embed, bubble

**Visitor**:
Someone using the Widget who has not yet caused a Contact to exist. A Visitor becomes a Contact on their first write, never before.
_Avoid_: Anonymous user, guest

### Credentials and origin

**First-party origin**:
An origin this application is deployed at, and the only kind the API will accept cookies from. Distinct from a Tenant's allowlisted origin, which is somebody else's site.
_Avoid_: Trusted origin, our domain

**Lifting**:
Dropping a Tenant's Snippet onto a site that Tenant does not control. The per-Tenant origin allowlist exists to stop exactly this, and nothing else.
_Avoid_: Embedding abuse, snippet theft

**Snippet**:
The one script tag a Tenant pastes onto their own site, carrying the Tenant it belongs to and nothing else. That Tenant is public and grants nothing on its own — the request is judged on the browser-set origin, which no script can forge.
_Avoid_: Embed code, install script, tag

**Conversation**:
A Ticket, in the words the Widget shows a Visitor. The same record the other Surfaces call a Ticket — the word changes because the reader does: a Visitor on a Tenant's site did not file anything, they asked a question and are waiting for an answer. The Widget never says "ticket" to a Visitor and never asks them to title one; the subject staff read is derived from their opening message.
_Avoid_: Chat, thread, case (a thread is the messages, not the Ticket)

**Launcher**:
The one control the Widget puts on a host page before anybody asks for support. Pressing it is what mints the session; loading the Snippet costs the page a script and no credential.
_Avoid_: Bubble, chat button, FAB

**Lapsed session**:
A Widget session that expired before it was renewed. Terminal, and distinct from an expired credential on any other Surface: there is no grace period and nothing behind it to present, so it is not recovered but replaced — by a fresh start, which is a new anonymous Visitor who can read none of what the last one raised. This is what renewing ahead of expiry exists to prevent, rather than to recover from.
_Avoid_: Expired session, timed out, logged out (nobody logged in)

**Seam**:
A place where a dependency will one day be called, marked and left empty. A seam has no stub, no mock and no toggle — it is a deferred decision, not an unfinished feature.
_Avoid_: Stub, placeholder, TODO

### Reading a collection

**Slice**:
The part of a collection a reader has narrowed to — the filters and the order, held as the interface edits them rather than as the wire carries them. A Slice is converted to query parameters in one place; a control never builds a parameter itself.
_Avoid_: Query, search, view, filter state

**Overtaken**:
A Slice the server has moved on from — something arrived on the wire that could change what belongs in it or where things sit, and the pages in hand have not been re-read since. Said out loud and left alone, never refetched underneath the reader; they decide when the list moves.
_Avoid_: Stale, dirty, out of sync

**Unclaimed pool**:
The Tickets with no assignee, asked for with the API's `none` sentinel. A distinct question from "assigned to this User", never a special value of one.
_Avoid_: Unassigned bucket, inbox, triage queue

### Reading the numbers

**Window**:
The span of creation time the Analytics screen is reading over, chosen by an admin as two calendar days. Its end is exclusive on the wire and inclusive to the reader — the day they name is in it — and what a report actually covers is read off the answer rather than off the controls, because an unchosen Window is the API's own.
_Avoid_: Date range, period, timeframe

**Cohort**:
The Tickets created in the Window. One shared denominator under every rate on the screen, which is what makes the rates comparable to each other and what makes an empty one unanswerable rather than zero.
_Avoid_: Sample, dataset, population

**Rate**:
A count and the fraction of the Cohort it is, together and never apart — the same percentage over four Tickets and over four thousand is not the same claim. The fraction is absent over an empty Cohort, and absent is rendered as no answer with the reason beside it, never as 0%.
_Avoid_: Percentage, metric, KPI

**Cut**:
One axis the figures are broken down by — priority, source, assignee or day. Each is a separate question of the same endpoint over the same Window, so a Cut that fails takes down its own table and nothing else. Day is the only Cut that is a series; the rest are tables, because a line drawn through source names would be a trend through an alphabet.
_Avoid_: Breakdown, group-by, dimension, segment

### Live delivery

**Room**:
A named channel on the real-time connection. Sequence numbers are per Room and never global, so the same event delivered to two Rooms carries two unrelated numbers.
_Avoid_: Channel, topic, subscription

**Room cursor**:
The highest sequence number held for one Room. Sent as `afterSeq` when re-subscribing.
_Avoid_: Offset, watermark, last seen

**Gap**:
The server's statement that a Room's replay buffer no longer reaches back to the held cursor. It means local state for that Room is discarded and refetched — an ordinary path, not an error.
_Avoid_: Desync, buffer overflow, missed events

**Rebuild**:
Connecting again with the credential read afresh, carrying every Room that still has a reader. What the Widget does on each renewal, and what the staff Surfaces never do — their connection is established once and rides. A Rebuild resumes each Room from nothing, so it is the one re-subscribe that cannot be answered with a Gap.
_Avoid_: Reconnect, refresh (a reconnect is the transport coming back on its own)

**Silence**:
A connection that has tried to come back and could not, said out loud so nobody trusts a screen that has stopped updating. Not a connection that is merely down — one drops constantly and returns on its own, and reporting those would make the report worth ignoring. A Surface's condition, not a screen's, and one it leaves again the moment the connection returns. Asked of a Surface as its *health*, which is the pair — reading, or in Silence — and nothing else.
_Avoid_: Disconnected, offline, connection error

**Notification event**:
A live event that reports something happened without changing the entity — SLA breach and integration failure. Nothing about the Ticket differs afterwards, so a view that diffs a snapshot renders nothing.
_Avoid_: Alert, warning, side event

**Notice**:
A Notification event, read into words and shown. Identified by what happened rather than by the delivery that carried it, so the same event announced into two Rooms is one Notice. Held for a Surface's whole session, never for the screen that happened to be open.
_Avoid_: Toast, banner, notification

**Cold start**:
The tens-of-seconds first response from a sleeping Render instance. A state to be named in the interface, not a slow request to spin on.
_Avoid_: Timeout, hang, lag
