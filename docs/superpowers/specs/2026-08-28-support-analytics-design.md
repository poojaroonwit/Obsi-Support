# Obsi Support Analytics Design

## Goal
Provide a tenant-scoped operational dashboard over the existing support data without creating a second analytics data store.

## Metrics
For 7, 30 or 90-day windows: tickets created/resolved, first-response SLA attainment, resolution SLA attainment, median first response, median resolution, CSAT average/response count/satisfied percentage, and daily created/resolved trend. Status/channel/priority distributions use tickets created in the selected window. Team and agent views show current active backlog.

## Architecture
`analytics-repository` runs organization-filtered aggregate queries against existing ticket and CSAT tables and uses small pure helpers for window normalization, percentage/median math and gap-free daily trends. Analytics is read-only; no new schema is required. Missing CSAT migration is treated as zero CSAT data.

## UX
The Analytics workspace provides 7d/30d/90d switching, KPI cards, a simple ticket-flow bar chart, operational breakdowns and workload lists without adding a charting dependency.

## Verification
Domain tests cover supported windows, percentage math, median math and zero-filled daily trends. Full CI verifies all repository tests and the production build.
