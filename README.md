# Obsi Support

Obsi Support is the customer help-desk product in the Obsi suite. It is independently deployable while following the same Outborn Account identity model and Obsi workspace shell used by Obsi Task.

## Implemented vertical slices

- Agent inbox with New/Open/Pending/Resolved queues and search.
- Ticket detail with customer conversation, internal notes, status and priority management.
- Priority-based first-response and resolution SLA targets with breach state.
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

Obsi Support currently uses Resend as its first email transport while keeping ticket/threading logic provider-neutral.

1. Set `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SUPPORT_EMAIL_FROM`, and `SUPPORT_EMAIL_DOMAIN`.
2. Configure the receiving domain in Resend. By default an organization receives mail at `<organization-slug>@<SUPPORT_EMAIL_DOMAIN>`; `support_email_address` can override that address per organization.
3. Point Resend webhooks to `https://<your-support-host>/api/webhooks/resend`.
4. Subscribe the webhook to `email.received`, `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.failed`, `email.bounced`, and `email.suppressed`.
5. Run `npm run db:migrate` after deploying the email slice so the threading/delivery columns and indexes are present.

Inbound webhooks are verified against the raw request body. Duplicate provider/message IDs are ignored. An inbound reply can only attach to an existing ticket when it resolves inside the same organization and the sender matches that ticket's requester email.

If the Resend outbound variables are not configured, agent replies continue to work as customer-visible portal replies without attempting email delivery.

## Assignment groups & routing

Open **Routing** from the sidebar to configure teams, agents, capacities and ordered rules.

- A rule can match one channel and/or priority in the first routing slice; empty conditions match all.
- The first enabled matching rule selects the destination team.
- Automatic assignment chooses the active member with the lowest `active ticket load / capacity` ratio.
- Members at or above capacity are not eligible. If every active member is full, the team is assigned but the ticket remains unassigned.
- New portal, manual/API and email-created tickets route automatically. Existing threaded replies keep their current ownership.
- Manual assignment is validated against the current organization and selected team; free-form assignee IDs are rejected.
- Routing errors never block ticket intake. The ticket is created and remains unassigned if automatic routing cannot run.

Run `npm run db:migrate` after deploying this slice to create `support_teams`, `support_team_members`, `support_routing_rules`, assignment audit records and ticket team fields.

## Production

Set `DATABASE_URL`, `SESSION_SECRET`, `APP_PUBLIC_URL`, `OUTBORN_ACCOUNT_AUTH_URL`, and the registered OAuth client ID. For email, also set the Resend and support-domain values described above. Run `npm run db:migrate` once for the database, then `npm start` after the Next.js build.

## Next recommended slices

Configurable business-hours SLA policies, canned replies/macros, CSAT, and support analytics should be added as separate tested slices.
