---
phase: quick-260523-d8n
plan: 01
subsystem: dashboard
tags: [dashboard, greeting, on-prem, jira-display-name, bug-fix, tests]
dependency-graph:
  requires: []
  provides:
    - "Robust first-name extraction for on-prem Jira displayName formats"
  affects:
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/routes/dashboard/index.test.tsx
tech-stack:
  added: []
  patterns:
    - "Token filter chain: strip [bracketed] + (parenthesized) tokens, prefer first mixed-case token over ALL-CAPS"
key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/routes/dashboard/index.test.tsx
decisions:
  - "Mixed-case heuristic — Jira on-prem instances sometimes format displayName as 'SURNAME Firstname OrgCode (status)' (e.g. 'DOE Jane ACME (ext.)'). Strategy: filter out [..] and (..) tokens, then prefer the first token that is NOT all-uppercase as the given name. Falls back to tokens[0] if all are uppercase, preserving existing behavior for standard 'Firstname Surname' format."
metrics:
  duration: "~5 minutes"
  completed: "2026-05-23"
requirements:
  - QUICK-260523-D8N
---

# Quick Task 260523-d8n: Dashboard Greeting — On-Prem Username Format

Fixed the dashboard hero greeting so it shows the user's given name when Jira on-prem returns displayName in `SURNAME Firstname OrgCode (status)` format (e.g. `DOE Jane ACME (ext.)` → `Jane`), instead of shouting `DOE`.

## What Changed

**`taskflow/src/routes/dashboard/index.tsx`** (lines 48–61, ~13 lines)

Token-filter chain extended:

1. Strip `[bracketed]` tokens (`[Disabled]` etc.) — existing behavior
2. Strip `(parenthesized)` tokens (`(ext.)` etc.) — new
3. Prefer first **mixed-case** token (not all-uppercase) as `firstName` — new
4. Fall back to `tokens[0]` if every remaining token is all-caps — preserves prior behavior for unusual edge cases

**`taskflow/src/routes/dashboard/index.test.tsx`** (+25 lines, 2 new tests)

- `Test 9`: reproduces the live auth.json value `DOE Jane ACME (ext.)` — asserts greeting renders `Jane`, never `DOE`
- `Test 10`: `Bob Smith [Disabled]` — asserts `Bob` rendered, `[Disabled]` not visible (regression guard for prior bracket-strip behavior)

## Why

User reported that the dashboard greeting was reading `Welcome back, DOE` on their on-prem instance. The on-prem Jira displayName format includes ALL-CAPS surname first, then mixed-case given name, then an org code, then a parenthesized status. The previous extraction logic (`tokens[0]`) picked up the surname.

## Verification

- 2 new tests added, both pass (`npm run test -- dashboard/index.test.tsx`)
- Existing 7 tests still pass (Tests 1–7 covering DASH-01/05) — no regression
- `firstName` is `null` when displayName is null (existing fallback to `'there'`)
