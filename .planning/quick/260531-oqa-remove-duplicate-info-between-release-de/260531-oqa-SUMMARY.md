---
quick_id: 260531-oqa
description: Remove duplicate info between release detail main content and sidebar
date: 2026-05-31
status: complete
---

# Quick Task 260531-oqa: Summary

## What changed

`taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — removed duplicated fields
so each piece of release metadata renders in exactly one place:

- **Removed from main content:** the "Status badge" block (Released/Unreleased
  badge + Release Date). These now live only in the sidebar "Details" panel.
- **Removed from sidebar:** the "Description" MetaRow. Description now lives only
  in the main content section.
- **Removed from sidebar:** the "Issues" MetaRow (`X / Y done`). The issues count
  remains in the main content as a badge alongside the progress bar and the full
  issues table.

## Resulting layout

- **Main content:** version id + name → Description → Labels → Issues (count
  badge + progress bar + table) → milestone warning / unmatched MRs.
- **Sidebar (Details):** Status → Release Date → GitLab Milestone → MR Labels.

## Verification

- `npm run check` (biome check + tsc --noEmit) — clean, 407 files.
- `Calendar` import still used (sidebar Release Date); `FileText` still used
  (main Description heading). No orphaned imports.

## Notes

Other near-overlaps were reviewed and intentionally kept: main "Labels" (label
summary counts) vs sidebar "MR Labels" (coverage check) display different data;
the main GitLab milestone *warning* (shown only when no milestone matches) is
complementary to the sidebar "GitLab Milestone" match row.
