# Obsi Support Assignment Groups & Routing Design

## Goal

Add tenant-scoped support teams, agent capacities, routing rules, automatic assignment, and manual reassignment to Obsi Support.

## Architecture

Routing rules stay provider-neutral and deterministic. A rule matches ticket attributes (channel and priority), selects a support team, then the routing engine chooses an eligible active member using least-load ratio (`open assigned tickets / capacity`) with stable tie-breaking. PostgreSQL remains the source of truth for teams, members, rules, ticket team/assignee state, and assignment events.

Automatic routing runs when a new ticket is created from portal/API/email. Existing threaded replies keep their current team and assignee. Manual ticket updates may change team or assignee, but assignees must be active members of the selected team unless the ticket is explicitly left unassigned.

## Data model

- `support_teams`: organization-scoped team name/key, active flag, default capacity.
- `support_team_members`: organization/team, Outborn user id when known, name/email, capacity, active flag.
- `support_routing_rules`: organization-scoped priority order, enabled flag, conditions JSON, destination team, strategy.
- `support_tickets`: `team_id` and `team_name` in addition to existing assignee fields.
- `support_assignment_events`: audit trail for automatic/manual team and agent changes.

## Routing rules

First enabled rule by ascending `sort_order` wins. Conditions in this slice are intentionally limited to:

- `channels`: one or more of portal/email/chat/api/manual
- `priorities`: low/normal/high/urgent

An empty condition means match all. Unknown condition keys are rejected at write time rather than silently ignored.

## Assignment strategy

The initial strategy is `least_load`:

1. Ignore inactive members and members with capacity <= 0.
2. Count each member's tickets in `new`, `open`, or `pending` inside the same organization.
3. Compute `load / capacity`.
4. Pick the lowest ratio, then lower raw load, then stable member id.
5. If no member is eligible, assign the team but leave the ticket unassigned.

This is deterministic, capacity-aware, and easy to reason about. Round-robin can be added later without changing the team/rule model.

## UX

- Add `Routing` to the sidebar.
- `/routing` manages teams, members, capacities, and ordered rules.
- Inbox adds Team and Assignee filters.
- Ticket properties show Team and Assignee selectors.
- Automatic assignment is visible as a system audit event.

## Security

Every team/member/rule query is organization-scoped. Team/member IDs supplied by the client are validated against the current organization. Manual assignment cannot cross tenants or assign an inactive/non-member user.

## Scope

Included: teams, members, capacities, rule matching, auto-routing, manual assignment, inbox filters, routing management UI, audit events.

Excluded: skills-based routing, shifts/availability calendars, round-robin cursor state, business-hours SLA, macros, CSAT, analytics.

## Verification

Unit tests cover rule normalization/matching, deterministic least-load selection, capacity behavior, and invalid conditions. GitHub CI runs the complete test suite and Next.js production build.