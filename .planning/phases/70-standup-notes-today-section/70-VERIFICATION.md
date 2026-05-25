---
phase: 70-standup-notes-today-section
verified: 2026-05-25T11:20:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm the Today column shows my open sprint items grouped as parent stories with my nested subtasks. Done items must be absent. Parent stories where I only own a subtask (not the parent itself) must appear with my subtask nested."
    expected: "In Progress section contains sprint stories/tasks with statusCategory indeterminate; Up Next contains those with statusCategory new. Done items are completely absent. Stories I'm not assigned to but whose subtask I own appear with my subtask nested."
    why_human: "filterSprintItems logic is unit-tested but the actual Jira data shape (parent/subtask relationship, statusCategory values) must be verified against a live sprint to confirm the grouping and exclusion work end-to-end."
  - test: "Click Log Work on an In Progress row and on an Up Next row. Verify the popover opens pre-filled with today's date and the row's issue key, and that the row does NOT navigate to the issue detail."
    expected: "LogWorkPopover opens with initialDate set to today (YYYY-MM-DD) and issueKey set to the clicked row's key. Row click itself still opens issue detail. Log Work click does not navigate."
    why_human: "LogWorkPopover pre-fill behavior and stopPropagation correctness require live interaction; automated tests assert the trigger renders and stopPropagation fires but cannot observe the popover's field values."
  - test: "Submit a worklog via the Log Work popover on an In Progress row. Verify the logged-time chip on that row refreshes to show the new duration without a manual page reload."
    expected: "Within a few seconds of submitting, the chip (e.g. '1h 30m') appears or updates on the row. The today-tempo query invalidation fired by onLogWorkSuccess drives this refresh."
    why_human: "Real Tempo write + invalidation loop requires live credentials and cannot be exercised in a unit test."
---

# Phase 70: Standup Notes Today Section Verification Report

