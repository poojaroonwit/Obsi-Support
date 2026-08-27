# Obsi Support

Obsi Support is the customer help-desk product in the Obsi suite. It is independently deployable while following the same Outborn Account identity model and Obsi workspace shell used by Obsi Task.

## Implemented vertical slices

- Agent inbox with New/Open/Pending/Resolved queues and search.
- Ticket detail with customer conversation, internal notes, status and priority management.
- Priority-based first-response and resolution SLA targets with breach state.
- Configurable 24×7 or business-hours SLA policies with workspace timezone and holidays.
- Public request form per organization.
- Private requester portal with secure hashed, expiring tokens and customer replies.
- Customer replies reopen resolved/pending tickets.
- Email-to-ticket through verified Resend webhooks and the Resend Receiving API.
- Inbound reply threading by Message-ID/References, with `SUP-######` subject fallback.
- Requester-email matching before an inbound message can join an existing ticket.
- Agent replies delivered by email with idempotency keys and standard thread headers.
- Email delivery status tracked on the conversation, including delayed, failed and bounced states.
- Tenant-scoped support teams, members, capacity and routing rules.
- Automatic least-load assignment for new portal/API/email tickets.
- Manual team/assignee reassignment with cross-team and cross-tenant validation.
- Team/assignee inbox filters and assignment audit/system messages.
- Canned replies/macros with variables and explicitly staged ticket actions.
- One-time CSAT surveys for resolved tickets through portal and optional email invitations.
- PostgreSQL tenant isolation through `organization_id` on every ticket query.
- Outborn Account OAuth 2.0 Authorization Code + PKCE login using client `outborn-obsi-support-web`.
- Railway/Docker-friendly production build.

## Local setup

1. `cp .env.example .env.local`
2. Configure PostgreSQL and Outborn Account OAuth values.
3. `npm install`
4. `npm run db:migrate`
5. `npm run dev`

The first successful Outborn Account login provisions that organization in `support_organizations`. Its public intake URL is `/request/<organization-slug>`.

## Email setup

Obsi Support currently uses Resend as its first email transport while keeping ticket/threading logic provider-neutral. Configure `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SUPPORT_EMAIL_FROM`, and `SUPPORT_EMAIL_DOMAIN`, then point Resend webhooks to `/api/webhooks/resend` for receiving and delivery events.

## Assignment groups & routing

Open **Routing** from the sidebar to configure teams, agents, capacities and ordered rules. New tickets route using the first matching rule and least-load eligible member; manual assignment remains validated within the current organization/team.

## SLA policies

Open **SLA** to configure 24×7 or business-time targets with an IANA timezone, weekly hours and holidays. New and reprioritized tickets use the current policy; existing deadlines are not silently rewritten.

## Canned replies & macros

Open **Macros** to create reusable reply drafts with safe requester/ticket/agent variables and optional staged status, priority, team and assignee actions. Selecting a macro never auto-sends or auto-mutates a ticket.

## CSAT

When a ticket first moves to **Resolved** or **Closed**, Obsi Support creates one 30-day satisfaction survey. The customer can rate the interaction from 1–5 with an optional comment from the existing portal. If outbound email is configured, Obsi Support also sends a secure survey link; only the SHA-256 token hash is stored. A survey can be submitted only once, and reopening a ticket does not erase an existing response.

Run `npm run db:migrate` after deploying this slice to create `support_csat_surveys`.

## Production

Set `DATABASE_URL`, `SESSION_SECRET`, `APP_PUBLIC_URL`, `OUTBORN_ACCOUNT_AUTH_URL`, and the registered OAuth client ID. For email, also set the Resend/support-domain values. Run `npm run db:migrate`, then `npm start` after the Next.js build.

## Next recommended slice

Support analytics.
