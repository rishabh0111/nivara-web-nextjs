# Nivara Desk: the app surfaces

**What it is.** The four front ends of Nivara Desk, a multitenant customer-support helpdesk with
an AI layer. For each question the AI does one of three things: it answers what the tenant's help
centre covers, it asks one clarifying question, or it hands the question to a person with a note
on what it found.

**What it is not.** A product for sale. It is a working, deployed portfolio project; the tenants
and their tickets are seeded demo data (`npm run db:seed` in nivara-api-nestjs). Every figure on
these screens comes from the API.

**Who opens it.** An engineer or engineering lead judging the system, usually arriving from the
product page through `/dashboard?demo`, signed in as Meridian's seeded admin. Inside the product,
the reader is an agent or admin working the queue.

**The one question each screen answers.**

| Surface | Route | Question |
|---|---|---|
| Queue | `/dashboard` | Which tickets need a person now, and which did the AI already settle? |
| Ticket | `/dashboard` (opened from the queue) | What did the AI decide here, and what is left for me to do? |
| Analytics | `/dashboard/analytics` | How much did the desk settle without a person, and how fast? |
| Portal | `/portal` | What have I asked, and what has support said? |
| Widget | `/widget` | Can I get an answer here, without an account? |

**The one action.** On the queue, claim what needs a person ("Assign to me", or "Show only
these"). From outside, open the live demo.

**The AI's ruling.** The API does not store a ruling on a ticket. The app reads it from what
Automation wrote (`src/tickets/ruling.ts`): an escalation note is a hand-over; Automation's last
reply is an answer, or a question when it is a single sentence ending in "?", is the last
message, and the ticket is still open. Every place the ruling is shown says it is read this way.

**Surfaces and credentials.** Portal: a Contact. Dashboard: a User with the agent or admin role.
Analytics: an admin. Widget: an anonymous Visitor on a tenant's site.

**Design system.** The product page's (`nivara-landing/DESIGN.md`), kept here as palette and
type; the app's composition is a framed sheet. The signature element is the ruling strip,
Answer / Ask / Hand over, one lit. Orange is spent on the lit hand-over, the count of tickets
waiting on a person and the one primary action on a screen.
