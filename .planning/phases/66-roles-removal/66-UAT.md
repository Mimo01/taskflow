---
status: partial
phase: 66-roles-removal
source: 66-01-SUMMARY.md, 66-02-SUMMARY.md
started: 2026-05-24T00:00:00Z
updated: 2026-05-24T00:00:00Z
---

## Current Test

[testing paused — 1 item outstanding (skipped without reason)]

## Tests

### 1. Settings — No Preset Buttons
expected: Open Settings → Sidebar Items or Appearance section. No "Dev Preset", "PM Preset", or any role-based preset buttons anywhere on the page. The sidebar items list is still there; only the preset buttons are removed.
result: pass

### 2. Onboarding Wizard — 4 Steps, No Role Step
expected: Trigger the onboarding wizard (e.g., reset it or open the onboarding route). The wizard shows exactly 4 steps: Welcome → Jira → GitLab → Done. There is no "Select your role" or "Role" step anywhere in the flow.
result: skipped

### 3. Sidebar — All Items Visible
expected: All sidebar navigation items are visible (no items hidden due to a role). If coming from an older version with a role set, the migration should have reset everything to all-visible. A fresh install also shows all items visible by default.
result: pass

## Summary

total: 3
passed: 2
issues: 0
pending: 0
skipped: 1
skipped: 0
blocked: 0

## Gaps

[none yet]