**Phase Goal:** Complete the Standup Notes page with the Today section so the page is fully usable for daily standups.
**Verified:** 2026-05-25T11:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | filterSprintItems returns my open sprint items (assignee = me), grouped as parent stories with my nested subtasks; done items excluded | VERIFIED | `filterSprintItems.ts` implements the grouped model: parents included when assigned-to-me or when I own a subtask of them; my subtasks nested under their parent; orphan subtasks shown standalone; done filtered up front. 13/13 unit tests green. |
| 2 | In Progress = statusCategory.key 'indeterminate'; Up Next = statusCategory.key 'new'; Done excluded from both | VERIFIED | `filterSprintItems.ts:96-101`: `inProgress` filters by `'indeterminate'`, `upNext` by `'new'`. Active filter at line 58 drops all `'done'` items before grouping. Tests cover both buckets and done exclusion. |
| 3 | TodayColumn is rendered by StandupNotesPage in the right 50% column (placeholder replaced) | VERIFIED | `StandupNotesPage.tsx:30`: `import TodayColumn from './TodayColumn'`. Line 323: `<TodayColumn onIssueClick={onIssueClick} />`. Zero references to `TodayColumnPlaceholder` in the page. |
| 4 | TodayColumn receives onIssueClick from the page outlet context and passes it to section components | VERIFIED | `StandupNotesPage.tsx:95`: `useOutletContext` destructures `onIssueClick`. Line 323 passes it to `TodayColumn`. `TodayColumn.tsx:260,275`: passes `onIssueClick` to both `TodayInProgressSection` and `TodayUpNextSection`. |
| 5 | LogWorkPopover present on every In Progress row AND every Up Next row, wrapped in stopPropagation so clicking it does not navigate | VERIFIED | `TodayInProgressSection.tsx:142-149`: `<span onClick={(e) => e.stopPropagation()}><LogWorkPopover ... initialDate={todayStr} /></span>`. `TodayUpNextSection.tsx:136-144`: identical pattern. Tests prove Log Work renders on both sections and stopPropagation prevents onIssueClick invocation. |
| 6 | LogWorkPopover pre-filled with today's date (TZ-safe YYYY-MM-DD) and the row's issueKey | VERIFIED | `TodayColumn.tsx:60-63`: `todayString()` builds `YYYY-MM-DD` via explicit arithmetic, no `toLocaleDateString`. `TodayStr` is memoized and passed as `initialDate` to `LogWorkPopover` on every sprint row. Grep confirms zero `toLocaleDateString` calls in production code (only in comments). |
| 7 | LogWork onSuccess invalidates the today-tempo query so the logged-time chip refreshes | VERIFIED | `TodayColumn.tsx:210-213`: `handleLogWorkSuccess` calls `queryClient.invalidateQueries` with the exact `['standup', 'today-tempo', jiraBaseUrl, todayStr, jiraUsername ?? '']` key. This is passed as `onLogWorkSuccess` to both section components. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/routes/standup-notes/filterSprintItems.ts` | Pure filterSprintItems helper, exports FilteredSprintItems + SprintRow | VERIFIED | 104 lines; exports `SprintRow`, `FilteredSprintItems`, `filterSprintItems`; no useQuery, no JSX; full JSDoc |
| `taskflow/src/routes/standup-notes/filterSprintItems.test.ts` | Unit tests for grouped filter logic | VERIFIED | 209 lines; 13 tests covering grouped output, orphan subtasks, done exclusion, assignee guard — 13/13 green |
| `taskflow/src/routes/standup-notes/TodayColumn.tsx` | Top-level Today column owning queries, section ordering | VERIFIED | 313 lines; 4 useQuery calls with distinct 'sprint-board-today-full' key; imports filterSprintItems; full-column EmptyState wired |
| `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx` | In Progress rows with SP + logged-time chip + Log Work popover | VERIFIED | 245 lines; IssueRow with SP badge, loggedSeconds chip (when >0), LogWorkPopover + stopPropagation; nested subtasks rendered |
| `taskflow/src/routes/standup-notes/TodayUpNextSection.tsx` | Up Next rows with SP chip + Log Work popover (no logged-time chip) | VERIFIED | 237 lines; identical to In Progress minus todayLoggedByIssue prop and chip; LogWorkPopover + stopPropagation present |
| `taskflow/src/routes/standup-notes/mrMatching.ts` | Pure MR-to-story matching logic (phase extra) | VERIFIED | 154 lines; project-qualified dedup; exports `matchMrsToStories`, `NestedMr`, `MrMatchingResult` |
| `taskflow/src/routes/standup-notes/TodayColumn.test.tsx` | Tests: Log Work present + stopPropagation + MRs hidden | VERIFIED | 8/8 tests green: Log Work on In Progress, Log Work on Up Next, stopPropagation no-navigate, MRS AWAITING YOU absent without GitLab |
| `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` | Page wired with TodayColumn replacing placeholder | VERIFIED | Imports TodayColumn (not placeholder); renders `<TodayColumn onIssueClick={onIssueClick} />` at line 323; zero TodayColumnPlaceholder references |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `StandupNotesPage.tsx` | `TodayColumn.tsx` | `import TodayColumn from './TodayColumn'` | WIRED | Line 30 confirmed; renders at line 323 with onIssueClick prop |
| `TodayColumn.tsx` | `filterSprintItems.ts` | `import { filterSprintItems } from './filterSprintItems'` | WIRED | Line 31; used at line 178 in useMemo |
| `TodayColumn.tsx` | today-tempo query | `fetchWorklogs` with todayStr/todayStr range; invalidated on LogWork success | WIRED | Lines 141-147 (query), 210-213 (invalidation) |
| `TodayInProgressSection.tsx` | `LogWorkPopover` | Named import; wrapped in stopPropagation span | WIRED | Lines 25,142-149 |
| `TodayUpNextSection.tsx` | `LogWorkPopover` | Named import; wrapped in stopPropagation span | WIRED | Lines 29,137-144 |
| `TodayColumn.tsx` | `mrMatching.ts` | `import { matchMrsToStories } from './mrMatching'` | WIRED | Line 32; used at line 194 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TodayInProgressSection.tsx` | `rows: SprintRow[]` | `filterSprintItems(sprintQuery.data, jiraUserDisplayName)` in TodayColumn | `fetchSprintIssues` → Jira REST API; `sprintQuery.data ?? []` fallback prevents empty stub | FLOWING |
| `TodayInProgressSection.tsx` | `todayLoggedByIssue` | `useMemo` reducing `todayTempoQuery.data` | `fetchWorklogs(todayStr, todayStr)` → Tempo API; map initializes empty but is populated from real worklog data | FLOWING |
| `TodayUpNextSection.tsx` | `rows: SprintRow[]` | Same sprint query path as In Progress | Same as above | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| filterSprintItems 13 tests green | `npx vitest run src/routes/standup-notes/filterSprintItems.test.ts` | 13/13 pass, 552ms | PASS |
| Today column + section tests | `npx vitest run src/routes/standup-notes/TodayColumn.test.tsx TodayMrsSection.test.tsx TodayParticipatingSection.test.tsx` | 21/21 pass | PASS |
| Full standup-notes suite | `npx vitest run src/routes/standup-notes/` | 54/54 pass (7 files) | PASS |
| Production build | `npm run build` | Exit 0, "built in 4.19s" (chunk-size warning is informational, not an error) | PASS |
| TypeScript clean | `npx tsc --noEmit` | No output — zero errors | PASS |
| No toLocaleDateString in production code | `grep -c 'toLocaleDateString' TodayColumn.tsx` | 0 in code; 3 in comments only | PASS |
| Sprint cache key isolation | `grep 'sprint-board-today-full' TodayColumn.tsx` | 4 matches; `grep "'sprint-board',"` returns 0 | PASS |
| No token in queryKey | `grep 'queryKey.*jira-pat\|queryKey.*gitlab-pat' TodayColumn.tsx` | 0 matches (T-62-06) | PASS |
| stopPropagation in both sections | `grep 'stopPropagation' TodayInProgressSection.tsx TodayUpNextSection.tsx` | 1 match each | PASS |
| Up Next has no logged-time chip | `grep -c 'todayLoggedByIssue' TodayUpNextSection.tsx` | 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STAND-07 | 70-01, 70-02, 70-03 | Today section shows my open subtasks/tasks in current sprint, grouped stories + nested subtasks | SATISFIED | filterSprintItems implements grouped model; TodayInProgressSection + TodayUpNextSection render rows; TodayColumn wired into StandupNotesPage; 13 unit tests green |
| STAND-08 | Descoped | ~~Pinned section~~ — removed by user decision during Phase 70 UAT | DESCOPED | REQUIREMENTS.md line 50: `[-] STAND-08 — DESCOPED (won't-do): Pinned section removed by user during Phase 70`. TodayPinnedSection.tsx was deleted; no references remain in TodayColumn.tsx or StandupNotesPage.tsx |
| STAND-09 | 70-02, 70-03 | Planned worklog targets — LogWorkPopover on every sprint row pre-filled with today's date + issue key | SATISFIED | LogWorkPopover on all In Progress and Up Next rows; initialDate={todayStr} (TZ-safe); stopPropagation prevents navigation; onLogWorkSuccess invalidates today-tempo; 3 automated tests prove presence + no-navigation |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `TodayMrsSection.tsx` | 81-85 | Commented-out aspirational `review_state` amber-path code referencing a non-existent field (IN-04 from 70-REVIEW.md) | Info | Maintenance smell; no functional impact |
| `TodayInProgressSection.tsx` | 108 | `as number \| null` cast on dynamic story-points field without runtime type check (WR-05 from review) | Warning | Could render `[object Object]` if storyPointsFieldKey is misconfigured; non-blocking |
| `TodayUpNextSection.tsx` | 109 | Same WR-05 issue as In Progress | Warning | Same as above |
| `StandupNotesPage.tsx` | 289-291 | setTimeout for `setCopied` not cleared on unmount (IN-01 from review) | Info | Benign under React 18; minor state-update-on-unmount risk |

