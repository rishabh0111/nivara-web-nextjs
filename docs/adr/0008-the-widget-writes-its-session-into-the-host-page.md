# The Widget writes its session into the host page's storage, because it has nothing else to be carried by

The token store is in memory and says why: an access token in `localStorage` is back within reach of any page script, and survives the tab on a shared machine. The refresh cookie is what carries a session across a reload, it is httpOnly, and keeping it is the browser's job rather than this application's.

None of that is available to the Widget. A Visitor's session is minted against a Tenant's origin allowlist and renewed by presenting the credential itself; there is no refresh cookie, because there is no first-party origin to set one on — the page is somebody else's site. So the Widget holds its whole session in the memory of a page the Visitor destroys the moment they click a link on that site. Held in memory alone, "your conversation survives navigation" is not a feature that was left out; it is one that cannot be written.

**So the credential is written down, into the host page's `sessionStorage`.** The honest consequence is that the Tenant's own scripts can read it, and it is worth saying plainly rather than mitigating in a comment. It is also the consequence that matters least here: the Widget is running *in* that page, the Tenant's scripts could read the token out of its memory anyway, and the token reaches nothing but that Visitor's own Tickets — in that Tenant's own queue, which the Tenant already reads. The threat the origin allowlist exists to stop is Lifting, and Lifting is not made easier by any of this: a script on a site the Tenant does not control still cannot mint.

What it must not become is a credential that outlives the visit, so three things are true of it.

| | |
|---|---|
| `sessionStorage`, never `localStorage` | It goes when the tab does. The next person on a shared machine does not inherit somebody's support conversation. |
| The expiry is checked on the way back in | A Widget session has no grace period and a lapsed one cannot be recovered. Presenting a credential the expiry already condemned buys a request to be told what was known before it was sent. |
| Nothing read back is trusted to be the shape it was written in | This is the host page's storage and their scripts can write into it. A cast here is a `tenantId` of the wrong type sent as an authority claim, or `undefined` sent as a bearer credential. |

**The API's own document says otherwise, and the reason it gives is the thing being honoured.** `WidgetSessionDto` reads: *"Hold it in memory for the life of the page — persisting it to `localStorage` leaves a working session behind on a shared machine."* The instruction is `localStorage` and the harm named is the session that outlives the visit. `sessionStorage` does not cause that harm: it is cleared when the tab closes, so nothing is left behind for anyone. This is a departure from the sentence and not from the reason behind it, which is the only kind of departure worth making — and it is written down here rather than left for a reader to discover as a contradiction between a client and the document it was generated from. It belongs in an issue against the API repository, as a request to say `localStorage` where it means `localStorage`.

The Tenant is stored alongside, and a record for another Tenant is ignored rather than adopted: one site can legitimately carry two Snippets — an agency's own Widget beside the one they installed for a client — and a session minted for one is not a session on the other.

The alternative considered was to keep the session in memory and accept that a navigation ends the conversation. It was rejected because it makes the Widget a worse product for the reason that has nothing to do with security: the Visitor's *first* instinct after asking a question is to keep browsing while they wait, and a chat that dies when they do is a chat nobody finishes.

The cost accepted is a second place a token exists, on an origin this repository does not control, and a storage API that can be refused outright. The refusal is handled by working without it — the Widget runs and simply does not survive a navigation — because an exception thrown out of a script on a stranger's page is a fault their console reports and their developer cannot fix.
