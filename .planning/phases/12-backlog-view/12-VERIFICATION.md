---
phase: 12-backlog-view
verified: 2026-03-14T22:05:00Z
status: human_needed
score: 11/11 automated must-haves verified
re_verification: false
human_verification:
  - test: "BACK-01: Backlog issues load correctly against live Jira"
    expected: "Issues not in active or future sprint appear as rows with key, summary, story points, assignee avatar, epic badge; no subtasks visible; no 400 error from futureSprints()"
    why_human: "JQL uses futureSprints() which may fail on some Jira license tiers; cannot verify live API response programmatically"
  - test: "BACK-02: Move-to-sprint via live Jira Agile API"
    expected: "Selected issues disappear optimistically from list, appear in active sprint in Jira browser; button disabled and titled correctly when no active sprint"
    why_human: "POST /rest/agile/1.0/sprint/{id}/issue requires live Jira Software board; 204 success response cannot be simulated without a real instance"
  - test: "BACK-03: Create Story modal pre-sets type and refreshes backlog after close"
    expected: "Modal opens with Issue Type = Story; after creation, new story appears in backlog list"
    why_human: "wasStoryCreate ref path and ['jira-backlog'] cache invalidation trigger requires observing modal close + cache refresh sequence in the live app"
  - test: "BACK-04: Filter dropdowns populate from live data"
    expected: "Epic and assignee dropdowns show real options derived from fetched issues; AND filter logic hides correct rows; chip dismiss restores all rows"
    why_human: "Filter option derivation depends on real issue data; edge cases (empty epic/label) cannot be fully covered in unit tests"
  - test: "BACK-05: Row click opens IssueDetailSheet in live app"
    expected: "Clicking summary text in any row (backlog section or sprint section) slides open IssueDetailSheet with correct issue detail"
    why_human: "IssueDetailSheet is rendered by AppLayout via outlet context; wiring through the real router and sheet is not exercised by unit tests"
---

# Phase 12: Backlog View Verification Report

**Phase Goal:** Users can see all backlog issues in one place, move issues into the active sprint, create new stories, and filter the list — eliminating the need to open Jira for sprint grooming
**Verified:** 2026-03-14T22:05:00Z
**Status:** human_needed — all automated checks pass; live Jira instance verification documented as human-approved in 12-04-SUMMARY.md
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | fetchBacklogIssues fetches all backlog issues using compound JQL and handles 400 errors gracefully | VERIFIED | `jira.ts:1235` exports function with correct JQL (`futureSprints()`, `subtaskIssueTypes()`), 400 branch at line 1267 throws descriptive error |
| 2 | addIssuesToSprint POSTs to Jira Agile REST and treats 204 as success | VERIFIED | `jira.ts:1492` POSTs to `/rest/agile/1.0/sprint/{id}/issue`, `!response.ok && response.status !== 204` guard at line 1505 |
| 3 | BacklogPage renders issue rows with key, summary, story points, assignee avatar, epic badge | VERIFIED | BacklogPage.tsx (413 lines) renders `<BacklogRow>` per visible issue; BacklogRow.tsx (148 lines) renders all five data cells with proper null guards |
| 4 | User can filter backlog by epic, label, and assignee with AND logic; filters are client-side only | VERIFIED | BacklogFilterBar.tsx (231 lines) provides three Popover filters + dismissible chips; BacklogPage.tsx useMemo applies AND logic across all sections |
| 5 | User can click any backlog row to open IssueDetailSheet | VERIFIED | BacklogRow.tsx line 106: `onClick={() => onIssueClick(issue.key)}`; BACK-05 test GREEN (16/16 suite passes) |
| 6 | User can select issues and move them to active sprint with optimistic removal and rollback | VERIFIED | BacklogPage.tsx `handleMoveToSprint` at line 172: snapshot → setQueryData optimistic removal → addIssuesToSprint → invalidate on success OR rollback + bulkError on catch |
| 7 | User can create a new story from the backlog page header | VERIFIED | BacklogPage.tsx line 301/324: `onClick={() => openCreateStory()}`; main.tsx line 118: `handleOpenCreateStory` sets type='Story'; `wasStoryCreate` ref triggers `['jira-backlog']` invalidation on modal close |
| 8 | AppLayout Outlet context includes openCreateStory | VERIFIED | main.tsx line 157: Outlet context object includes `openCreateStory: handleOpenCreateStory` |
| 9 | /backlog route is registered and navigable via sidebar | VERIFIED | main.tsx line 190: `{ path: '/backlog', element: <BacklogPage /> }`; Sidebar.tsx lines 93 and 120: NavLink to="/backlog" in both developer and PM sections with List icon |
| 10 | All 16 BacklogPage tests pass GREEN | VERIFIED | `npx vitest run src/routes/dashboard/BacklogPage.test.tsx` — 16 tests, 0 failures |
| 11 | Full vitest suite (non-phase-12 files) has no regressions | VERIFIED | 351 tests pass across 30 test files; 18 unhandled errors in gitlab.test.ts pre-date phase 12 (last touched at commit bf6ee0c, phase 5 era) |