No TBD/FIXME/XXX debt markers found in any phase-70 production files. No placeholder returns (`return null` for stubs) — all `return null` calls are the documented D-03 "hidden-when-empty" pattern, not stubs.

**Code-review blockers resolved:** The 70-REVIEW.md identified two CRITICALs (CR-01: `Promise.all` rejecting whole participating query on CE approvals shape; CR-02: reviewer/participating dedup using bare iid across projects). Both were fixed in commit `de1af6d8` before this verification:
- CR-01 fixed: `approved_by ?? []` guard + outer `Promise.allSettled` in `fetchParticipatedMRs`
- CR-02 fixed: `mrMatching.ts` now tracks ALL reviewer MRs (not just matched ones) with project-qualified `${project_id}:${iid}` keys

### Human Verification Required

### 1. Sprint item grouping with real Jira data (STAND-07)

**Test:** Launch the app (`cd taskflow && npm run tauri dev`), open Standup Notes, look at the Today column In Progress and Up Next sections against an active sprint.
**Expected:** Only my open items appear. Items where I'm assigned to the parent story show the story; items where I only own a subtask show the parent story with my subtask nested. Done items are absent. Parent stories with subtasks assigned to me are NOT hidden (regression from old leaf-only rule fixed in this phase).
**Why human:** The grouped display model was reworked during UAT; unit tests verify the filter logic but the rendering against live Jira data with real parent/subtask relationships must be confirmed.

### 2. LogWorkPopover pre-fill (STAND-09)

**Test:** Click "Log Work" on an In Progress row and on an Up Next row.
**Expected:** The popover opens with today's date pre-filled in the date field and the row's Jira issue key pre-filled in the issue key field. Clicking the row button itself navigates to the issue detail; clicking "Log Work" does not navigate.
**Why human:** Popover field values and navigation behavior require live interaction; automated tests assert the trigger renders and stopPropagation fires but cannot read the popover's internal field state.

### 3. Logged-time chip refresh after worklog (STAND-09)

**Test:** On an In Progress row with no chip visible, submit a worklog via Log Work. Observe the row.
**Expected:** Within seconds, the logged-time chip appears on the row showing the logged duration (e.g. "30m"), without a manual page reload.
**Why human:** Requires live Tempo credentials and a real write + invalidation cycle; cannot be exercised in a unit test.

### Gaps Summary

No automated gaps found. All 7 must-have truths are VERIFIED in the codebase. The 3 human verification items above cover live-data behaviors (sprint grouping, popover pre-fill, chip refresh) that pass automated checks but require confirmation against real Jira/Tempo data. The code-review CRITICALs (CR-01, CR-02) were fixed before verification.

---

_Verified: 2026-05-25T11:20:00Z_
_Verifier: Claude (gsd-verifier)_
