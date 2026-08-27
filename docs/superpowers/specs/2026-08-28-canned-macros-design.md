# Obsi Support Canned Replies & Macros Design

## Goal

Add reusable reply templates with safe ticket-action suggestions to Obsi Support without auto-sending customer communication or silently changing ticket state.

## Architecture

Each organization owns a set of macros. A macro contains a name, optional shortcut, reply body, active flag, and optional actions for status, priority, team, and assignee. Macro rendering is provider-neutral and supports a small allowlisted variable set. The ticket composer requests a prepared macro from the server, inserts the rendered body, and stages validated actions for explicit application.

## Variables

Supported variables:

- `{{requester.name}}`
- `{{requester.email}}`
- `{{ticket.key}}`
- `{{ticket.subject}}`
- `{{agent.name}}`
- `{{agent.email}}`

Unknown variables are rejected when saving a macro rather than being silently preserved.

## Action safety

Macro actions may contain:

- `status`: new/open/pending/resolved/closed
- `priority`: low/normal/high/urgent
- `teamId`
- `assigneeMemberId`

A member action requires a team action. Team/member validity is checked against the current organization when the macro is prepared/applied. Selecting a macro never sends a reply and never changes ticket state. The agent may edit the rendered reply before sending and must explicitly apply staged actions.

## Data model

`support_macros` stores one tenant-scoped row per macro with name, shortcut, body, actions JSON, active flag, timestamps, and a unique shortcut per organization when present.

## UX

The sidebar gains **Macros**. The management page supports create/edit/deactivate/delete, body variables, shortcut, and optional action configuration. In Ticket Detail the composer gains a macro picker; choosing one inserts the rendered reply and displays staged action chips with Apply/Clear controls.

## Reliability

- Every read/write is scoped by `organization_id`.
- Macro preparation checks that the ticket also belongs to the same organization.
- Unknown variables and unsupported actions are rejected.
- Missing macro migration does not break ordinary replies; macro UI/API may report migration needed.
- Existing email delivery, routing, SLA, and manual ticket controls remain unchanged.

## Scope

Included: canned replies, variables, status/priority/team/assignee action suggestions, management page, composer insertion, explicit action application.

Excluded: auto-send, event-triggered macros, bulk macros, analytics, permissions beyond the existing authenticated agent boundary, and CSAT.
