# Obsi Support

Obsi Support is the customer help-desk product in the Obsi suite. It is independently deployable while following the same Outborn Account identity model and Obsi workspace shell used by Obsi Task.

## Implemented vertical slice

- Agent inbox with New/Open/Pending/Resolved queues and search.
- Ticket detail with customer conversation, internal notes, status and priority management.
- Priority-based first-response and resolution SLA targets with breach state.
- Public request form per organization.
- Private requester portal with secure hashed, expiring tokens and customer replies.
- Customer replies reopen resolved/pending tickets.
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

## Production

Set `DATABASE_URL`, `SESSION_SECRET`, `APP_PUBLIC_URL`, `OUTBORN_ACCOUNT_AUTH_URL`, and the registered OAuth client ID. Run `npm run db:migrate` once for the database, then `npm start` after the Next.js build.

## Next recommended slices

Email-to-ticket and outbound email delivery, assignment groups/routing, configurable business-hours SLA policies, canned replies/macros, CSAT, and support analytics should be added as separate tested slices.
