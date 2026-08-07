# The Widget rebuilds its connection on renewal, where the staff one rides

The staff connection is established once and rides. A renewal replaces the token every request afterwards uses and changes nothing about the socket, because the wire contract fixes the principal at connect and never re-evaluates it — so a staff role change takes effect on the next connection rather than the next frame, and a socket only ever reads. Rebuilding four times an hour was rejected as a recurring self-inflicted disruption for a difference nobody could see.

**The Widget does the opposite, and every clause of that reasoning is why.**

| The staff reasoning | On the Widget |
|---|---|
| A role change is the only thing a rebuild would pick up, and it can wait | A *revocation* is what a rebuild picks up. A Visitor's session is revocable, and one that has been revoked should stop being read to — not at the end of a tab's life, which is how long a riding socket lasts. |
| Rebuilding is a disruption, four times an hour | It is not a disruption. Rooms are re-joined by the layer above, the views never unmount, and nothing on screen changes — the two tests that assert this drive a real renewal under a conversation being read. |
| Renewal is reactive, and rare | Renewal here is *scheduled*, ahead of expiry, because a Widget session presents its own credential to renew and a lapsed one has nothing left to present. So the cadence is known rather than incidental, which is what makes rebuilding on it a decision rather than a gamble. |

## What a rebuild is

A new connection with the credential read afresh, and every Room that still has a reader joined again on it. The functions handed out by `join` stay good across it; a view that was reading a conversation before is reading the same one after, and was never told.

The Rooms resume **from nothing**, not from the cursors the old connection held. That is the cheap answer and also the safe one, in that order:

- `afterSeq: 0` is the one resume point the server can never answer with a Gap. A rebuild therefore cannot make a Visitor's conversation flash empty and reload — which a rebuild happening every half hour absolutely would, sooner or later, on a busy Room.
- What comes back instead is the Room's whole replay buffer, most of which the readers above have already seen. That is harmless because identity is a record's own id and never the number it arrived under: an entry already in the thread is left alone, which is the same rule that makes at-least-once delivery survivable in the first place.

Carrying the cursors across would save a replay of at most a buffer's worth of envelopes, and would mean a *new* connection resuming *somebody else's* reading — the credential is different, and the server decides the principal again. The saving is not worth owning that question.

## What drives it

The credential changing, not the renewal that changed it. Both renewals reach the connection that way — the one scheduled ahead of expiry and the one a refused request set off underneath it — without either call site having to remember to say so. A credential that has gone rather than changed closes the connection instead, which is the same rule read at its other end: a session that has ended must stop being read to.

## The cost accepted

A handshake every half hour per open Widget, and a replay with it. Against that, the alternative is a socket holding a credential the API has retired, delivering a Tenant's replies to a browser whose session was revoked — for as long as the visitor leaves the tab open. On this Surface that is not a theoretical difference.

This is also, deliberately, where the reconnect path gets exercised. Under the decision to let the staff connection ride, that path runs only on genuine transport loss — a sleeping instance, a laptop lid, lost wifi — which is rare enough that its bugs would be found in production. Here it runs on every renewal, which is why the Widget's connection was worth building early.
