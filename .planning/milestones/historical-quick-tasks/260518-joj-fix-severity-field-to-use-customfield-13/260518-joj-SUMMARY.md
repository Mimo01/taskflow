---
status: complete
quick_id: 260518-joj
date: 2026-05-18
commit: 53ec526
---

# Quick Task 260518-joj: Fix severity field to use customfield_13415

## What changed

- `types.ts`: renamed `severity?` → `customfield_13415?` in `JiraIssue.fields`
- `issues.ts`: updated `fields=` query param from `severity` → `customfield_13415`
- `AioCycleDetailPage.tsx`: updated severity render path to read `fields.customfield_13415`
- `AioCycleDetailPage.test.tsx`: updated mock data keys accordingly

## Why

Severity in this Jira instance is not the standard `severity` field — it lives under `customfield_13415`.
