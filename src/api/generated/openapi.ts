/**
 * Generated from the Nivara Desk API's OpenAPI document. Do not edit by hand.
 *
 * Regenerate with `npm run api:types`; `npm run api:drift` fails if this file
 * and the API disagree.
 */

export interface paths {
    "/auth/sign-in": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in with email and password
         * @description Returns a 15-minute access token in the body and sets an httpOnly refresh cookie. Every failure answers the same `unauthenticated` error: a wrong password, an unknown address, and an address belonging to a different tenant are deliberately indistinguishable.
         */
        post: operations["AuthController_signIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/google": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in with Google
         * @description Exchanges an authorization code for a session. Binds to an existing invite-provisioned User by verified Google email against `(tenantId, email)`; a Google identity with no such User is refused rather than provisioned, because the invite is the only source of membership. Answers `integration_dormant` when this deployment has no Google configuration — check that before offering the affordance.
         */
        post: operations["AuthController_signInWithGoogle"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Exchange the refresh cookie for a new access token
         * @description Rotates the refresh token on every use. Presenting an already-rotated token is treated as theft and revokes the entire token family, so both copies stop working and the legitimate client signs in again.
         */
        post: operations["AuthController_refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/sign-out": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * End the session
         * @description Revokes the whole token family and clears the cookie. Idempotent: signing out without a valid cookie succeeds, because whether a given token exists is not something an unauthenticated caller should be able to learn.
         */
        post: operations["AuthController_signOut"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The authenticated staff principal
         * @description Resolved from the presented credential alone. Reads the User row inside the tenant context the token arms, so a response here is evidence the whole chain is wired. A portal token is refused — a Contact describes itself at `GET /portal/auth/me`.
         */
        get: operations["AuthController_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tickets/{id}/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a Ticket’s audit timeline
         * @description Every control-plane change to this Ticket, newest first, in the standard list envelope. Conversation is not here: Messages and Notes are domain data attributed on their own rows, and the log records changes of state and configuration only.
         */
        get: operations["AuditController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/staff/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Invite a staff member into the tenant
         * @description Admin-only. Creates a pending User with the given role and returns a single-use invitation token, shown exactly once. The tenant is taken from the calling admin’s credential — there is no self-service way into a tenant.
         */
        post: operations["InvitationsController_invite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/staff/invitations/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept an invitation by setting a password
         * @description Spends the invitation and sets the invited User’s password; they can then sign in. Single-use — an already-accepted, expired, or unknown token is refused identically, because which of the three it is describes the state of someone’s account to whoever holds the link.
         */
        post: operations["InvitationsController_accept"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tickets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Tickets
         * @description Cursor-paginated, newest first by default. Filters and sorts are drawn from a closed per-resource allowlist: an unknown parameter is a 400 rather than something quietly ignored.
         */
        get: operations["TicketsController_list"];
        put?: never;
        /**
         * Open a Ticket on a Contact’s behalf
         * @description The Ticket is born `open` with `normal` priority — neither is settable here. Triage is an explicit act, so setting priority or an assignee is a separate, separately permissioned call.
         */
        post: operations["TicketsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tickets/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read one Ticket
         * @description A Ticket belonging to another tenant answers 404, identically to one that does not exist — a 403 would confirm it is real.
         */
        get: operations["TicketsController_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tickets/{id}/conversation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the whole conversation this Ticket belongs to
         * @description The chain of Tickets linked by reply-on-closed, oldest first, so it reads as a narrative from where the customer first got in touch to where the work is now. A Ticket that has never been closed-and-replied-to is a chain of one — the common case, and deliberately not a special one, so a client never has to ask whether a conversation exists before reading it.
         *
         *     Any Ticket in a chain returns the same chain: the endpoint is addressed by whichever Ticket you happen to hold, not only by the origin.
         *
         *     In the standard list envelope but never paginated — `nextCursor` is always null. A chain grows only when a closed Ticket is replied to, so it is bounded by how many times a conversation has been finished and resumed, and handing back a fragment of a narrative would make reading one a loop.
         */
        get: operations["TicketsController_conversation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tickets/{id}/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Move a Ticket to another state
         * @description The active states `open`, `pending` and `on_hold` interconvert freely; any of them may be `resolved`; a `resolved` Ticket reopens to `open` or moves to `closed`. `closed` is terminal — nothing leads out of it, and a later reply from the Contact opens a new linked Ticket. An illegal move answers 409 and is refused by the database rather than by this service, so it is refused identically on every write path.
         *
         *     Moving to `closed` additionally requires `ticket:close`, which `ticket:transition` does not imply. It is checked here rather than on the route because one endpoint serves every transition, so a route-level grant could not tell them apart — a caller holding `ticket:transition` alone reaches this operation and is refused only for that destination.
         */
        patch: operations["TicketsController_transition"];
        trace?: never;
    };
    "/tickets/{id}/priority": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Set a Ticket’s priority
         * @description Independent of state: priority is urgency and state is progress, and changing one never moves the other. Not a state transition, so the transition table is not consulted. The single exception is a `closed` Ticket, which is a locked record — a priority edit on one answers 409.
         */
        patch: operations["TicketsController_setPriority"];
        trace?: never;
    };
    "/tickets/{id}/assignee": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Assign a Ticket, or unassign it
         * @description At most one assignee, and `null` clears it. There are no teams or groups — responsibility has exactly one holder or none.
         */
        patch: operations["TicketsController_setAssignee"];
        trace?: never;
    };
    "/tickets/{id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a Ticket’s customer-visible thread
         * @description Messages only, newest first, in the standard list envelope. Notes are structurally absent rather than filtered out — they are a separate table, and no parameter to this endpoint can reach them.
         */
        get: operations["MessagesController_list"];
        put?: never;
        /**
         * Post a customer-visible Message
         * @description The author is not part of the request: `authorKind` and `authorId` are stamped from the credential that made it, so a Message cannot be attributed to anyone else. For internal context that the Contact must not see, write a Note instead — a different endpoint over a different table, not a flag on this one.
         */
        post: operations["MessagesController_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tickets/{id}/notes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a Ticket’s internal Notes
         * @description Notes only, newest first, in the standard list envelope. Interleaving them with the customer-visible thread is the client’s job: it reads both endpoints and merges by `createdAt`, so nothing on the server ever holds a mixed collection that could be serialized to the wrong audience.
         */
        get: operations["NotesController_list"];
        put?: never;
        /**
         * Write an internal Note
         * @description Never visible to the Contact, and not by virtue of a flag this endpoint sets — a Note is a row in a different table, and the customer-visible thread read does not look there. The author is stamped from the credential, as it is for a Message.
         */
        post: operations["NotesController_write"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/portal/auth/sign-in": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign a Contact into the portal
         * @description Returns a 15-minute access token in the body and sets an httpOnly refresh cookie, exactly as staff sign-in does. Every failure answers the same `unauthenticated` error — a wrong password, an unknown address, an address at another tenant, and a Contact with no portal credential at all are deliberately indistinguishable. The last of those is the common case: a Contact created from a widget visit has no password and cannot sign in here.
         */
        post: operations["PortalAuthController_signIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/portal/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Exchange the portal refresh cookie for a new access token
         * @description Rotates on every use, with the same family-wide replay eviction staff sessions have. A staff refresh token presented here is refused without revoking its family: it is a client error rather than evidence of theft, and evicting the family would sign an agent out of the console for it.
         */
        post: operations["PortalAuthController_refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/portal/auth/sign-out": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * End the portal session
         * @description Revokes the whole token family and clears the cookie. Idempotent: signing out without a valid cookie succeeds, because whether a given token exists is not something an unauthenticated caller should be able to learn.
         */
        post: operations["PortalAuthController_signOut"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/portal/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in Contact
         * @description Resolved from the presented credential alone. Reads the Contact row inside the tenant context the token arms, so a response here is evidence the whole chain is wired. A staff token is refused: this describes a Contact, and a User is not one.
         */
        get: operations["PortalAuthController_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/portal/tickets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List my Tickets
         * @description Cursor-paginated, newest first by default, and scoped to the signed-in Contact by row-level security rather than by a filter this endpoint applies. Another customer’s Tickets are not excluded from the page — they do not exist in this context at all.
         */
        get: operations["PortalTicketsController_list"];
        put?: never;
        /**
         * Open a Ticket
         * @description Born `open` with `normal` priority and Source `portal`. The requester is the signed-in Contact, taken from the credential — it is not a field of this request, so a Ticket cannot be filed in another customer’s name.
         */
        post: operations["PortalTicketsController_open"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/portal/tickets/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read one of my Tickets
         * @description Another customer’s Ticket answers 404, identically to one that does not exist and identically to another tenant’s — a 403 would confirm it is real, which is a fact about somebody else’s support request.
         */
        get: operations["PortalTicketsController_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/portal/tickets/{id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the conversation on my Ticket
         * @description The full customer-visible thread — every Message, whoever wrote it. Notes are not filtered out of this response; they are a different table that this read does not name, are excluded from a Contact’s context by policy, and have no route on this surface.
         */
        get: operations["PortalTicketsController_thread"];
        put?: never;
        /**
         * Reply on my Ticket
         * @description Attributed to the signed-in Contact, stamped from the credential by a database trigger rather than claimed by the request — which is what makes `authorKind` trustworthy enough to compute deflection from. Posting on a Ticket that is not mine answers 404.
         *
         *     A reply is not only a Message: it moves the Ticket it lands on. A `pending` or `resolved` Ticket reopens to `open`, because the customer has said the matter is not finished. A `closed` Ticket is terminal and is not revived — the reply opens a **new linked Ticket** with a fresh clock, inheriting the requester and its place in the conversation but nothing else, and becomes that Ticket’s first Message. If the conversation already has a Ticket that is not closed, the reply joins it rather than starting another, so replying repeatedly does not produce duplicates.
         *
         *     Because of that, the Message returned may belong to a different Ticket than the one addressed — read `ticketId` on the response rather than assuming, and read that Ticket’s thread to see the reply in place. `GET /tickets/:id/conversation`, which returns a whole chain at once, is a staff endpoint and is not reachable from this surface.
         */
        post: operations["PortalTicketsController_reply"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/widget/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start an anonymous widget session
         * @description Mints a 30-minute session for a visitor on the tenant’s own site. No account, no credential, and nothing durable stored about the visitor — the session’s Contact is created only when they do something that needs a requester, such as opening a Ticket.
         *
         *     Gated by the tenant’s `Origin` allowlist and by nothing else. A tenant that has not configured any origin has the widget switched off, and is refused identically to an unknown tenant and to a disallowed page: the refusal cannot be used to learn whether a given tenant id is real.
         */
        post: operations["WidgetSessionsController_start"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/widget/sessions/renew": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Extend this widget session
         * @description Returns a fresh token for the **same** session, so the visitor’s Contact and their Tickets survive the renewal — a conversation that runs past thirty minutes is still one conversation. Call it before `expiresInSeconds` elapses; there is no grace period after expiry, and a lapsed session must start a new one.
         *
         *     The `Origin` allowlist is checked again here, so a token lifted onto another page cannot keep itself alive from there. A revoked session is refused.
         */
        post: operations["WidgetSessionsController_renew"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/widget/tickets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List this session’s Tickets
         * @description Cursor-paginated, newest first by default, and scoped to the session’s Contact by row-level security rather than by a filter this endpoint applies. A session that has not yet opened a Ticket has no Contact at all and receives an empty page — asking does not create one.
         */
        get: operations["WidgetTicketsController_list"];
        put?: never;
        /**
         * Open a Ticket from the widget
         * @description Born `open` with `normal` priority and Source `widget`. This is the act that makes a Contact exist: an anonymous session resolves to a freshly created, unverified Contact with no email, no name and no credential, and that Contact becomes the Ticket’s requester. A session that already has one reuses it, so a visitor who opens two Tickets in one conversation is one customer rather than two.
         */
        post: operations["WidgetTicketsController_open"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/widget/tickets/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read one of this session’s Tickets
         * @description Another visitor’s Ticket answers 404, identically to one that does not exist and identically to another tenant’s — a 403 would confirm it is real, which is a fact about somebody else’s support request.
         */
        get: operations["WidgetTicketsController_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/widget/tickets/{id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the conversation on this session’s Ticket
         * @description The full customer-visible thread — every Message, whoever wrote it. Notes are not filtered out of this response; they are a different table that this read does not name, are excluded from a Contact’s context by policy, and have no route on this surface.
         */
        get: operations["WidgetTicketsController_thread"];
        put?: never;
        /**
         * Reply on this session’s Ticket
         * @description Attributed to the session’s Contact, stamped from the credential by a database trigger rather than claimed by the request. Posting on a Ticket that is not this session’s answers 404.
         *
         *     A reply is not only a Message: it moves the Ticket it lands on, exactly as a portal reply does. A `pending` or `resolved` Ticket reopens to `open`. A `closed` Ticket is terminal and is not revived — the reply opens a **new linked Ticket** with a fresh clock and becomes its first Message — so read `ticketId` on the response rather than assuming it matches the Ticket addressed.
         */
        post: operations["WidgetTicketsController_reply"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/service-tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List this tenant’s service tokens
         * @description Newest first, and including revoked tokens: the operator question is what has ever held authority here, and a token that vanished on revocation would make an incident harder to reconstruct. The credential itself is never returned — it exists nowhere the server could read it.
         */
        get: operations["ServiceTokensController_list"];
        put?: never;
        /**
         * Mint a service token
         * @description Admin-only. Returns the credential **once** — only a hash is stored, so it cannot be recovered afterwards and a lost token is reminted rather than looked up.
         *
         *     The tenant and the minting User are stamped from your credential, never taken from the request. Scopes are drawn from the same permission catalog staff roles are built from; destructive, configuration, user-management and audit-read permissions are refused.
         */
        post: operations["ServiceTokensController_mint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/service-tokens/scopes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the scopes a service token may be granted
         * @description Published so tooling does not hardcode the list. These are permissions from the staff catalog — the same vocabulary, not a parallel one — minus everything no machine credential may hold.
         */
        get: operations["ServiceTokensController_assignableScopes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/service-tokens/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Revoke a service token
         * @description Takes effect on the token’s very next request — the authentication path reads the row every time and caches nothing, because a TTL here would be revocation delay.
         *
         *     Final: a revoked token cannot be reinstated, and restoring access means minting a new one. The row is kept rather than deleted so the audit trail still has something to point at.
         */
        delete: operations["ServiceTokensController_revoke"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/analytics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The tenant’s live support metrics over a cohort
         * @description Four headline rates — deflection, resolution, and the two SLA breach rates — over one shared cohort of Tickets created in `[from, to)`, defaulting to the last 30 days and anchored on creation time. First-response and resolution durations are reported at p50 and p90. An optional `groupBy` breaks every figure down by priority, source, assignee, or day; the assignee cut excludes deflected and unassigned Tickets. Everything is computed live as tenant-scoped SQL — never stale, and never able to cross tenants.
         */
        get: operations["AnalyticsController_report"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Liveness — process only, no dependencies
         * @description Answers 200 whenever the process is alive. Touches neither Postgres nor Redis. This is the keep-warm ping target.
         */
        get: operations["HealthController_liveness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Readiness — Postgres, Redis and the scheduler heartbeat
         * @description Answers 200 when the database is reachable and no enabled tick has stalled, and 503 otherwise, with the offending dependency named in the body. Redis is reported but never fails the check: it fails open, so an unreachable one is degraded rather than down. Not the keep-warm ping target — that is `/health`.
         */
        get: operations["HealthController_readiness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/meta/error-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The closed catalog of machine-readable error codes
         * @description Every non-2xx response carries one of these codes in `error.code`. The list is closed: a code not here is never returned.
         */
        get: operations["MetaController_errorCodes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        SignInDto: {
            /**
             * Format: uuid
             * @description Which tenant to sign in to. Login is scoped to `(tenantId, email)`, so the same address at two tenants is two separate Users with two separate passwords.
             */
            tenantId: string;
            /**
             * Format: email
             * @example admin@meridian.test
             */
            email: string;
            /** Format: password */
            password: string;
        };
        SessionDto: {
            /** @description Bearer credential for the API. Hold it in memory — persisting it to `localStorage` puts it back within reach of a page script. */
            accessToken: string;
            /**
             * @description Seconds until the access token expires. Refresh before this elapses; the refresh cookie is sent automatically.
             * @example 900
             */
            expiresInSeconds: number;
        };
        ErrorDetailDto: {
            /** @example priority */
            field: string;
            /** @example must be one of low, normal, high, urgent */
            issue: string;
        };
        ErrorBodyDto: {
            /**
             * @description Stable machine-readable code from the closed catalog at `GET /meta/error-codes`. Branch on this, never on `message`.
             * @enum {string}
             */
            code: "malformed_request" | "invalid_filter" | "invalid_sort" | "invalid_cursor" | "unauthenticated" | "forbidden" | "not_found" | "conflict" | "idempotency_in_flight" | "validation_failed" | "idempotency_key_reused" | "rate_limited" | "internal_error" | "integration_dormant";
            /** @description Human-readable and safe to surface. Never contains internals. */
            message: string;
            /** @description One entry per offending field. Present only on 422. */
            details?: components["schemas"]["ErrorDetailDto"][];
        };
        ErrorResponse: {
            error: components["schemas"]["ErrorBodyDto"];
        };
        GoogleSignInDto: {
            /**
             * Format: uuid
             * @description Which tenant to sign in to. The Google identity binds against `(tenantId, email)`, so the same Google account at two tenants reaches two separate Users.
             */
            tenantId: string;
            /** @description The one-time authorization code Google redirected back to the client with. */
            code: string;
            /**
             * @description The redirect URI the code was issued against. Google refuses any value not registered for this client, so this selects among the registered URIs rather than naming a new one.
             * @example https://app.nivara.example/auth/google/callback
             */
            redirectUri: string;
        };
        PrincipalDto: {
            /**
             * @description Which kind of caller this is. Service tokens introduce a second value; clients should treat this as an open set.
             * @enum {string}
             */
            kind: "user";
            /** Format: uuid */
            userId: string;
            /** Format: uuid */
            tenantId: string;
            /** @enum {string} */
            role: "agent" | "admin";
            /** Format: email */
            email: string;
            name: string;
        };
        /**
         * @description What happened. A closed catalog — `fromValue` and `toValue` are read according to this.
         * @enum {string}
         */
        AuditAction: "ticket.created" | "ticket.transitioned" | "ticket.assigned" | "ticket.priority_changed" | "sla.breached" | "token.minted" | "token.revoked" | "integration.failed";
        /**
         * @description Who acted. Read from the credential, never from the request.
         * @enum {string}
         */
        ActorKind: "user" | "contact" | "service" | "system";
        /**
         * @description The kind of row this is about. Open in the database — the column is text, so an existing action can point at a new kind of row without a migration — but published as the closed set that actually occurs, so a client can switch on it.
         * @enum {string}
         */
        AuditTargetKind: "ticket" | "service_token" | "integration" | "contact";
        AuditEntryDto: {
            id: string;
            /** @description What happened. A closed catalog — `fromValue` and `toValue` are read according to this. */
            action: components["schemas"]["AuditAction"];
            /** @description Who acted. Read from the credential, never from the request. */
            actorKind: components["schemas"]["ActorKind"];
            /** @description Null exactly when `actorKind` is `system`, which is the one actor with no row to point at. */
            actorId: string | null;
            /** @description The kind of row this is about. Open in the database — the column is text, so an existing action can point at a new kind of row without a migration — but published as the closed set that actually occurs, so a client can switch on it. */
            targetKind: components["schemas"]["AuditTargetKind"];
            targetId: string;
            /** @description The Ticket this belongs to, or null once that Ticket has been deleted — the entry outlives its subject. */
            ticketId: string | null;
            /** @description The value before the change, as text. Null when there was none. */
            fromValue: string | null;
            /** @description The value after the change, as text. Null when there is none. */
            toValue: string | null;
            /** @description Action-specific extras — minted scopes, an SLA breach kind, an integration error. */
            metadata: Record<string, never> | null;
            /** @description Ties one request’s cascade of entries together, when present. */
            correlationId: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        InviteStaffDto: {
            /**
             * Format: email
             * @description The address the invitee will sign in with. Unique within the tenant; the same address may hold a separate membership at another tenant.
             * @example new.agent@meridian.test
             */
            email: string;
            /** @example Nadia Farouk */
            name: string;
            /**
             * @description The authority the invitee will hold. Decided here by the admin, never chosen by the person accepting.
             * @enum {string}
             */
            role: "agent" | "admin";
        };
        InvitationDto: {
            /** Format: uuid */
            id: string;
            /**
             * Format: uuid
             * @description The pending User this invitation provisioned.
             */
            userId: string;
            /** Format: email */
            email: string;
            /** @enum {string} */
            role: "agent" | "admin";
            /** @description The single-use secret, shown **once**. Only its hash is stored, so it cannot be recovered — a lost invitation is reissued, never looked up. */
            token: string;
            /**
             * Format: date-time
             * @description After this, the invitation is refused and must be reissued.
             */
            expiresAt: string;
        };
        AcceptInvitationDto: {
            /**
             * Format: uuid
             * @description The tenant the invitation was issued in.
             */
            tenantId: string;
            /** @description The single-use secret from the invitation, shown to the admin exactly once at issue. */
            token: string;
            /**
             * Format: password
             * @description The password this staff member will sign in with.
             */
            password: string;
        };
        /**
         * @description The channel this Ticket arrived on. Fixed at creation.
         * @enum {string}
         */
        TicketSource: "portal" | "widget" | "slack";
        CreateTicketDto: {
            /** @description What the Ticket is about, in one line. */
            subject: string;
            /**
             * Format: uuid
             * @description The requester. Must be a Contact of this tenant — one belonging to another tenant is refused as nonexistent.
             */
            contactId: string;
            /** @description The channel this Ticket arrived on. Fixed at creation. */
            source: components["schemas"]["TicketSource"];
        };
        /** @enum {string} */
        TicketState: "open" | "pending" | "on_hold" | "resolved" | "closed";
        /** @enum {string} */
        TicketPriority: "low" | "normal" | "high" | "urgent";
        TicketDto: {
            id: string;
            subject: string;
            /** @description The requester. */
            contactId: string;
            /** @description The single User responsible, or null when untriaged. */
            assigneeId: string | null;
            state: components["schemas"]["TicketState"];
            priority: components["schemas"]["TicketPriority"];
            source: components["schemas"]["TicketSource"];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        SetStateDto: {
            /** @description The state to move to. The request names a destination, not a transition: the origin is whatever the Ticket is in when the write lands, which is what makes a retry safe. An illegal move from that origin is a 409. */
            state: components["schemas"]["TicketState"];
        };
        SetPriorityDto: {
            /** @description The new urgency. Independent of state — any priority is valid in any state. */
            priority: components["schemas"]["TicketPriority"];
        };
        SetAssigneeDto: {
            /**
             * Format: uuid
             * @description The User to make responsible, or null to unassign. Must be a User of this tenant.
             */
            assigneeId: string | null;
        };
        CreateMessageDto: {
            /** @description What to say, as plain text. Rendering is the client’s business — markup is stored verbatim, not interpreted. */
            body: string;
        };
        MessageDto: {
            id: string;
            /** @description The Ticket this belongs to. */
            ticketId: string;
            /** @description What was said, as plain text. */
            body: string;
            /** @description What kind of thing wrote this — a User, a Contact, a ServiceToken, or the system. Server-stamped from the writing credential and not settable. */
            authorKind: components["schemas"]["ActorKind"];
            /**
             * Format: uuid
             * @description The author’s id, or null for `system` — the one actor with no row to point at. Polymorphic: read it against `authorKind` to know which table it names.
             */
            authorId: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        CreateNoteDto: {
            /** @description The internal note, as plain text. Never delivered to a Contact by any endpoint. */
            body: string;
        };
        NoteDto: {
            id: string;
            /** @description The Ticket this belongs to. */
            ticketId: string;
            /** @description The internal note, as plain text. Never shown to a Contact. */
            body: string;
            /** @description What kind of thing wrote this. In practice a User or a ServiceToken — a Contact cannot hold `note:write`. Server-stamped and not settable. */
            authorKind: components["schemas"]["ActorKind"];
            /**
             * Format: uuid
             * @description The author’s id, or null for `system`. Read it against `authorKind`.
             */
            authorId: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        PortalSignInDto: {
            /**
             * Format: uuid
             * @description Which tenant’s portal to sign in to. Scoped to `(tenantId, email)`, so the same address at two tenants is two separate Contacts.
             */
            tenantId: string;
            /**
             * Format: email
             * @example jules@example.test
             */
            email: string;
            /** Format: password */
            password: string;
        };
        ContactPrincipalDto: {
            /**
             * @description Always `contact` here. The staff surface answers `user`; a client holding one kind of token cannot reach the other’s endpoint.
             * @enum {string}
             */
            kind: "contact";
            /** Format: uuid */
            contactId: string;
            /** Format: uuid */
            tenantId: string;
            /**
             * Format: email
             * @description Null for a Contact that has never been identified — a widget visitor, say. A Contact that can sign in here necessarily has one.
             */
            email: string | null;
            name: string | null;
            /** @description Whether this Contact’s identity has been confirmed, as opposed to inferred from an anonymous session. */
            verified: boolean;
        };
        OpenTicketDto: {
            /** @description What the Ticket is about, in one line. */
            subject: string;
        };
        StartWidgetSessionDto: {
            /**
             * Format: uuid
             * @description Which tenant’s widget this is. Public — it is embedded in the widget snippet on the tenant’s own site — and it grants nothing on its own: the request is refused unless the `Origin` header is on that tenant’s allowlist.
             */
            tenantId: string;
        };
        WidgetSessionDto: {
            /** @description Bearer credential for the widget surface, prefixed `nvw_`. Hold it in memory for the life of the page — persisting it to `localStorage` leaves a working session behind on a shared machine. */
            token: string;
            /**
             * @description Seconds until this session expires. Renew before it elapses at `POST /widget/sessions/renew`; renewal keeps the same session and therefore the same conversation.
             * @example 1800
             */
            expiresInSeconds: number;
        };
        OpenWidgetTicketDto: {
            /** @description What the Ticket is about, in one line. */
            subject: string;
        };
        MintServiceTokenDto: {
            /**
             * @description What this credential is for, in your own words. The only reason to list tokens is to decide which one to revoke, and a page of uuids cannot answer that.
             * @example Triage assistant (production)
             */
            name: string;
            /**
             * @description Permissions this token may exercise, drawn from the same catalog staff roles are built from — there is one authority vocabulary, not two. `GET /service-tokens/scopes` lists what may be granted. Destructive, configuration, user-management and audit-read permissions are refused here: no machine credential can hold them.
             *
             *     Reply and note authority are separable, so an AI layer can run suggest-only — `note:write` without `ticket:reply` drafts internally without ever speaking to a customer.
             * @example [
             *       "ticket:read",
             *       "ticket:reply"
             *     ]
             */
            scopes: ("ticket:read" | "ticket:create" | "ticket:reply" | "ticket:transition" | "ticket:assign" | "ticket:priority" | "note:read" | "note:write" | "contact:read" | "analytics:read" | "user:read")[];
        };
        MintedServiceTokenDto: {
            /** Format: uuid */
            id: string;
            /** @example Triage assistant (production) */
            name: string;
            /**
             * @description The permissions this token actually carries — what it would be authorized for on its next request, not the raw stored column. The two differ only for a row written outside the mint path, and in that case this list is the honest one.
             * @example [
             *       "ticket:read",
             *       "ticket:reply"
             *     ]
             */
            scopes: string[];
            /**
             * Format: uuid
             * @description The User who minted it. Stamped by the server from their credential, so it cannot be forged.
             */
            createdById: string;
            /**
             * Format: date-time
             * @description When it was revoked, or null while it is live. Revocation is final and takes effect on the token’s very next request — there is no cache in the authentication path.
             */
            revokedAt: Record<string, never> | null;
            /** Format: date-time */
            createdAt: string;
            /**
             * @description The credential, shown **once**. Only its hash is stored, so it cannot be recovered — a lost token is reminted, never looked up. Store it wherever your integration keeps secrets before leaving this response.
             * @example nvk_live_0195c8e0-1a2b-7c3d-8e4f-5a6b7c8d9e0f.J8s...
             */
            token: string;
        };
        AssignableScopeDto: {
            /** @example ticket:reply */
            scope: string;
            /** @example Post a customer-visible Message on a Ticket. */
            description: string;
        };
        AssignableScopesDto: {
            scopes: components["schemas"]["AssignableScopeDto"][];
        };
        ServiceTokenDto: {
            /** Format: uuid */
            id: string;
            /** @example Triage assistant (production) */
            name: string;
            /**
             * @description The permissions this token actually carries — what it would be authorized for on its next request, not the raw stored column. The two differ only for a row written outside the mint path, and in that case this list is the honest one.
             * @example [
             *       "ticket:read",
             *       "ticket:reply"
             *     ]
             */
            scopes: string[];
            /**
             * Format: uuid
             * @description The User who minted it. Stamped by the server from their credential, so it cannot be forged.
             */
            createdById: string;
            /**
             * Format: date-time
             * @description When it was revoked, or null while it is live. Revocation is final and takes effect on the token’s very next request — there is no cache in the authentication path.
             */
            revokedAt: Record<string, never> | null;
            /** Format: date-time */
            createdAt: string;
        };
        RateDto: {
            /** @description The numerator — how many tickets this counts. */
            count: number;
            /** @description The fraction of the cohort, in [0, 1], or null over an empty cohort. */
            rate: number | null;
        };
        DurationDto: {
            /** @description Median (50th percentile), milliseconds. */
            p50: number;
            /** @description 90th percentile, milliseconds. */
            p90: number;
        };
        MetricsDto: {
            /** @description The shared denominator: Tickets created in the window. Every rate below is over this. */
            cohortSize: number;
            /** @description Terminal Tickets with no agent touch — no user-authored Message or Note. Credits AI handling and self-service only. */
            deflection: components["schemas"]["RateDto"];
            /** @description Tickets that reached `resolved` or `closed`. */
            resolution: components["schemas"]["RateDto"];
            /** @description Tickets whose first-response SLA latch is set — a slow start. */
            firstResponseBreach: components["schemas"]["RateDto"];
            /** @description Tickets whose resolution SLA latch is set — a slow finish. */
            resolutionBreach: components["schemas"]["RateDto"];
            /** @description Time from creation to first agent-visible reply, over Tickets that got one. */
            firstResponseMs: components["schemas"]["DurationDto"] | null;
            /** @description Pause-aware active time to terminal, over Tickets that reached one. */
            resolutionMs: components["schemas"]["DurationDto"] | null;
        };
        GroupMetricsDto: {
            /** @description The shared denominator: Tickets created in the window. Every rate below is over this. */
            cohortSize: number;
            /** @description Terminal Tickets with no agent touch — no user-authored Message or Note. Credits AI handling and self-service only. */
            deflection: components["schemas"]["RateDto"];
            /** @description Tickets that reached `resolved` or `closed`. */
            resolution: components["schemas"]["RateDto"];
            /** @description Tickets whose first-response SLA latch is set — a slow start. */
            firstResponseBreach: components["schemas"]["RateDto"];
            /** @description Tickets whose resolution SLA latch is set — a slow finish. */
            resolutionBreach: components["schemas"]["RateDto"];
            /** @description Time from creation to first agent-visible reply, over Tickets that got one. */
            firstResponseMs: components["schemas"]["DurationDto"] | null;
            /** @description Pause-aware active time to terminal, over Tickets that reached one. */
            resolutionMs: components["schemas"]["DurationDto"] | null;
            /** @description The group value — the priority, source, assignee id, or `YYYY-MM-DD` day this slice is for. */
            key: string;
        };
        AnalyticsReportDto: {
            /**
             * Format: date-time
             * @description The cohort window start (inclusive).
             */
            from: string;
            /**
             * Format: date-time
             * @description The cohort window end (exclusive).
             */
            to: string;
            /**
             * @description The axis the breakdown is over, or null for the ungrouped report.
             * @enum {string|null}
             */
            groupBy: "priority" | "source" | "assignee" | "day" | null;
            /** @description The figures over the whole cohort. */
            overall: components["schemas"]["MetricsDto"];
            /** @description The per-group breakdown, or null when no group-by was asked for. */
            groups: components["schemas"]["GroupMetricsDto"][] | null;
        };
        LivenessDto: {
            /**
             * @example ok
             * @enum {string}
             */
            status: "ok";
            /**
             * @description Seconds since the process started.
             * @example 42
             */
            uptimeSeconds: number;
        };
        DependencyDto: {
            /**
             * @example ok
             * @enum {string}
             */
            status: "ok" | "unavailable";
        };
        RedisDto: {
            /**
             * @description Neither `degraded` nor `dormant` fails the check. `dormant` means REDIS_URL is unset, which is a supported configuration; `degraded` means it is set and not answering. Both mean no rate-limit ceilings are being enforced, and every request is still served correctly.
             * @example ok
             * @enum {string}
             */
            status: "ok" | "degraded" | "dormant";
        };
        TickDto: {
            /** @example fast-drain */
            name: string;
            /**
             * @example ok
             * @enum {string}
             */
            status: "ok" | "stalled";
            /**
             * @description Null when the ticker has been started but has never fired.
             * @example 2026-07-19T12:00:00.000Z
             */
            lastTickAt: Record<string, never> | null;
            /**
             * @description Seconds since the last tick. Null when there has been none.
             * @example 1.4
             */
            ageSeconds: Record<string, never> | null;
        };
        SchedulerDto: {
            /**
             * @description `disabled` is healthy — it means RUN_SCHEDULER put no ticker in this process, which is the normal state for a web instance once the scheduler moves to its own service.
             * @example ok
             * @enum {string}
             */
            status: "ok" | "stalled" | "disabled";
            ticks: components["schemas"]["TickDto"][];
        };
        ReadinessDto: {
            /**
             * @example ok
             * @enum {string}
             */
            status: "ok" | "unavailable";
            database: components["schemas"]["DependencyDto"];
            redis: components["schemas"]["RedisDto"];
            scheduler: components["schemas"]["SchedulerDto"];
        };
        ErrorCodeDto: {
            /**
             * @description The stable `snake_case` code clients branch on.
             * @enum {string}
             */
            code: "malformed_request" | "invalid_filter" | "invalid_sort" | "invalid_cursor" | "unauthenticated" | "forbidden" | "not_found" | "conflict" | "idempotency_in_flight" | "validation_failed" | "idempotency_key_reused" | "rate_limited" | "internal_error" | "integration_dormant";
            /**
             * @description The HTTP status this code is always returned with.
             * @example 404
             */
            status: number;
            /** @description What this code means and when it is emitted. */
            description: string;
        };
        PaginationQuery: {
            /**
             * @description Maximum rows to return. Defaults to 25.
             * @default 25
             */
            limit: number;
            /** @description Opaque cursor from a previous response's `nextCursor`. Treat as a black box — its contents are an implementation detail and its format may change. Changing `sort` invalidates it. */
            cursor?: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    AuthController_signIn: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SignInDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    AuthController_signInWithGoogle: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GoogleSignInDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `integration_dormant` — An optional integration this operation depends on is not configured in this deployment. Not a fault and not a permission problem: the capability is absent here and no retry will produce it. Optional integrations are dormant when unconfigured rather than fatal, so the rest of the API is unaffected — a client seeing this should hide the affected affordance and use the alternative, such as email-and-password sign-in in place of Google. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    AuthController_refresh: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    AuthController_signOut: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AuthController_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrincipalDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    AuditController_list: {
        parameters: {
            query?: {
                /** @description Maximum rows to return. Defaults to 25. */
                limit?: number;
                /** @description Opaque cursor from a previous response's `nextCursor`. Treat as a black box — its contents are an implementation detail and its format may change. Changing `sort` invalidates it. */
                cursor?: string;
                /** @description `createdAt`, with a leading `-` for descending. Defaults to `-createdAt` — newest first. Changing it invalidates a cursor. */
                sort?: string;
            };
            header?: never;
            path: {
                /** @description The Ticket’s id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AuditEntryDto"][];
                        /** @description Pass as `cursor` to fetch the next page. `null` means end of list. Opaque — do not parse. */
                        nextCursor: string | null;
                    };
                };
            };
            /**
             * @description `malformed_request` — The request could not be parsed or is structurally invalid.
             *
             *     `invalid_sort` — The requested sort field is not sortable on this resource. Use `field` for ascending, `-field` for descending.
             *
             *     `invalid_cursor` — The pagination cursor is malformed or was issued for a different sort. Restart the traversal without a cursor.
             */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    InvitationsController_invite: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InviteStaffDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `conflict` — The request conflicts with the current state of the resource. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    InvitationsController_accept: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AcceptInvitationDto"];
            };
        };
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    TicketsController_list: {
        parameters: {
            query?: {
                /** @description Maximum rows to return. Defaults to 25. */
                limit?: number;
                /** @description Opaque cursor from a previous response's `nextCursor`. Treat as a black box — its contents are an implementation detail and its format may change. Changing `sort` invalidates it. */
                cursor?: string;
                /** @description One state, or several comma-separated. One of: open, pending, on_hold, resolved, closed. */
                state?: string;
                /** @description One priority, or several comma-separated. One of: low, normal, high, urgent. */
                priority?: string;
                /** @description One source, or several comma-separated. One of: portal, widget, slack. */
                source?: string;
                /** @description A User's id, or `none` for untriaged Tickets. */
                assigneeId?: string;
                /** @description A Contact's id — the requester. */
                contactId?: string;
                /** @description ISO-8601. Tickets created at or after this instant. */
                createdAfter?: string;
                /** @description ISO-8601. Tickets created at or before this instant. */
                createdBefore?: string;
                /** @description `createdAt` or `updatedAt`, with a leading `-` for descending. Defaults to `-createdAt`. Changing it invalidates a cursor. */
                sort?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["TicketDto"][];
                        /** @description Pass as `cursor` to fetch the next page. `null` means end of list. Opaque — do not parse. */
                        nextCursor: string | null;
                    };
                };
            };
            /**
             * @description `invalid_filter` — An unknown query parameter was supplied, or a filter value is outside the allowed set for this resource. Unknown parameters are rejected rather than ignored.
             *
             *     `invalid_sort` — The requested sort field is not sortable on this resource. Use `field` for ascending, `-field` for descending.
             *
             *     `invalid_cursor` — The pagination cursor is malformed or was issued for a different sort. Restart the traversal without a cursor.
             */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    TicketsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTicketDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    TicketsController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketDto"];
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    TicketsController_conversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["TicketDto"][];
                        /** @description Pass as `cursor` to fetch the next page. `null` means end of list. Opaque — do not parse. */
                        nextCursor: string | null;
                    };
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    TicketsController_transition: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetStateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketDto"];
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `conflict` — The request conflicts with the current state of the resource. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    TicketsController_setPriority: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetPriorityDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketDto"];
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `conflict` — The request conflicts with the current state of the resource. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    TicketsController_setAssignee: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetAssigneeDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketDto"];
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    MessagesController_list: {
        parameters: {
            query?: {
                /** @description Maximum rows to return. Defaults to 25. */
                limit?: number;
                /** @description Opaque cursor from a previous response's `nextCursor`. Treat as a black box — its contents are an implementation detail and its format may change. Changing `sort` invalidates it. */
                cursor?: string;
                /** @description `createdAt`, with a leading `-` for descending. Defaults to `-createdAt` — newest first, which is where the work is. Ask for `createdAt` to render the thread top-down. Changing it invalidates a cursor. */
                sort?: string;
            };
            header?: never;
            path: {
                /** @description The Ticket’s id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["MessageDto"][];
                        /** @description Pass as `cursor` to fetch the next page. `null` means end of list. Opaque — do not parse. */
                        nextCursor: string | null;
                    };
                };
            };
            /**
             * @description `malformed_request` — The request could not be parsed or is structurally invalid.
             *
             *     `invalid_sort` — The requested sort field is not sortable on this resource. Use `field` for ascending, `-field` for descending.
             *
             *     `invalid_cursor` — The pagination cursor is malformed or was issued for a different sort. Restart the traversal without a cursor.
             */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    MessagesController_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The Ticket’s id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateMessageDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MessageDto"];
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    NotesController_list: {
        parameters: {
            query?: {
                /** @description Maximum rows to return. Defaults to 25. */
                limit?: number;
                /** @description Opaque cursor from a previous response's `nextCursor`. Treat as a black box — its contents are an implementation detail and its format may change. Changing `sort` invalidates it. */
                cursor?: string;
                /** @description `createdAt`, with a leading `-` for descending. Defaults to `-createdAt` — newest first, which is where the work is. Ask for `createdAt` to render the thread top-down. Changing it invalidates a cursor. */
                sort?: string;
            };
            header?: never;
            path: {
                /** @description The Ticket’s id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["NoteDto"][];
                        /** @description Pass as `cursor` to fetch the next page. `null` means end of list. Opaque — do not parse. */
                        nextCursor: string | null;
                    };
                };
            };
            /**
             * @description `malformed_request` — The request could not be parsed or is structurally invalid.
             *
             *     `invalid_sort` — The requested sort field is not sortable on this resource. Use `field` for ascending, `-field` for descending.
             *
             *     `invalid_cursor` — The pagination cursor is malformed or was issued for a different sort. Restart the traversal without a cursor.
             */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    NotesController_write: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The Ticket’s id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateNoteDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoteDto"];
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    PortalAuthController_signIn: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PortalSignInDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    PortalAuthController_refresh: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    PortalAuthController_signOut: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PortalAuthController_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactPrincipalDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    PortalTicketsController_list: {
        parameters: {
            query?: {
                /** @description Maximum rows to return. Defaults to 25. */
                limit?: number;
                /** @description Opaque cursor from a previous response's `nextCursor`. Treat as a black box — its contents are an implementation detail and its format may change. Changing `sort` invalidates it. */
                cursor?: string;
                /** @description One state, or several comma-separated. One of: open, pending, on_hold, resolved, closed. */
                state?: string;
                /** @description One priority, or several comma-separated. One of: low, normal, high, urgent. */
                priority?: string;
                /** @description One source, or several comma-separated. One of: portal, widget, slack. */
                source?: string;
                /** @description A User's id, or `none` for untriaged Tickets. */
                assigneeId?: string;
                /** @description A Contact's id — the requester. */
                contactId?: string;
                /** @description ISO-8601. Tickets created at or after this instant. */
                createdAfter?: string;
                /** @description ISO-8601. Tickets created at or before this instant. */
                createdBefore?: string;
                /** @description `createdAt` or `updatedAt`, with a leading `-` for descending. Defaults to `-createdAt`. Changing it invalidates a cursor. */
                sort?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["TicketDto"][];
                        /** @description Pass as `cursor` to fetch the next page. `null` means end of list. Opaque — do not parse. */
                        nextCursor: string | null;
                    };
                };
            };
            /**
             * @description `invalid_filter` — An unknown query parameter was supplied, or a filter value is outside the allowed set for this resource. Unknown parameters are rejected rather than ignored.
             *
             *     `invalid_sort` — The requested sort field is not sortable on this resource. Use `field` for ascending, `-field` for descending.
             *
             *     `invalid_cursor` — The pagination cursor is malformed or was issued for a different sort. Restart the traversal without a cursor.
             */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    PortalTicketsController_open: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OpenTicketDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    PortalTicketsController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketDto"];
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    PortalTicketsController_thread: {
        parameters: {
            query?: {
                /** @description Maximum rows to return. Defaults to 25. */
                limit?: number;
                /** @description Opaque cursor from a previous response's `nextCursor`. Treat as a black box — its contents are an implementation detail and its format may change. Changing `sort` invalidates it. */
                cursor?: string;
                /** @description `createdAt`, with a leading `-` for descending. Defaults to `-createdAt` — newest first, which is where the work is. Ask for `createdAt` to render the thread top-down. Changing it invalidates a cursor. */
                sort?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["MessageDto"][];
                        /** @description Pass as `cursor` to fetch the next page. `null` means end of list. Opaque — do not parse. */
                        nextCursor: string | null;
                    };
                };
            };
            /**
             * @description `malformed_request` — The request could not be parsed or is structurally invalid.
             *
             *     `invalid_sort` — The requested sort field is not sortable on this resource. Use `field` for ascending, `-field` for descending.
             *
             *     `invalid_cursor` — The pagination cursor is malformed or was issued for a different sort. Restart the traversal without a cursor.
             */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    PortalTicketsController_reply: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateMessageDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MessageDto"];
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `conflict` — The request conflicts with the current state of the resource. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    WidgetSessionsController_start: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StartWidgetSessionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WidgetSessionDto"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    WidgetSessionsController_renew: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WidgetSessionDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    WidgetTicketsController_list: {
        parameters: {
            query?: {
                /** @description Maximum rows to return. Defaults to 25. */
                limit?: number;
                /** @description Opaque cursor from a previous response's `nextCursor`. Treat as a black box — its contents are an implementation detail and its format may change. Changing `sort` invalidates it. */
                cursor?: string;
                /** @description One state, or several comma-separated. One of: open, pending, on_hold, resolved, closed. */
                state?: string;
                /** @description One priority, or several comma-separated. One of: low, normal, high, urgent. */
                priority?: string;
                /** @description One source, or several comma-separated. One of: portal, widget, slack. */
                source?: string;
                /** @description A User's id, or `none` for untriaged Tickets. */
                assigneeId?: string;
                /** @description A Contact's id — the requester. */
                contactId?: string;
                /** @description ISO-8601. Tickets created at or after this instant. */
                createdAfter?: string;
                /** @description ISO-8601. Tickets created at or before this instant. */
                createdBefore?: string;
                /** @description `createdAt` or `updatedAt`, with a leading `-` for descending. Defaults to `-createdAt`. Changing it invalidates a cursor. */
                sort?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["TicketDto"][];
                        /** @description Pass as `cursor` to fetch the next page. `null` means end of list. Opaque — do not parse. */
                        nextCursor: string | null;
                    };
                };
            };
            /**
             * @description `invalid_filter` — An unknown query parameter was supplied, or a filter value is outside the allowed set for this resource. Unknown parameters are rejected rather than ignored.
             *
             *     `invalid_sort` — The requested sort field is not sortable on this resource. Use `field` for ascending, `-field` for descending.
             *
             *     `invalid_cursor` — The pagination cursor is malformed or was issued for a different sort. Restart the traversal without a cursor.
             */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    WidgetTicketsController_open: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OpenWidgetTicketDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    WidgetTicketsController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketDto"];
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    WidgetTicketsController_thread: {
        parameters: {
            query?: {
                /** @description Maximum rows to return. Defaults to 25. */
                limit?: number;
                /** @description Opaque cursor from a previous response's `nextCursor`. Treat as a black box — its contents are an implementation detail and its format may change. Changing `sort` invalidates it. */
                cursor?: string;
                /** @description `createdAt`, with a leading `-` for descending. Defaults to `-createdAt` — newest first, which is where the work is. Ask for `createdAt` to render the thread top-down. Changing it invalidates a cursor. */
                sort?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["MessageDto"][];
                        /** @description Pass as `cursor` to fetch the next page. `null` means end of list. Opaque — do not parse. */
                        nextCursor: string | null;
                    };
                };
            };
            /**
             * @description `malformed_request` — The request could not be parsed or is structurally invalid.
             *
             *     `invalid_sort` — The requested sort field is not sortable on this resource. Use `field` for ascending, `-field` for descending.
             *
             *     `invalid_cursor` — The pagination cursor is malformed or was issued for a different sort. Restart the traversal without a cursor.
             */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    WidgetTicketsController_reply: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateMessageDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MessageDto"];
                };
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `conflict` — The request conflicts with the current state of the resource. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ServiceTokensController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceTokenDto"][];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ServiceTokensController_mint: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MintServiceTokenDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MintedServiceTokenDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `validation_failed` — The request body failed validation. `details` enumerates one entry per offending field. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ServiceTokensController_assignableScopes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssignableScopesDto"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ServiceTokensController_revoke: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `malformed_request` — The request could not be parsed or is structurally invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `not_found` — No such resource is visible to this principal. A record belonging to another tenant is indistinguishable from one that does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `conflict` — The request conflicts with the current state of the resource. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    AnalyticsController_report: {
        parameters: {
            query?: {
                /** @description ISO-8601. The cohort is Tickets created at or after this instant. Defaults to 30 days before `to`. */
                from?: string;
                /** @description ISO-8601. The cohort is Tickets created strictly before this instant. Defaults to now. */
                to?: string;
                /** @description Break the figures down by one axis. One of: priority, source, assignee, day. Omit for the ungrouped report. */
                groupBy?: "priority" | "source" | "assignee" | "day";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnalyticsReportDto"];
                };
            };
            /** @description `invalid_filter` — An unknown query parameter was supplied, or a filter value is outside the allowed set for this resource. Unknown parameters are rejected rather than ignored. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `unauthenticated` — No credential was presented, or the credential is invalid or expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `forbidden` — The principal is authenticated but lacks the permission this operation requires. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    HealthController_liveness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LivenessDto"];
                };
            };
        };
    };
    HealthController_readiness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadinessDto"];
                };
            };
            /** @description A dependency is unavailable, or a scheduler tick has stalled. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadinessDto"];
                };
            };
        };
    };
    MetaController_errorCodes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorCodeDto"][];
                };
            };
        };
    };
}
