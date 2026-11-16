---
status: passed
phase: 95-notifications-redesign-research-driven-visual-redesign-polis
source: [95-VERIFICATION.md]
started: 2026-11-11T00:00:00Z
updated: 2026-11-11T12:00:00Z
---

## Current Test

[complete]

## Tests

### 1. Real actor avatar images render in notification cards (Tauri app)
expected: Cards show the actor's real Jira/GitLab profile photo as a round 36px avatar (32 compact / 40 comfortable) with the coloured action badge on its corner; no oval/egg shape; initials only when no photo exists. The preview harness stubbed avatar images, so this was never seen with real images.
result: passed — real avatars render round with badge (user, 2026-11-11); card surface aligned with app Card (4afbeb19)

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
