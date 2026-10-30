---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 11
subsystem: releases-list
tags: [releases, f5, validation, uat, gap-closure]
requires: [93-10]
provides:
  - F5 validation map rows in 93-VALIDATION.md
  - green automated phase gate for the F5 gap closure
key-files:
  modified:
    - .planning/phases/93-releases-list-and-detail-redesign-fix-version-driven-list-fi/93-VALIDATION.md
metrics:
  completed: 2026-10-30
  tasks: "1 of 2 (Task 2 is a blocking human-verify checkpoint)"
---

# Phase 93 Plan 11: F5 gap-closure gate Summary

Automated gate for the F5 Releases page is green and the validation map now covers every F5 behaviour. Live UAT (Task 2) is pending the user's verdict.

## Task 1 results

**Suite:** `npm test` passed, 252 files passed / 1 skipped (253), 3977 tests passed / 2 skipped / 7 todo. No flaky timeouts occurred.

**`npm run check`:** exits non-zero because of pre-existing biome findings (4 errors, 42 warnings). Flagged files, by `biome check --reporter=github`:
- src-tauri/capabilities/default.json
- src/components/ui/chart.tsx
- src/lib/internalLinks.test.ts
- src/routes/dashboard/BacklogRow.tsx
- src/routes/my-tasks/MyTaskRow.tsx
- src/routes/my-tasks/MyTasksPage.test.tsx
- src/routes/my-tasks/MyTasksPage.tsx
- src/routes/standup-notes/YesterdayColumn.tsx
- src/services/jira.test.ts

The baseline listed in the plan covers chart.tsx, internalLinks.test.ts, BacklogRow.tsx, MyTaskRow.tsx and MyTasksPage.test.tsx. The baseline drifts. The four extra files (default.json, MyTasksPage.tsx, YesterdayColumn.tsx, jira.test.ts) have no commits since 2026-10-29 and are not touched by this phase's releases work. The files changed in 93-07..93-10 (ReleasesTab, ReleasesSkeleton, releases-list/*, tests) are not flagged. Gate result: no NEW files flagged by this phase.

**Grep gates:**
- a (gitlab, non-test sources): 0 for ReleasesTab.tsx, ReleasedPanel.tsx, ReleaseAgenda.tsx, ReleaseAgendaParts.tsx, ReleasesHero.tsx, ReleaseTimeline.tsx. Pass.
- b (dangerouslySetInnerHTML): no output. Pass.
- c (orange, non-test sources): no output. Pass.
- d (ReleaseListRow.tsx, columns.ts gone): ok. Pass.
- e (ReleaseTitleHeading in src; issueCounts in UnifiedTaskTable.tsx): no output. Pass.

**93-VALIDATION.md:** added 9 F5 rows (release-agenda, versionsBreakdown, useReleaseBreakdowns, release-timeline, ReleaseTimeline, ReleasesHero, ReleaseAgenda, ReleasedPanel, ReleasesTab and deploymentPackage), each green. D-03/D-04/D-05/D-08 rows annotated "superseded by sketch 002 F5 (user-approved 2026-10-29)". D-12 row no longer references the deleted ReleaseListRow.test.tsx. Added Manual-Only row "F5 visual match". `nyquist_compliant: true` and `status: green` kept.

**Screenshots (from 93-10-SUMMARY, placeholder data, not committed):**
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/d9256ea6-d42e-4ff2-835d-3507898369d4/scratchpad/ours-1100-light.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/d9256ea6-d42e-4ff2-835d-3507898369d4/scratchpad/ours-1100-dark.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/d9256ea6-d42e-4ff2-835d-3507898369d4/scratchpad/ours-640-light.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/d9256ea6-d42e-4ff2-835d-3507898369d4/scratchpad/ours-640-dark.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/d9256ea6-d42e-4ff2-835d-3507898369d4/scratchpad/sketch-1100.png

## Follow-up (not done here)

Archive `.planning/sketches/` and the sketch-findings skill when Phase 93 closes (per the WRAP-UP note).

## Deviations from Plan

None. The plan's gates were run as written.

## UAT result

Round 1 (2026-10-30): not approved. User feedback, verbatim:

> remove the timeline entirely.
> for future releases, use the expanded style (progress bar, release management, ...) if story has any tasks assigned

Fixed inline (no new plan round):
- The timeline graph was removed (`ReleaseTimeline` and `release-timeline.ts`, plus their tests).
- A planned release that has any issues now renders as a full row: full date stamp, pill, RM package line, team, and a progress bar.
- Not-started releases show a `0/N` bar instead of "N to do".
- Planned rows with no issues stay quiet.
- D-09 is relaxed for these rows only: a planned row may expand when its counts arrive.
