# TanStack Query is the server-state store

It is settled that there is **one** server-state store and that it is a query cache rather than a normalised entity store — ADR 0002 explains why normalisation could not have resolved the question it appears to resolve. What was left unnamed is which one. This does.

**TanStack Query, and its cursor-paginated form specifically.** The API returns `{ data, nextCursor }` with no total, on every collection it serves. `useInfiniteQuery` is a cursor-paginated form in the same shape: a page param that is opaque to it, and an end signalled by the absence of a next one. Nothing has to be taught a page count, because there is no page count to teach — which is what keeps the interface honest about offering "load more" and never a numbered page or a count. A store whose pagination was offset-shaped would have had to be lied to.

**Retries are the request layer's, not the cache's.** The middleware already retries, and retries only what is worth retrying: a rate limit, waiting the interval the server itself supplied. A second retry policy in the cache would re-ask on `not_found` and `forbidden` — settled answers that no number of attempts changes — and would multiply the backoff the server asked for into several requests it did not. So the cache's default is no retry, and that is a deliberate configuration rather than a default left unread.

**Refetch-on-focus is off, for the same reason the queue is held still.** ADR 0002 decides that a list which has changed underneath a reader is not refetched but announced. Refetching whenever the window regains focus is that same refetch arriving from a different direction, and it would rearrange a queue under a cursor exactly as automatic invalidation would.

**Failures cross the boundary intact.** The request layer hands back an `ApiResult` because a refusal from this API is an answer, and a caller obliged to remember to catch is a caller that will forget. The cache's contract is the opposite: it recognises a failure by its being thrown. That conversion happens in one place, and carries the `ApiFailure` across on the thrown error rather than flattening it to a string a surface would then have to parse back — the closed error catalog is the thing worth branching on, and it survives the trip.

The alternative considered was staying hand-rolled until the Dashboard needed invalidation. It was rejected because the Portal is where the first collection read lands, and a store introduced later is a store two surfaces get ported onto rather than built on.
