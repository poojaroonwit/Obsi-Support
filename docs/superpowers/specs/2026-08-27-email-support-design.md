# Obsi Support Email-to-Ticket Design

## Goal

Add production-oriented email intake and outbound customer replies to Obsi Support without coupling the ticket domain to one email provider.

## Architecture

The ticket and threading rules live in provider-neutral modules. Resend is the first transport adapter and is responsible only for webhook verification, retrieving received messages, and sending outbound messages. The existing PostgreSQL repository remains the source of truth for tickets, conversations, SLA state, provider IDs, and delivery state.

The flow is:

1. Resend sends a signed webhook to `/api/webhooks/resend`.
2. Obsi Support verifies the Svix-compatible signature against the raw body.
3. For `email.received`, the service retrieves the full received email, normalizes it, resolves the destination organization, and asks the repository to deduplicate/thread/create the ticket.
4. Threading first uses Message-ID references, then the `SUP-######` subject key. Both paths require the inbound sender to match the ticket requester email and remain inside the resolved organization.
5. Agent customer-visible replies are stored before sending. When outbound email is configured, the stored message is marked pending and sent through Resend with an idempotency key plus `In-Reply-To`/`References` headers.
6. The ticket first-response SLA is satisfied only after Resend accepts the outbound email. Delivery webhooks then update sent/delivered/delayed/failed/bounced state shown in the conversation.

## Data model

`support_organizations` gains an optional unique `support_email_address`. If no explicit address is provided and `SUPPORT_EMAIL_DOMAIN` is configured, organization provisioning derives `<organization-slug>@<SUPPORT_EMAIL_DOMAIN>`.

`support_messages` gains:

- `channel`
- `provider_email_id`
- `external_message_id`
- `delivery_status`
- `delivery_error`
- `attachments` metadata

Provider and Message-ID columns use partial unique indexes to prevent duplicate webhook ingestion.

## Security and failure behavior

- Webhook verification uses the exact raw request body and rejects missing, stale, or invalid signatures.
- Inbound organization resolution only accepts an explicitly stored support address or a slug address on the configured support domain.
- A ticket key alone is insufficient to join a thread; sender email must match the existing requester.
- Provider/message IDs are deduplicated before inserting an inbound conversation message.
- Outbound idempotency is keyed by the immutable support message ID.
- A failed send remains stored and visible with its error state. The API returns a delivery error rather than deleting the agent's work.
- Without outbound Resend configuration, existing portal-visible replies continue to work.

## Scope

Included: inbound email, reply threading, outbound delivery, delivery status, deduplication, agent visibility, configuration/docs.

Excluded: assignment routing, business-hours SLA calendars, macros, CSAT, analytics, knowledge base, chat, telephony, and attachment binary storage.

## Verification

Unit tests cover email normalization, HTML fallback, ticket-key extraction, webhook signature validation/tamper rejection, receiving API calls, outbound idempotency/thread headers, inbound orchestration, delivery event mapping, and outbound persistence. GitHub CI runs the complete project test suite and Next.js production build.