**Score:** 11/11 automated truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/jira.ts` | fetchBacklogIssues and addIssuesToSprint exports | VERIFIED | Lines 1235 and 1492; both exported; fetchBacklogView (line 1344) also added as combined data loader |
| `taskflow/src/routes/dashboard/BacklogPage.tsx` | Full-page backlog route with query, filter state, row list, bulk action bar | VERIFIED | 413 lines; useQuery with fetchBacklogView; handleMoveToSprint; filter useMemo; BacklogFilterBar; BacklogRow loop |
| `taskflow/src/routes/dashboard/BacklogRow.tsx` | Single issue row: checkbox, key, summary, story points, assignee avatar, epic badge | VERIFIED | 148 lines; all six cells rendered; onIssueClick wired to summary click; epic badge with deterministic color hash |
| `taskflow/src/routes/dashboard/BacklogFilterBar.tsx` | Horizontal filter bar with Epic/Label/Assignee popovers and dismissible chips | VERIFIED | 231 lines; three Popover filters; active filter chips; data-testid attributes match test selectors |
| `taskflow/src/routes/dashboard/BacklogPage.test.tsx` | 16 tests covering all five BACK requirements GREEN | VERIFIED | 16 tests across 5 describe blocks (BACK-01..05); all pass |
| `taskflow/src/main.tsx` | /backlog route registered; openCreateStory in Outlet context | VERIFIED | Line 190: route entry; line 157: openCreateStory in context; lines 88-131: wasStoryCreate ref pattern |
| `taskflow/src/components/app/Sidebar.tsx` | NavLink to /backlog in developer and PM sections | VERIFIED | Lines 93 and 120: two NavLink entries with List icon and "Backlog" label |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| BacklogPage.tsx | jira.ts | `fetchBacklogView` in useQuery | VERIFIED | Line 19 import; line 55 useQuery call |
| BacklogPage.tsx | BacklogRow.tsx | `visibleIssues.map(…BacklogRow)` | VERIFIED | Line 23 import; line 275 map render |
| BacklogRow.tsx | AppLayout IssueDetailSheet | `onIssueClick(issue.key)` prop | VERIFIED | Lines 35 (prop type) and 106 (onClick handler) |
| BacklogPage.tsx | jira.ts | `addIssuesToSprint` in handleMoveToSprint | VERIFIED | Line 19 import; line 194 await call |
| main.tsx | BacklogPage.tsx | Outlet context `openCreateStory` callback | VERIFIED | Line 157 context; BacklogPage line 29 destructures it |
| BacklogPage.tsx | React Query cache | `invalidateQueries(['jira-backlog'])` after move/create | VERIFIED | Lines 195-196 (move success); main.tsx line 129 (create close) |
| Sidebar.tsx | BacklogPage.tsx | NavLink to='/backlog' → router renders BacklogPage | VERIFIED | Sidebar lines 93/120; main.tsx line 190 route entry |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BACK-01 | 12-01, 12-02, 12-04 | View all backlog issues not in active or future sprint | VERIFIED | fetchBacklogIssues with compound JQL; BacklogPage list render; 3 BACK-01 tests GREEN |
| BACK-02 | 12-01, 12-03, 12-04 | Move one or more backlog issues into active sprint | VERIFIED | addIssuesToSprint; handleMoveToSprint optimistic update; 4 BACK-02 tests GREEN |
| BACK-03 | 12-03, 12-04 | Create a new story directly from the backlog view | VERIFIED | openCreateStory in Outlet context; handleOpenCreateStory sets type='Story'; 1 BACK-03 test GREEN |
| BACK-04 | 12-02, 12-04 | Filter backlog by epic, label, and assignee | VERIFIED | BacklogFilterBar; useMemo AND logic in BacklogPage; 4 BACK-04 tests GREEN |
| BACK-05 | 12-02, 12-04 | Open issue detail panel from any backlog row | VERIFIED | BacklogRow onIssueClick; BacklogPage passes outlet onIssueClick; 2 BACK-05 tests GREEN |

No orphaned requirements: all five BACK-01..05 from REQUIREMENTS.md are claimed across plans 12-01 through 12-04 and verified implemented.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TODO/FIXME/placeholder comments found in any phase 12 component file |

No anti-patterns detected. All three component files (BacklogPage.tsx, BacklogRow.tsx, BacklogFilterBar.tsx) contain substantive implementations with no stub indicators.

### Human Verification Required

#### 1. BACK-01: Backlog issues load against live Jira

**Test:** Navigate to /backlog in the running Tasker app connected to the Orange Jira instance.
**Expected:** Issues without active or future sprint appear; no subtasks; no 400 error; rows show key, summary, story points, assignee avatar, epic badge.
**Why human:** JQL uses `futureSprints()` which requires Jira Software license. The 400 graceful-error path cannot be confirmed green/red without a live request.

**Note:** 12-04-SUMMARY.md documents human approval: "Task 2 checkpoint approved: human confirmed all five BACK requirements (BACK-01 through BACK-05) pass on live Orange Jira instance."

#### 2. BACK-02: Move-to-sprint on live Jira board

**Test:** Check one or more backlog issues, click "Move to sprint" in the sticky action bar.
**Expected:** Issues disappear from list immediately (optimistic); they appear in the active sprint in the Jira browser; if no active sprint, button is disabled with correct tooltip.
**Why human:** Requires live Jira Software board with Agile REST API.

#### 3. BACK-03: Create story refreshes backlog

**Test:** Click "+ Create Story" in the backlog page header, fill in a summary, submit.
**Expected:** Modal opens with Issue Type pre-set to "Story"; after close, the new story appears in the backlog list without manual refresh.
**Why human:** Cache invalidation via `wasStoryCreate` ref requires observing the full modal close sequence in a live app.

#### 4. BACK-04: Filter dropdowns with real data

**Test:** Open the Epic dropdown; select an epic; combine with an assignee filter; dismiss chips.
**Expected:** Options are derived from the actual fetched issues; AND logic hides non-matching rows; chip X clears the filter.
**Why human:** Filter option population depends on real backlog data. Edge cases differ per project.

#### 5. BACK-05: Row click opens IssueDetailSheet

**Test:** Click any issue row summary text in either the backlog section or a sprint section.
**Expected:** IssueDetailSheet slides open on the right side showing full issue details.
**Why human:** IssueDetailSheet is controlled by AppLayout outlet context. The wiring through createHashRouter and Tauri WebView is not exercised by unit tests.

### Notable Deviation: fetchBacklogView vs fetchBacklogIssues

The plan specified `fetchBacklogIssues` as the primary data function consumed by BacklogPage. The actual implementation added a composite `fetchBacklogView` function (jira.ts:1344) that combines sprint sections, backlog issues, and an `epicNames` Map into a single `BacklogViewData` type. BacklogPage consumes `fetchBacklogView`, not `fetchBacklogIssues` directly. `fetchBacklogIssues` remains exported and is used internally by `fetchBacklogView`.

This is an implementation evolution, not a gap. Tests mock `fetchBacklogView`, tests pass, the plan's behavioral goals are fully met. The `BacklogViewData.epicNames` field addition (plan 12-04 deviation log) required spreading `...old` in optimistic updates and adding `epicNames: new Map()` to 11 test fixtures — both were fixed before phase completion.

### Gaps Summary

No gaps. All automated must-haves are verified. The five BACK requirements are implemented, wired, and covered by passing tests. Human approval for the live Jira instance was documented in 12-04-SUMMARY.md on 2026-03-14.

The 18 unhandled errors in the full vitest run originate from `src/services/gitlab.test.ts` which was last modified in the phase 5 era (commit bf6ee0c). These errors pre-date phase 12 and are not a regression.

---

_Verified: 2026-03-14T22:05:00Z_
_Verifier: Claude (gsd-verifier)_
