# Obsi Support Business-Hours SLA Design

## Goal

Make SLA deadlines follow a tenant-configurable business calendar without breaking the current 24×7 behavior.

## Architecture

One `support_sla_policies` row belongs to each organization. The policy contains an IANA timezone, weekly working windows, holiday dates, and per-priority first-response/resolution targets. The pure calendar engine converts those rules into UTC deadlines; existing SLA evaluation continues comparing completion timestamps to stored UTC deadlines.

No custom policy means the existing `DEFAULT_SLA_POLICY` remains 24×7. A saved policy with `enabled=false` uses custom priority targets in elapsed-clock time. A saved policy with `enabled=true` counts only business minutes.

## Data flow

1. New portal/API tickets are created using the existing repository transaction.
2. `recalculateTicketSla` loads the tenant SLA policy after creation. If no policy table/row exists, it returns without changing the legacy deadlines.
3. When a business-hours policy exists, first-response and resolution deadlines are recalculated from ticket creation time and stored as UTC timestamps.
4. New inbound-email tickets run the same recalculation before automatic routing. Threaded replies do not change deadlines.
5. Priority changes recalculate deadlines from the original creation timestamp using the current workspace policy.
6. Saving or deleting a workspace policy does not silently rewrite historical ticket deadlines. It affects new tickets and future reprioritization.

## Calendar rules

- Timezone must be a valid IANA timezone.
- Weekly schedules may contain multiple non-overlapping windows per day; the first UI supports one window per day.
- Window end is exclusive.
- Holidays are local `YYYY-MM-DD` dates in the configured timezone.
- Resolution target must be at least the first-response target.
- A business-hours-enabled policy requires at least one working window.
- Deadline calculation preserves minute accuracy across weekends, holidays, and timezone offsets.

## Security and reliability

- Every policy read/write is organization-scoped through the authenticated agent session.
- A missing `support_sla_policies` table is treated as no custom policy so rollout does not block ticket intake before migration.
- SLA recalculation errors at ticket intake are logged but do not reject ticket creation.
- Policy validation happens before persistence.

## User experience

The sidebar gains an SLA workspace with:

- Business-time vs 24×7 toggle
- IANA timezone
- Mon–Sun working hours
- Holiday dates
- Priority first-response and resolution targets
- Reset to platform default

The page explicitly states that changes apply to new/reprioritized tickets, not existing deadlines.

## Verification

Unit tests cover timezone validation, overlapping windows, local business-minute detection, weekend carry-over, holidays, business-time targets, and 24×7 backward compatibility. PR CI runs the complete `npm test` suite and production `npm run build`.
