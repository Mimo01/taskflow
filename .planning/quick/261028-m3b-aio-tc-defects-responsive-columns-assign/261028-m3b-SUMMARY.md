---
status: complete
---
# Quick 261028-m3b Summary

File: `taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx` (+ AioCycleDetailPage caller/test).

- Columns (left→right): key, title, priority, severity, status, assignee, reporter.
- Priority = icon only and assignee = avatar only (short "Pri"/"Asg" headers) at narrowest; priority name from 640px, severity 760px, assignee name 880px, reporter 1000px (container queries).
- Triggered By column, TriggerChips and the `onOpenRun` prop removed; two tests covering it deleted.
- Status w-28, priority w-24 (wide), severity w-20 to remove unused right-side space.
- Approved by user; full suite, biome, tsc green. Commits: 924e7027 … e00861ee.
