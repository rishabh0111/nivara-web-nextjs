# Live events are applied locally only where they are append-only

The reflex answer to "keep the interface correct as events arrive" is to patch the local copy: an event says a Ticket changed, so change the Ticket that is held. That answer is right for some events and quietly wrong for others, and the difference is not about the events at all — it is about what is being held.

**Where an event is append-only, it is applied locally.** A message, an internal Note, an audit entry on the Ticket currently open: these arrive into a Room that is subscribed, carry a sequence number that says whether anything was missed, and add to the end of something. Refetching in response would be strictly worse — slower, and no more correct.

**Where an event could change membership or ordering, the server is asked again.** A Ticket queue is a cursor-paginated window over a server-side sort, with filters, and no total. When a Ticket's state changes while a queue filtered to open Tickets is being read, no client can determine what should happen. Patching leaves a resolved Ticket sitting in a list of open ones. Removing it locally guesses at a predicate the server owns. Re-sorting is meaningless across a window that holds one page of several. There is no local computation that produces the right answer, because the answer depends on rows this client has never seen.

That asymmetry is why the store choice does not resolve this and never could. A normalised entity store promises that updating one entity fixes every view — and this is precisely the case where the promise fails, because list membership is not a property of the entity. Choosing normalisation would have bought a hand-maintained normalisation layer and still required the invalidation path. The query cache holds server state; the rule above governs what happens to it.

**The list is not refetched automatically when it is invalidated.** A busy queue would refetch continuously and rearrange itself under the reader's cursor, which is both wasteful and a way to click the wrong Ticket. Instead the list is held still and the reader is told it has changed, refreshing when they choose. This is an affordance rather than a throttle: the user gets to decide when the thing they are reading moves.

Two consequences to expect rather than discover. A reader watching a Ticket's detail update live while the queue behind it sits still will read that as a bug — it is the most likely misreading of this application, and it is this decision working correctly. And notification events, which report that something happened without changing anything, cannot be applied under either half of the rule: there is nothing to append and nothing to invalidate, so they are surfaced as events in their own right or they are invisible.

Underneath all of it: authority is what the API last answered. An envelope is a hint that something changed, never the thing that is true.
