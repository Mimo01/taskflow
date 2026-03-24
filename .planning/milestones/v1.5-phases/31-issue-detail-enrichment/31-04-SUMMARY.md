---
phase: 31-issue-detail-enrichment
plan: 04
subsystem: ui
tags: [verification, uat]

requires:
  - phase: 31-01
    provides: changelog/watcher service layer
  - phase: 31-02
    provides: OverdueBadge, Clone button
  - phase: 31-03
    provides: ActivityTimeline, WatcherToggle, filter chips
provides:
  - User-verified Phase 31 features working end-to-end
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/issue-detail/WatcherToggle.tsx
    - taskflow/src/routes/dashboard/issue-detail/TimelineFilterChips.tsx
    - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
    - taskflow/src/routes/dashboard/issue-detail/ChangelogEntry.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts

key-decisions:
  - "Remove All tab from timeline filters — only Comments and Changes"
  - "Comments tab is default (first opened), CommentComposer only visible in Comments tab"
  - "Clone prefills issue links from source issue"

patterns-established: []
---

## What happened

Visual and functional UAT of all Phase 31 features. User tested on a live issue detail page and reported 5 issues, all fixed inline:

1. **Watcher tooltip** — Added title attribute explaining what the toggle does
2. **Removed "All" filter tab** — Only Comments and Changes tabs remain
3. **Comments as default tab** — Comments tab opens first; CommentComposer only shows in Comments view
4. **Clone button style** — Changed to outline variant to match other action bar buttons
5. **Clone prefills issue links** — Maps existing issuelinks to form linkRows
6. **Timestamp tooltips** — Hover on any relative timestamp shows exact date/time

## Self-Check: PASSED

All 7 DETAIL requirements verified by user. No regressions reported.
