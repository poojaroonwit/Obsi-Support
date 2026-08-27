# Canned Replies & Macros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-scoped reusable reply templates with safe variable rendering and explicit ticket-action application.

**Architecture:** A pure macro domain validates templates/actions and renders allowlisted variables. PostgreSQL stores macros per organization; API routes expose CRUD and ticket-specific preparation. The composer inserts prepared text and stages actions, while the existing ticket PATCH endpoint remains the only mutation path for status/priority/team/assignee changes.

**Tech Stack:** Next.js 15 Pages Router, Node.js 22, PostgreSQL/pg, React 18, node:test.

**Spec:** `docs/superpowers/specs/2026-08-28-canned-macros-design.md`

## Global Constraints

- Selecting a macro never auto-sends or auto-mutates a ticket.
- Unknown template variables are rejected.
- Macro actions are limited to status, priority, teamId, assigneeMemberId.
- assigneeMemberId requires teamId and is validated in the current organization/team.
- Existing email, routing, SLA and reply flows remain unchanged.

---

### Task 1: Macro domain

**Files:**
- Create: `lib/macro-domain.js`
- Test: `tests/macros.test.js`

- [ ] Write failing tests for variable validation/rendering, shortcut normalization, supported actions, and member-without-team rejection.
- [ ] Run the test and verify missing-module failure.
- [ ] Implement domain functions.
- [ ] Run tests and verify green.

### Task 2: Persistence

**Files:**
- Modify: `db/schema.sql`
- Create: `lib/macro-repository.js`

- [ ] Add `support_macros` table and indexes.
- [ ] Add tenant-scoped list/get/create/update/delete functions.
- [ ] Validate macro input before persistence.

### Task 3: APIs and preparation

**Files:**
- Create: `pages/api/macros/index.js`
- Create: `pages/api/macros/[id].js`
- Create: `pages/api/tickets/[id]/macros/[macroId].js`

- [ ] Add authenticated macro CRUD.
- [ ] Add ticket-specific prepare endpoint that renders variables.
- [ ] Validate team/member actions against current routing snapshot.

### Task 4: Management UI

**Files:**
- Create: `pages/macros.js`
- Create: `styles/macros.css`
- Modify: `components/AppShell.js`
- Modify: `pages/_app.js`

- [ ] Add Macros navigation.
- [ ] Add macro create/edit/deactivate/delete UI.
- [ ] Add variable helper and optional status/priority/team/assignee action editor.

### Task 5: Composer integration

**Files:**
- Modify: `pages/inbox.js`
- Modify: `components/TicketDetail.js`

- [ ] Load active macros for the inbox.
- [ ] Add macro picker in the reply composer.
- [ ] Prepare macro server-side and insert rendered body.
- [ ] Show staged action chips with Apply and Clear.
- [ ] Apply staged actions through existing validated ticket PATCH calls only.

### Task 6: Documentation and verification

**Files:**
- Modify: `README.md`

- [ ] Document variables, action safety, and migration.
- [ ] Run macro tests.
- [ ] Open PR and run full `npm test` + `npm run build` CI.
- [ ] Review final diff for tenant leaks and accidental auto-send/state mutation.
