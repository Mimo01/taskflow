---
phase: 94-release-detail-redesign-nicer-professional-page-with-more-re
plan: 08
subsystem: release-detail
tags: [visual-verification, uat, polish, recharts, webkit]
requires: [94-07]
provides:
  - user-approved release detail page (12 polish rounds against real-app screenshots)
  - compact one-row graph band (AIO cycle page sizing) with 2x2 / 1-col fallbacks
  - By status graph, release timeline, GitLab-style MR label pills, mismatch action band
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/MrLabels.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/labelColor.ts
  modified:
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseFacts.tsx
    - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTypeWaffle.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/GraphSlot.tsx
    - taskflow/src/routes/dashboard/release-detail/releaseBuckets.ts
    - taskflow/src/services/jira.ts
  deleted:
    - taskflow/src/routes/dashboard/release-detail/LabelSummarySection.tsx
metrics:
  tasks: 2
  completed: 2026-10-30
  commits: 17
---

# Phase 94 Plan 08: Visual verification Summary

Task 1 rendered the page through the React Compiler in a scratchpad vite harness (placeholder data only, nothing committed) and screenshotted every state at 1600/1280/979/639/439 with cached Chromium plus a Swift WKWebView probe. Task 2, the user check in the Tauri app, turned into 12 polish rounds driven by real-app screenshots. The user approved after round 12.

## Commits
- d19121b2, 71dd5e0a: first-pass defects (double "Refreshed:", meta line break, burnup marker labels, done-bar weight, perpetual "MR labels: Loading…")
- 511630a1, dcc05438: empty and sparse states. One "no issues yet" empty state; By status graph replaces the MR donut when there is no milestone or no MRs; release timeline replaces a burnup with < 2 points; no dashed boxes
- 1e97bda8, 6a941d20, 7996d142: header iterations ending on the V1 icon property row (user picked V1 from three rendered variants)
- da2941d0: one square per issue in By type (wrapping, no aggregation); burnup end labels on solid backgrounds, merged "N scope · done" label when equal
- 76bd5112: one-row compact graph band on wide containers, sized like the AIO cycle stats block; 2x2 and single-column fallbacks
- 2d00ec7e, f8897100, 8ea4974d, b88b57cd: Deployment package mismatches as a full-width action table (header row; key, state, assignee, reporter, summary, fix columns; one Fix cell with an "Apply ▾" menu for two-fix rows); By status bars scaled to the share of all issues; pointer cursors page-wide
- cd00fbd0: refinement pass (one section-heading level, even rhythm, band column balance, amber "needs attention" band for mismatches)
- 2bf4e6b7, f39eded3, 3fd603de: MR labels as stacked GitLab-colour pills inside the MR cell, on the status-pill geometry. Text shade solved for 4.5:1 per theme, count in its own segment, rows aligned with the state legend

## Decisions (user)
- Header: V1 icon property row, no uppercase labels, milestone description folded into the description block
- Graph band: compact like the AIO cycle detail page; lists cap with "+K more" tooltips, no inner scroll
- By type: never group issues, wrap the squares instead
- MR labels: not a legend and not a separate row. GitLab-style squarish pills next to the MR legend, with the unlabelled count
- Mismatches: full-width table that stands out (tint, accent bar, warning-tone Apply), with assignee and reporter

## Deviations
- `reporter` added additively to the `fetchFixVersionIssues` and orphan-story fetch fields (jira.ts) for the mismatch table
- `BAND_MIN_WIDTH` is 1180px (one-row band); narrower containers use the 2x2 grid
- Pointer cursor set once on the page scroll wrapper instead of on the shared `Button` (no app-wide change)
- The VALIDATION sticky, marker, React-Compiler and breakpoint checks were covered by harness and WKWebView renders, then the user's real-app check

## Post-approval narrow-width fixes (user, after phase completion)
- 07809cac, 5a68d7f9: compact graph mode in every layout (2x2 and single column too); By assignee capped at 5 in the band, 4 below it
- cfafbbd0, 86069b52: mismatch table measures its own width (@container) and shortens like the Issues table (avatars at 860, type icon 640, fix text 600, state icon 520); Summary and Fix split leftover width 2:1 (Fix 7rem-280px)
- cfc48ea1, 635d7cac: short "Asg." / "Rep." headers over avatar-only person columns (mismatch + Issues tables); Reporter stays as an avatar instead of hiding
- fa540af8: same "Asg." treatment on the AIO Defects, Executions and run-defects lists (UserChip `nameClassName`)

User approved the result 2026-10-30.

## Self-Check: PASSED
Full suite 4111 passed (hooks on every commit). tsc clean. No harness files or user screenshots in the repo.
