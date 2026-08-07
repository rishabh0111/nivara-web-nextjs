# The Widget renders in the host document, because an iframe would defeat the origin allowlist

Embedded widgets are usually iframes, and for good reasons: an iframe is a document boundary, so the host page's CSS cannot reach in and the widget's cannot leak out. That is the industry default and it is the wrong choice here. The reason is not stylistic.

**The API gates widget bootstrap on the tenant's own origin allowlist**, checked against the browser-set origin of the document making the request, by exact equality. Its stated purpose is to stop the Widget being *lifted* — dropped onto a site the tenant does not control, where real visitors' conversations would land in that tenant's queue and that tenant's replies would be shown to people who never contacted them.

An iframe served from this application's origin makes that gate meaningless. A document inside such a frame presents *this* origin on every request, identically for every tenant. Every tenant's allowlist would therefore have to contain this application's domain — and once it does, the allowlist admits every page that can load the frame, which is every page on the internet. The gate would still be enforced, still pass, and protect nothing.

**So the Widget renders inline in the host page's own document**, inside a shadow root, with an explicit reset on the host element to stop inherited typography and colour crossing the boundary. Requests then carry the tenant's own origin, which is what the allowlist was written to check.

One iframe variant does preserve the origin — a frame whose content is supplied inline rather than fetched inherits the embedding document's origin. It was not chosen, because it reintroduces every cost of a document boundary without the isolation guarantee being the point any more: sizing a frame to its content, focus and keyboard handling across the boundary, and mobile viewport behaviour. A shadow root gives the style isolation that was the original motivation and none of that. Note also that a *sandboxed* frame is refused outright: it presents the opaque origin, which the allowlist explicitly declines to match.

The cost accepted is that shadow DOM isolation is not total. Inherited CSS properties cross the boundary unless reset, and the reset is now load-bearing rather than cosmetic — a tenant's stylesheet is the thing most likely to break this Widget's appearance, and the only thing standing between them is a rule that must not be quietly removed as redundant.

The demo of this Widget must therefore be embedded on a page at an origin that is genuinely not this application's. A same-origin demonstration would exercise none of the above and would pass a gate it was never tested against.
