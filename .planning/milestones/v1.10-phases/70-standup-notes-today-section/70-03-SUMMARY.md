---
phase: 70-standup-notes-today-section
plan: "03"
subsystem: standup-notes
tags: [today-column, wiring, log-work, mr-matching, participating-mrs, checkpoint, react]
dependency_graph:
  requires: [70-01 filterSprintItems, 70-02 TodayColumn + sections]
  provides: [StandupNotesPage Today column (live), TodayParticipatingSection, fetchParticipatedMRs, mrMatching]
  affects: []
tech_stack:
  added: []
  patterns:
    - clickable row as div role="button" + target-guarded onKeyDown (TaskCard pattern) — avoids button-in-button
    - grouped sprint rows: parent story + my nested subtasks (D-04 leaf rule replaced)
    - shared ui/Progress for logged-vs-estimate bar
    - GitLab events (action=commented) for role-independent MR participation
    - per-MR fan-out (detail + discussions + approvals) to filter participating MRs
    - linkEngine.linkMRToTask to nest MRs under their sprint story
key_files:
  created:
    - taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx
    - taskflow/src/routes/standup-notes/TodayParticipatingSection.test.tsx
    - taskflow/src/routes/standup-notes/mrMatching.ts
  modified:
    - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
    - taskflow/src/routes/standup-notes/TodayColumn.tsx
    - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
    - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
    - taskflow/src/routes/standup-notes/filterSprintItems.ts
    - taskflow/src/services/gitlab.ts
  removed:
    - taskflow/src/routes/standup-notes/TodayPinnedSection.tsx (Pinned section dropped per user)
decisions:
  - "Wire-up: TodayColumnPlaceholder replaced with <TodayColumn onIssueClick={onIssueClick} /> in StandupNotesPage right column (b35c82c2)"
  - "Grouped display replaces locked D-04 leaf-only rule: parent stories shown with my assigned subtasks nested; the old rule hid in-progress stories that had subtasks (the 'only one story' bug)"
  - "Sprint query switched to assignedToMe=false (whole sprint, key 'sprint-board-today-full') so stories where I only own a subtask are visible; my-assignment grouping is client-side"
  - "Done items dropped up front in filterSprintItems — done parents and done subtasks never show; an active subtask of a done parent resurfaces as a standalone row"
  - "Pinned section removed entirely (user does not want it)"
  - "Progress bar uses shared ui/Progress (logged vs originalEstimate) + caption, matching DashboardSprintCard"
  - "Assignee shown via CachedAvatar (size 20); story points badge placed left of the avatar"
  - "Participating section: MRs I commented on, via GitLab events (role-independent). 30-day window. Filtered to: OPEN MRs only (fetchMRDetail.state), AND (open unresolved thread of mine OR not approved by me), AND — for MRs I authored — only when I have an open thread (my own MR's approval is someone else's job)"
  - "MR↔story matching: linkMRToTask matches reviewer + participating MRs to displayed sprint keys (title then branch); matched MRs nest under their story, unmatched stay in their MR sections"
  - "Row converted from <button> to <div role=button> (TaskCard pattern) to fix button-in-button hydration error; onKeyDown target-guarded so Log Work keypress doesn't navigate"
metrics:
  completed: "2026-05-25"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 70 Plan 03: Wire Today column + checkpoint refinements

Wired the real `TodayColumn` into `StandupNotesPage` (replacing the placeholder), verified the phase end-to-end, then iterated through a long human-verify checkpoint that substantially reshaped the Today column based on live testing against real Jira/Tempo/GitLab data.

## Tasks Completed

| Task | Name | Key commit(s) |
|------|------|---------------|
| 1 | Replace TodayColumnPlaceholder with TodayColumn in StandupNotesPage | b35c82c2 |
| 2 | Full-suite + production-build phase gate | (verification gate — no new files) |
| 3 | Human-verify checkpoint (live data UAT) → refinements below | bc3ce716 … fca70d61 |

## What Was Built / Changed

**Wiring (task 1):** `StandupNotesPage.tsx` right column now renders `<TodayColumn onIssueClick={onIssueClick} />`.

**Checkpoint refinements (task 3 — driven by user UAT):**
- **Grouped stories** — `filterSprintItems` reworked from the locked "leaf-only" rule (D-04) to a grouped model: parent stories shown with my assigned subtasks nested. Fixed "only one in-progress story shows" (parents with subtasks were being hidden) and "show my subtasks".
- **Whole-sprint fetch** — sprint query now `assignedToMe=false` (key `sprint-board-today-full`) so stories where I only own a subtask appear; my-assignment grouping is client-side.
- **Done exclusion** — done parents/subtasks dropped up front; an active subtask of a done parent resurfaces standalone.
- **Pinned section removed** entirely.
- **Progress bar** — replaced the custom block-character bar with the shared `ui/Progress` component + "spent / estimate logged" caption (matches DashboardSprintCard).
- **Assignee avatar** — `CachedAvatar` on each row; story-points badge placed to its left.
- **Participating section (new)** — `TodayParticipatingSection` + `fetchParticipatedMRs`: MRs I've commented on, found via GitLab events (`action=commented`, role-independent — catches MRs where I'm not assignee/reviewer/author). 30-day window. Filtered to **open** MRs only, kept only when actionable (an open unresolved thread of mine **or** not approved by me), and for MRs **I authored** only when I have an open thread.
- **MR↔story matching** — `mrMatching.ts` (`matchMrsToStories`) uses `linkEngine.linkMRToTask` to match reviewer + participating MRs to displayed sprint story keys (title, then source branch); matched MRs nest under their story, unmatched stay in their sections.
- **Layout/HTML fixes** — section spacing (`mb-6`); removed redundant `└` glyph on nested rows; converted the row from `<button>` to `<div role="button">` (TaskCard pattern) to fix a **button-in-button hydration error**, with a target-guarded `onKeyDown`; story-points moved left of the assignee.

## Verification

- `npx tsc --noEmit`: clean
- `npx vitest run src/routes/standup-notes/ src/services/gitlab.test.ts`: 100 passed
- `npm run build`: exit 0
- Full suite: only the 5 pre-existing `WorklogsPage.test.tsx` date-dependent failures remain (unrelated to this phase)
- Human verification (live app): approved by user after the refinement cycles above

## Deviations from Plan

The plan's task 3 was a single human-verify checkpoint. In practice it became an extended, user-driven refinement cycle (≈10 rounds) that changed phase decisions — most notably **replacing the locked leaf-only rule D-04 with a grouped story+subtask model**, **removing the Pinned section**, and **adding a Participating-MRs section with MR↔story matching** that were not in the original 70 plan scope. All changes were made with the user in the loop and each was gated (tsc + tests + build) before re-presenting.

## Known Follow-ups

- `TodayColumnPlaceholder.tsx` is now unused (the wiring replaced its only consumer) — candidate for deletion.
- Participating section does a bounded per-MR fan-out (detail + discussions + approvals per candidate MR). Acceptable for the small candidate set (MRs commented on in 30 days), cached 5 min; revisit if it grows.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| TodayColumn wired into StandupNotesPage | FOUND |
| TodayParticipatingSection + fetchParticipatedMRs | FOUND |
| mrMatching.ts (matchMrsToStories) | FOUND |
| filterSprintItems grouped + done-exclusion | FOUND |
| tsc clean / 100 standup-notes+gitlab tests / build exit 0 | PASS |
| Human verification approved | PASS |
