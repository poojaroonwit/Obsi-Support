# Business-Hours SLA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-configurable business-hours SLA calendars and priority targets while preserving the existing 24×7 default.

**Architecture:** A pure calendar module calculates business-minute deadlines from an IANA timezone, weekly schedule, and holidays. A tenant policy repository persists the configuration, while a small SLA service reapplies deadlines at new-ticket and reprioritization boundaries instead of rewriting the existing large ticket repository.

**Tech Stack:** Next.js 15 Pages Router, Node.js 22 `Intl`, PostgreSQL/pg, React 18, node:test.

**Spec:** `docs/superpowers/specs/2026-08-28-business-hours-sla-design.md`

## Global Constraints

- No policy row means current 24×7 behavior.
- Missing policy table must not block ticket intake.
- Business-hours policies use valid IANA timezones and non-overlapping weekly windows.
- Holidays use workspace-local `YYYY-MM-DD` dates.
- Existing ticket deadlines are not silently rewritten when policy settings change.
- New tickets and reprioritized tickets use the current policy.

---

### Task 1: Calendar engine

**Files:**
- Create: `lib/business-hours.js`
- Modify: `lib/sla.js`
- Test: `tests/business-hours.test.js`

- [x] Write failing tests for timezone validation, windows, weekends, holidays, business-time targets, and 24×7 fallback.
- [x] Verify missing-module failure.
- [x] Implement the minute-accurate calendar engine.
- [x] Verify 7/7 calendar tests pass locally.

### Task 2: Policy persistence

**Files:**
- Modify: `db/schema.sql`
- Create: `lib/sla-repository.js`
- Create: `lib/sla-service.js`

- [x] Add one organization-scoped `support_sla_policies` row.
- [x] Validate policies before persistence.
- [x] Treat missing table as no custom policy.
- [x] Add reset/delete behavior.

### Task 3: Ticket lifecycle integration

**Files:**
- Modify: `pages/api/tickets/index.js`
- Modify: `pages/api/public/tickets.js`
- Modify: `pages/api/webhooks/resend.js`
- Modify: `pages/api/tickets/[id]/index.js`

- [x] Recalculate SLA after new manual/API tickets.
- [x] Recalculate SLA after new public tickets.
- [x] Recalculate only newly created inbound-email tickets.
- [x] Recalculate after priority changes.
- [x] Keep ticket intake successful when SLA recalculation fails.

### Task 4: SLA API and workspace

**Files:**
- Create: `pages/api/sla/policy.js`
- Create: `pages/sla.js`
- Create: `styles/sla.css`
- Modify: `components/AppShell.js`
- Modify: `pages/_app.js`

- [x] Add GET/PUT/DELETE policy API.
- [x] Add business-time toggle, timezone, weekly hours, holidays, and priority targets.
- [x] Add reset-to-platform-default action.
- [x] Add SLA sidebar navigation.

### Task 5: Documentation and verification

**Files:**
- Modify: `README.md`

- [ ] Document policy behavior, migration, and forward-only deadline semantics.
- [ ] Open PR and run complete `npm test` and `npm run build` CI.
- [ ] Review final diff for tenant leaks, compatibility, and ticket-intake regressions.
