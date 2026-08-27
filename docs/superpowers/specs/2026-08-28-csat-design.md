# Obsi Support CSAT Design

## Goal
Collect one secure 1–5 customer-satisfaction response for each resolved support ticket without making ticket resolution depend on survey/email availability.

## Design
A tenant-scoped survey is created when a ticket first becomes resolved or closed. Public survey URLs use 256-bit random tokens with only SHA-256 hashes persisted and expire after 30 days. The existing requester portal can submit the same survey using its already-authenticated portal token. A response contains rating 1–5 and an optional 2,000-character comment and can be written only once.

If Resend outbound email is configured, first resolution sends an idempotent survey invitation. Missing migration, email configuration, or invitation failure is logged but never blocks resolving the ticket. Reopening does not delete a submitted survey.

## Verification
Domain tests cover token hashing, rating validation, comment limits, and eligible ticket statuses. Full PR CI runs all repository tests and the production build.
