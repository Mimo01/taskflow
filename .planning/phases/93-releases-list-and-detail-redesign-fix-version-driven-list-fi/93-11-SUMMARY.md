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

Round 1 follow-up (2026-10-30), user feedback verbatim:

> clicking on stuff like progress bar, release management opens its tooltip, it doesnt take me to the release detail

Fixed inline. The bar and package tooltip triggers sit above the row's overlay button. They now take an `onClick` that opens the release, in both rows and the next-release card. The card's package/team row and bar wrapper are now `pointer-events-none`, so clicks on them fall through to the card button.

Round 1 follow-up 2 (2026-10-30), user feedback verbatim:

> released do not have cursor pointer
> remove release management tooltip, it doesnt really show any new info.
> is the progress info tooltip also necessary?

Fixed inline:
- Released rows and "Show older releases" now have `cursor-pointer`.
- `ReleasePackageCell` is plain text with no tooltip, on the list and on the detail header, and its `onClick` prop is gone.
- The progress tooltip question is open with the user.

Round 1 follow-up 3 (2026-10-30), user feedback verbatim:

> under the title there is only X planned most of the time. it fells plain

Decisions (asked):
- Hero line → "Release cadence".
- Progress tooltip → "Remove it".

Fixed inline:
- `releaseSummary` now also returns `cadenceDays` and `lastShippedDays`.
  - `cadenceDays` is the median gap between the 9 most recent distinct ship dates, counting only dates up to today.
  - `lastShippedDays` is the number of days since the last ship date.
- The hero appends "ships every ~N days/weeks" and "last shipped today / yesterday / N days ago".
- The progress bar is a plain `role="img"` bar with no tooltip, so the click forwarding from follow-up 1 is gone.

Round 1 follow-up 4 (2026-10-30), user feedback verbatim:

> better but make the header nicer.
> also separate it better, there is just a lot of white space between them. See how we do it on other pages

Fixed inline:
- The hero now follows the dashboard hero: full-bleed, with ambient curves edge to edge, a centered `text-5xl` title and the summary centered beneath it. Updated/Refresh sit in the top-right corner.
- It ends in `border-b border-border`, the same separator the other pages' header bars use (e.g. AIO "Test cycles").
- Content sits in its own `px-6` wrapper.
- The gap from the border to the first row dropped from about 52px to 20px (`mt-5`).

Round 1 follow-up 5 (2026-10-30), user feedback verbatim:

> the title should be top left. it needs to be consistent across the app

Fixed inline:
- `ReleasesHero` is now the app's standard page header bar, the one used by Epics, Worklogs and Test cycles: `flex items-center justify-between border-b border-border px-6 py-4`.
  - The title is left-aligned, `text-xl font-semibold`.
  - The summary sits under the title (as on My Tasks).
  - Updated/Refresh are on the right.
- The ambient curves were dropped; only the home dashboard keeps them.

Round 1 follow-up 6 (2026-10-30), user feedback verbatim:

> make the info below reelases in title nicer

Fixed inline:
- The summary line is now a wrapping row of icon + figure stats (`releases-stat`):
  - calendar → planned;
  - alert → overdue (red);
  - calendar-x → without date (amber);
  - repeat → cadence;
  - rocket → last shipped.
- Figures are medium weight, and colour is used only for status (My Tasks convention).
- The figures are spaced apart instead of joined with " · ".

Round 1 follow-up 7 (2026-10-30), user feedback verbatim:

> make the releases title bigger, like onp age My tasks

Fixed inline: the title is now `text-3xl font-semibold`, the My Tasks / Standup size for headers that have a summary line.
