# Assignment Groups & Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-scoped support teams, capacity-aware routing rules, automatic assignment, and manual team/assignee controls to Obsi Support.

**Architecture:** Pure routing rules determine a destination team and least-load member; PostgreSQL stores teams, memberships, rules, ticket team state, and assignment audit events. Existing ticket creation paths call one repository routing function after insert, while threaded replies keep their assignment.

**Tech Stack:** Next.js 15 Pages Router, Node.js 22, PostgreSQL/pg, React 18, node:test.

**Spec:** `docs/superpowers/specs/2026-08-28-assignment-routing-design.md`

## Global Constraints

- Every routing/team/member/rule read and write is organization-scoped.
- Rule conditions are limited to channels and priorities in this slice.
- Automatic strategy is `least_load` only.
- Inactive members or capacity <= 0 are never selected automatically.
- Existing ticket threads keep assignment; only newly created tickets auto-route.
- Manual assignment cannot select a member outside the selected team.
- Existing email, portal, SLA, and authentication flows must remain unchanged.

---

### Task 1: Routing domain

**Files:**
- Create: `lib/routing-domain.js`
- Test: `tests/routing.test.js`

**Interfaces:**
- Produces: `normalizeRoutingConditions`, `ruleMatchesTicket`, `selectRoutingRule`, `chooseLeastLoadMember`, `normalizeCapacity`.

- [ ] Write failing tests for rule normalization, matching, first-rule selection, capacity exclusion, deterministic least-load choice, and invalid condition keys.
- [ ] Run `node --test tests/routing.test.js` and confirm the missing module is the failure reason.
- [ ] Implement the minimal routing-domain functions.
- [ ] Run the routing tests and confirm all pass.

### Task 2: Persistence and assignment audit

**Files:**
- Modify: `db/schema.sql`
- Modify: `lib/repository.js`

**Interfaces:**
- Produces: `listTeams`, `createTeam`, `updateTeam`, `addTeamMember`, `updateTeamMember`, `listRoutingRules`, `createRoutingRule`, `updateRoutingRule`, `routeTicket`, `manualAssignTicket`, `getRoutingSnapshot`.

- [ ] Add team/member/rule/event tables and ticket team columns with idempotent migrations.
- [ ] Add organization-scoped repository CRUD and validation.
- [ ] Compute active ticket loads and apply least-load routing transactionally.
- [ ] Record automatic/manual assignment events and add a system conversation message.

### Task 3: Auto-route new tickets

**Files:**
- Modify: `lib/repository.js`

**Interfaces:**
- Consumes: `routeTicket`.

- [ ] Call routing after `createTicket` persists a new ticket.
- [ ] Call routing only when `ingestInboundEmail` creates a new ticket, not on threaded replies.
- [ ] Return routed ticket state through existing APIs.

### Task 4: Routing APIs

**Files:**
- Create: `pages/api/routing/teams.js`
- Create: `pages/api/routing/teams/[id].js`
- Create: `pages/api/routing/teams/[id]/members.js`
- Create: `pages/api/routing/members/[id].js`
- Create: `pages/api/routing/rules.js`
- Create: `pages/api/routing/rules/[id].js`
- Create: `pages/api/routing/snapshot.js`
- Modify: `pages/api/tickets/[id]/index.js`

**Interfaces:**
- All routes require the existing agent session.
- Ticket PATCH accepts `teamId` and `assigneeMemberId` for validated manual assignment.

- [ ] Implement tenant-scoped CRUD with validation and 404/400 behavior.
- [ ] Expose team/member/load/rule snapshot for the UI.
- [ ] Route manual ticket changes through repository validation rather than raw assignee strings.

### Task 5: Routing management UI

**Files:**
- Create: `pages/routing.js`
- Modify: `components/AppShell.js`
- Modify: `styles/globals.css`

**Interfaces:**
- Uses routing APIs from Task 4.

- [ ] Add Routing navigation.
- [ ] Build team cards with member/capacity management.
- [ ] Build ordered routing-rule editor for channel/priority → team.
- [ ] Show active load/capacity per member and empty/error states.

### Task 6: Inbox and ticket assignment UX

**Files:**
- Modify: `pages/inbox.js`
- Modify: `components/TicketDetail.js`
- Modify: `components/TicketList.js`
- Modify: `styles/globals.css`

**Interfaces:**
- Inbox receives routing snapshot server-side and through refresh APIs.
- Ticket properties use `teamId` and `assigneeMemberId`.

- [ ] Add Team and Assignee filters to the inbox.
- [ ] Show team and assignee in ticket rows where useful.
- [ ] Add Team/Assignee selectors in ticket properties with only valid members.
- [ ] Refresh ticket/list/routing state after reassignment.

### Task 7: Documentation and verification

**Files:**
- Modify: `README.md`

- [ ] Document routing behavior and migration requirement.
- [ ] Run routing tests.
- [ ] Open a PR so GitHub CI runs the full `npm test` and `npm run build` gate.
- [ ] Review the complete PR diff for tenant leaks and invalid assignment paths.