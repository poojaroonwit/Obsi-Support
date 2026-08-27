# Support Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development. Steps use checkbox syntax.

**Goal:** Add the final tenant-scoped operational analytics dashboard.

**Architecture:** Query the existing ticket/routing/CSAT tables directly, calculate safe KPI values in a focused repository/domain pair, expose one authenticated overview API, and render a dependency-free dashboard.

**Tech Stack:** Next.js 15 Pages Router, Node.js 22, PostgreSQL/pg, React 18, node:test.

**Spec:** `docs/superpowers/specs/2026-08-28-support-analytics-design.md`

- [x] Add red→green analytics math/window tests.
- [x] Add tenant-scoped aggregate repository and migration-safe CSAT fallback.
- [x] Add authenticated overview API.
- [x] Add 7/30/90-day Analytics workspace and navigation.
- [x] Document roadmap completion.
- [ ] Run full repository tests/build in PR CI and merge after verification.
