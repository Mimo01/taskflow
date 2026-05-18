---
status: complete
quick_id: 260518-v8c
slug: in-backlog-view-switch-summary-and-epic-
description: In backlog view switch summary and epic columns. And make the epics aligned to right
date: 2026-05-18
commit: 21b174bd
---

# Quick Task 260518-v8c: Switch Summary/Epic columns in backlog; right-align Epic

**Status:** Complete
**Commit:** 21b174bd
**Date:** 2026-05-18

## What Changed

- `taskflow/src/routes/dashboard/BacklogPage.tsx` — Moved Summary `<th>` before Epic `<th>` in `<thead>`; changed Epic header from `text-left` to `text-right`
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — Moved Summary `<td>` before Epic `<td>` in `RowCells`; added `text-right` to Epic `<td>` so the badge aligns flush right

## Result

Column order is now: **Key | Summary | Epic | Points | Assignee**. The Epic header label and badge are right-aligned. All 16 existing tests pass. Visually verified by user.
