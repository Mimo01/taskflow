---
status: partial
phase: 75-progressive-issue-detail-rendering
source: [75-VERIFICATION.md]
started: "2026-05-31T00:00:00Z"
updated: "2026-05-31T00:00:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Per-section error isolation + retry (live force-test)
expected: Block a single section's request in DevTools (e.g. the `/comment` endpoint). That
section shows an inline "Couldn't load comments" + Retry, while the header, changelog/activity,
subtasks, and worklogs stay fully functional. Retry refetches only the failed section. (D-07,
PERF-DETAIL-02.) Code is wired (WR-04 fix makes comment/changelog errors sibling banners, not a
parent gate) and covered by automated per-section `ErrorState` tests; this is the live composite check.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
