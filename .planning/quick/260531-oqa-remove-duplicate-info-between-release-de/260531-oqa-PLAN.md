---
quick_id: 260531-oqa
description: Remove duplicate info between release detail main content and sidebar
date: 2026-05-31
status: complete
---

# Quick Task 260531-oqa: De-duplicate Release Detail page

## Problem

`ReleaseDetailPage.tsx` renders the same fields in both the left main content
and the right "Details" sidebar. Duplicated fields identified:

| Field | Main content | Sidebar |
|-------|-------------|---------|
| Status badge | yes | yes |
| Release Date | yes | yes |
| Description | yes | yes |
| Issues count (`X / Y done`) | yes (badge + progress bar + table) | yes (MetaRow) |

Non-duplicates (left untouched): main "Labels" (label summary counts) vs sidebar
"MR Labels" (coverage check) show different data; main GitLab milestone *warning*
(only when no match) vs sidebar "GitLab Milestone" row are complementary.

## Decisions

- Status → keep in **sidebar** only (remove from main content).
- Release Date → keep in **sidebar** only (remove from main content).
- Description → keep in **main content** only (remove from sidebar).
- Issues count → keep in **main content** only (rich: badge + progress bar +
  issues table); remove the redundant sidebar "Issues" MetaRow.
  (User-confirmed: the extra duplicate beyond the three originally named.)

## Tasks

1. **Edit `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`**
   - Remove the main-content "Status badge" block (Status badge + Release Date).
   - Remove the sidebar "Description" MetaRow.
   - Remove the sidebar "Issues" MetaRow.
   - verify: `npm run check` clean; `Calendar`/`FileText` imports still used.
   - done: each duplicated field renders in exactly one location.
