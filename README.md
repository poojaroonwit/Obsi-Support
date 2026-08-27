# Obsi Support

Obsi Support is the customer help-desk product in the Obsi suite. It is independently deployable while following the same Outborn Account identity model and Obsi workspace shell used by Obsi Task.

## Implemented vertical slices

- Agent inbox with New/Open/Pending/Resolved queues and search.
- Ticket detail with customer conversation, internal notes, status and priority management.
- Priority-based first-response and resolution SLA targets with breach state.
- Configurable 24×7 or business-hours SLA policies with workspace timezone and holidays.
- Public request form and secure requester portal.
- Email-to-ticket, outbound replies, threading and delivery state through Resend.
- Tenant-scoped support teams, capacity-aware routing and validated manual assignment.
- Canned replies/macros with safe variables and explicitly staged actions.
- One-time CSAT surveys for resolved tickets through portal and optional email invitations.
- Support Analytics with 7/30/90-day volume, SLA, response/resolution time, CSAT, backlog and workload views.
- PostgreSQL tenant isolation and Outborn Account OAuth 2.0 Authorization Code + PKCE.
- Railway/Docker-friendly production build and GitHub Actions verification.

## Operations workspaces

- **Inbox** — queues, conversations, replies, notes, SLA and assignment controls.
- **Routing** — teams, members, capacity and routing rules.
- **SLA** — 24×7 or business-time targets, timezone, hours and holidays.
- **Macros** — reusable response drafts and staged ticket actions.
- **Analytics** — 7/30/90-day operational and customer-experience metrics.

## Customer channels

Customers can create requests through the public organization form or email, continue conversations through email or the private portal, and submit one CSAT rating after resolution. Public tokens are random and stored only as SHA-256 hashes.

## Analytics

Analytics is read-only and tenant-scoped. Windowed metrics include created/resolved tickets, first-response and resolution SLA attainment, median response/resolution time, channel/priority/status mix and CSAT. Backlog-by-team and backlog-by-agent are current operational state. Daily trend buckets use UTC dates. If the CSAT migration has not been applied, CSAT metrics safely return zero while the rest of Analytics remains available.

## Local setup

1. `cp .env.example .env.local`
2. Configure PostgreSQL and Outborn Account OAuth values.
3. `npm install`
4. `npm run db:migrate`
5. `npm run dev`

## Production

Set `DATABASE_URL`, `SESSION_SECRET`, `APP_PUBLIC_URL`, `OUTBORN_ACCOUNT_AUTH_URL`, and the registered OAuth client ID. For email, also set the Resend/support-domain values. Run `npm run db:migrate`, then `npm start` after the Next.js build.

## Roadmap status

The planned core help-desk roadmap is implemented: ticketing, customer portal, email, SLA, routing, macros, CSAT, and support analytics.
