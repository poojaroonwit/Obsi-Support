# Email Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure email-to-ticket ingestion and outbound customer email replies to Obsi Support.

**Architecture:** Keep normalization/threading rules provider-neutral and isolate Resend behind a transport adapter. Persist inbound/outbound provider identity and delivery state in the existing tenant-scoped PostgreSQL repository, and expose the transport only through a verified webhook and the existing agent reply API.

**Tech Stack:** Next.js 15 Pages Router, Node.js 22, PostgreSQL/pg, Resend REST API, Svix-compatible webhook signatures, node:test.

**Spec:** `docs/superpowers/specs/2026-08-27-email-support-design.md`

## Global Constraints

- Existing portal request/reply behavior must continue when email transport is not configured.
- Inbound threading must never cross an organization boundary.
- Ticket-key threading must also require the same requester email.
- Outbound email acceptance, not message composition, marks first-response SLA completion.
- Email provider/message IDs must be deduplicated.
- Failed outbound messages remain stored and visible to agents.
- Do not add a provider SDK dependency for the first Resend adapter.

---

### Task 1: Provider-neutral email rules

**Files:**
- Create: `lib/email-domain.js`
- Test: `tests/email.test.js`

**Interfaces:**
- Produces: `normalizeInboundEmail`, `extractTicketKey`, `buildReplySubject`, `buildThreadHeaders`, `parseMailbox`.

- [x] Write failing normalization/threading tests.
- [x] Run `node --test tests/email.test.js` and confirm missing email-domain module failure.
- [x] Implement minimal normalization/thread helpers.
- [x] Run tests and confirm normalization/threading cases pass.

### Task 2: Resend transport and webhook verification

**Files:**
- Create: `lib/email/resend.js`
- Test: `tests/email.test.js`

**Interfaces:**
- Produces: `verifySvixSignature`, `retrieveReceivedEmail`, `sendEmail`.

- [x] Add failing tests for signature verification, inbound retrieval, outbound headers, and idempotency.
- [x] Implement raw-body signature verification and direct Resend REST calls.
- [x] Run email tests and confirm transport cases pass.

### Task 3: Email orchestration

**Files:**
- Create: `lib/email-service.js`
- Test: `tests/email.test.js`

**Interfaces:**
- Consumes: repository methods and Resend transport.
- Produces: `createEmailService`, `deliveryStatusForEvent`.

- [x] Add failing tests for inbound orchestration, delivery webhooks, and agent delivery persistence.
- [x] Implement inbound and outbound orchestration.
- [x] Run email tests and confirm all orchestration cases pass.

### Task 4: Persistence, tenant-safe threading, and SLA accounting

**Files:**
- Modify: `db/schema.sql`
- Modify: `lib/repository.js`

**Interfaces:**
- Produces: `resolveOrganizationForInbound`, `ingestInboundEmail`, `updateMessageDelivery`, `updateEmailDelivery`.

- [x] Add support-email, provider/message ID, channel, delivery status/error, and attachment metadata columns/indexes.
- [x] Implement organization resolution from inbound recipient.
- [x] Deduplicate inbound provider/message IDs.
- [x] Thread by Message-ID first and ticket key second, requiring the same requester email.
- [x] Delay first-response SLA completion until email send acceptance.

### Task 5: Live APIs and agent delivery state

**Files:**
- Create: `pages/api/webhooks/resend.js`
- Modify: `pages/api/tickets/[id]/messages.js`
- Modify: `components/TicketDetail.js`

**Interfaces:**
- Webhook: `POST /api/webhooks/resend`
- Agent reply: existing `POST /api/tickets/:id/messages`

- [x] Verify webhook signature from raw body before parsing JSON.
- [x] Route received/delivery events through the email service.
- [x] Send customer-visible agent replies by email when configured.
- [x] Keep internal notes local and preserve portal-only fallback.
- [x] Show email delivery state and failed-send errors in the conversation.

### Task 6: Configuration, documentation, and verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Create: `docs/superpowers/specs/2026-08-27-email-support-design.md`

- [x] Document Resend API/webhook/domain configuration.
- [x] Document security, fallback, and migration behavior.
- [ ] Run the complete branch test suite.
- [ ] Run the Next.js production build in CI.
- [ ] Review the final branch diff before integration.
