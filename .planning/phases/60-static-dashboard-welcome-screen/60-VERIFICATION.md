---
phase: 60-static-dashboard-welcome-screen
verified: 2026-05-21T09:45:00Z
status: human_needed
score: 22/22 must-haves verified
overrides_applied: 0
re_verification: true
  previous_status: human_needed
  previous_score: 20/20
  gaps_closed:
    - "DashboardInProgressCard uses onIssueClick prop (not useNavigate) for subtask navigation"
    - "DashboardReleaseCard renders a Progress bar and issue count caption from live release issues data"
    - "dashboard/index.tsx reads onIssueClick from useOutletContext and passes it to DashboardInProgressCard"
    - "fetchReleaseIssues exported from jira.ts"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /dashboard in the running app and confirm the hero section renders with the correct user display name and today's date"
    expected: "Hero shows 'Welcome back, [your name]' and a date string like 'Thursday, 21 May 2026' centered on a gradient background"
    why_human: "toLocaleDateString('en-GB') output and Tauri readSecret('jira-pat') token flow cannot be verified by grep or unit tests alone in a Tauri app"
  - test: "Click a subtask row in the 'My In Progress' card and confirm navigation to /issue/:key AND a breadcrumb back-arrow to Dashboard appears"
    expected: "The issue detail page opens AND the breadcrumb trail includes Dashboard so the user can navigate back with the back-arrow"
    why_human: "The breadcrumb chain (onIssueClick -> handleIssueClick in main.tsx -> breadcrumbStore.push) requires a live Tauri app to observe"
  - test: "Verify no drag handles, widget picker, or resize grips appear anywhere on the dashboard page"
    expected: "The page is a static read-only layout with no interactive configuration controls"
    why_human: "Unit tests assert DOM absence of known class names, but a visual inspection of the rendered page is the definitive check for DASH-05"
  - test: "Confirm the Release card shows a progress bar and 'N% complete · X / Y issues' caption beneath the timing label"
    expected: "A progress bar appears below the timing label (e.g. '7 days away'), and a caption like '42% complete · 5 / 12 issues' appears below the bar"
    why_human: "fetchReleaseIssues is a live Jira network call via Tauri's apiFetch — cannot be invoked in Vitest"
---

# Phase 60: Static Dashboard Welcome Screen Verification Report

**Phase Goal:** Users land on a minimal static dashboard with a personalized greeting, sprint health, in-progress subtasks, and next release countdown — no configuration required
**Verified:** 2026-05-21T09:45:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure plans 60-05 and 60-06

## Re-verification Summary

Two gaps identified in UAT were closed by plans 60-05 and 60-06:

- **Gap 1 (60-05):** `DashboardInProgressCard` called `useNavigate` directly, bypassing the breadcrumb chain. Fixed by removing `useNavigate` and replacing subtask row click handlers with an `onIssueClick(key)` prop. `dashboard/index.tsx` now reads `onIssueClick` from `useOutletContext` and passes it as a prop.
- **Gap 2 (60-06):** `DashboardReleaseCard` had no progress bar. Fixed by adding `fetchReleaseIssues` to `jira.ts` and a second `useQuery` in `DashboardReleaseCard` that computes `donePct` and renders a `Progress` bar and "N% complete · X / Y issues" caption.

All 22 must-haves are now verified. 4 human verification items remain (live Tauri app required).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard hero renders 'Welcome back, [name]' and today's date in en-GB format (DASH-01) | ✓ VERIFIED | `index.tsx` line 36: `Welcome back, {jiraUserDisplayName ?? 'there'}`; lines 25-30: `toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })` |
| 2 | Dashboard loads PAT via `readSecret('jira-pat')` in `useEffect` keyed on `jiraBaseUrl` (D-16) | ✓ VERIFIED | `index.tsx` lines 17-23: `useEffect(() => { if (jiraBaseUrl) { readSecret('jira-pat')... }}, [jiraBaseUrl])` — single dep array |
| 3 | Dashboard renders DashboardSprintCard, DashboardInProgressCard, and DashboardReleaseCard in a responsive grid | ✓ VERIFIED | `index.tsx` line 41: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6`; all three cards imported and rendered at lines 42-61 |
| 4 | Dashboard contains NO drag handles, widget picker, resize grips, or configuration controls (DASH-05) | ✓ VERIFIED | `grep -c "react-grid-layout\|WidgetGrid\|WidgetPicker\|react-resizable" index.tsx` returns 0; 5 unit tests (DASH-05 test) pass |
| 5 | DashboardSprintCard renders sprint name, days remaining, and Progress bar using exact cache keys shared with SprintHealthPanel (DASH-02) | ✓ VERIFIED | `DashboardSprintCard.tsx`: cache keys `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` and `['jira-active-sprint',activeJiraProject]` confirmed; `Progress` imported from `@/components/ui/progress` |
| 6 | DashboardSprintCard renders 'No active sprint' empty state when activeSprint is null | ✓ VERIFIED | `DashboardSprintCard.tsx` line 99: literal `No active sprint` present |
| 7 | DashboardSprintCard has zero-denominator guard on progress percentage | ✓ VERIFIED | `DashboardSprintCard.tsx` line 76: `totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0` |
| 8 | DashboardSprintCard header has Zap icon with `text-amber-500` | ✓ VERIFIED | `DashboardSprintCard.tsx` line 84: `<Zap className="size-4 text-amber-500" aria-hidden />` |
| 9 | DashboardSprintCard never calls readSecret or useAuthStore directly (D-16) | ✓ VERIFIED | grep returns 0 functional calls; one JSDoc comment match only |
| 10 | DashboardInProgressCard filters subtask + indeterminate + `displayName === jiraUserDisplayName` (D-08 Option B) (DASH-03) | ✓ VERIFIED | `DashboardInProgressCard.tsx` lines 54-59: `issue.fields.issuetype.subtask && statusCategory?.key === 'indeterminate' && assignee?.displayName === jiraUserDisplayName` |
| 11 | DashboardInProgressCard uses sprint-board cache key shared with SprintBoardTab/DashboardSprintCard | ✓ VERIFIED | `DashboardInProgressCard.tsx` line 41: exact key `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` |
| 12 | DashboardInProgressCard renders up to 3 rows and shows 'and N more' plain-text overflow (D-12) | ✓ VERIFIED | lines 62-63: `slice(0,3)` + overflow count; line 102: `<p className="...">and {overflow} more</p>` — plain `<p>`, not button or anchor |
| 13 | Clicking a subtask row calls `onIssueClick(issue.key)` — does NOT call `useNavigate` directly (gap 60-05 closed) | ✓ VERIFIED | `DashboardInProgressCard.tsx` lines 90-93: `onClick={() => onIssueClick(issue.key)}` and `onKeyDown` both use `onIssueClick`; `useNavigate` is absent from the file (grep returns 0) |
| 14 | `dashboard/index.tsx` reads `onIssueClick` from `useOutletContext` and passes it to `DashboardInProgressCard` (gap 60-05 closed) | ✓ VERIFIED | `index.tsx` line 2: `import { useOutletContext } from 'react-router-dom'`; line 14: `const { onIssueClick } = useOutletContext<...>()`; line 54: `onIssueClick={onIssueClick}` on DashboardInProgressCard JSX |
| 15 | DashboardInProgressCard renders 'No subtasks in progress — nice work!' empty state | ✓ VERIFIED | `DashboardInProgressCard.tsx` line 109: exact literal present |
| 16 | DashboardInProgressCard never calls readSecret or useAuthStore directly (D-16) | ✓ VERIFIED | grep for functional calls returns 0; line 13 is JSDoc comment only |
| 17 | DashboardReleaseCard renders the soonest unreleased fix version using ascending `localeCompare` sort (DASH-04) | ✓ VERIFIED | `DashboardReleaseCard.tsx` lines 54-57: `.filter(!released && !!releaseDate).sort((a,b) => a.releaseDate.localeCompare(b.releaseDate))[0]` |
| 18 | DashboardReleaseCard renders 'Today' in a blue Badge, 'X days overdue' in amber, 'X days away' in muted (DASH-04) | ✓ VERIFIED | lines 97-110: `<Badge tone="blue">Today</Badge>`, `text-amber-600 dark:text-amber-400` span, `{timing.daysUntil} days away` span |
| 19 | DashboardReleaseCard renders a Progress bar from live `fetchReleaseIssues` data with `donePct` caption (gap 60-06 closed) | ✓ VERIFIED | `DashboardReleaseCard.tsx` line 14: `import { Progress } from '@/components/ui/progress'`; line 17: `fetchReleaseIssues` imported; lines 61-73: second useQuery keyed on `['jira-release-issues',...]`, `donePct` guard (`totalCount > 0`); lines 115-118: `<Progress value={donePct} />` and caption `{donePct}% complete · {doneCount} / {totalCount} issues` |
| 20 | `fetchReleaseIssues` exported from `jira.ts` (gap 60-06 closed) | ✓ VERIFIED | `grep -n "export async function fetchReleaseIssues" jira.ts` returns line 1009; function uses `fixVersion=` JQL, `fields=status`, `maxResults=500`, resilient return `[]` on error |
| 21 | DashboardReleaseCard renders 'No upcoming releases' empty state | ✓ VERIFIED | `DashboardReleaseCard.tsx` line 124: literal `No upcoming releases` present |
| 22 | DashboardReleaseCard never calls readSecret or useAuthStore directly (D-16) | ✓ VERIFIED | grep for functional calls returns 0; line 8 is JSDoc comment only |

**Score:** 22/22 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/components/ui/progress.tsx` | shadcn Progress primitive | ✓ VERIFIED | Exists; exports `Progress` wrapping `@base-ui/react/progress`; renders `role="progressbar"` |
| `taskflow/src/services/jira.ts` | `fetchReleaseIssues` exported | ✓ VERIFIED | Function at line 1009; JQL with `fixVersion=`, `fields=status`, `maxResults=500`, resilient `[]` on error |
| `taskflow/src/routes/dashboard/DashboardSprintCard.tsx` | Sprint health card | ✓ VERIFIED | Exports default + `DashboardSprintCardProps`; dual useQuery; Progress bar; Zap icon; empty state |
| `taskflow/src/routes/dashboard/DashboardSprintCard.test.tsx` | 5 Vitest tests for DASH-02 | ✓ VERIFIED | 5/5 passing in full suite run |
| `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` | My In Progress card with `onIssueClick` prop | ✓ VERIFIED | No `useNavigate`; `onIssueClick` in props interface and called on click/keydown; D-08 filter; D-12 overflow |
| `taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx` | 5 Vitest tests for DASH-03 | ✓ VERIFIED | 5/5 passing; test 3 asserts `onIssueClick('PROJ-101')` (not navigate with full path) |
| `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx` | Next Release card with Progress bar | ✓ VERIFIED | Second useQuery on `['jira-release-issues',...]`; `donePct` with zero-guard; `<Progress value={donePct} />`; caption; ascending sort |
| `taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx` | 8 Vitest tests for DASH-04 (5 original + 3 progress bar) | ✓ VERIFIED | 8/8 passing; Test 6 asserts "42% complete · 5 / 12 issues"; Test 7 asserts "0% complete · 0 / 0 issues" |
| `taskflow/src/routes/dashboard/index.tsx` | Dashboard orchestrator (hero + 3-card grid + useOutletContext) | ✓ VERIFIED | 64 lines; hero, grid, PAT load, `useOutletContext`, `onIssueClick` prop threading — all present |
| `taskflow/src/routes/dashboard/index.test.tsx` | 5 Vitest tests for DASH-01, DASH-05 | ✓ VERIFIED | 5/5 passing; mocks `useOutletContext` with `onIssueClick: vi.fn()` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DashboardSprintCard.tsx` | `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` | useQuery | ✓ WIRED | Exact string confirmed by grep |
| `DashboardSprintCard.tsx` | `['jira-active-sprint',activeJiraProject]` | useQuery | ✓ WIRED | Exact string confirmed by grep |
| `DashboardSprintCard.tsx` | `@/components/ui/progress` | import | ✓ WIRED | Import present; `<Progress value={donePct} />` in JSX |
| `DashboardInProgressCard.tsx` | `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` | useQuery | ✓ WIRED | Exact string confirmed; shared cache with DashboardSprintCard |
| `DashboardInProgressCard.tsx` | `onIssueClick(issue.key)` | onClick + onKeyDown handlers | ✓ WIRED | Both handlers call `onIssueClick(issue.key)`; `useNavigate` absent entirely |
| `index.tsx` | `DashboardInProgressCard` onIssueClick prop | `useOutletContext` → prop | ✓ WIRED | `useOutletContext` destructures `onIssueClick`; passed as `onIssueClick={onIssueClick}` |
| `DashboardReleaseCard.tsx` | `['jira-fix-versions',activeJiraProject]` | useQuery | ✓ WIRED | Exact string confirmed; cache shared with ReleasesTab |
| `DashboardReleaseCard.tsx` | `['jira-release-issues',activeJiraProject,soonest?.name]` | second useQuery | ✓ WIRED | `fetchReleaseIssues` called; `enabled: !!soonest` guard present; `Progress` rendered with `donePct` |
| `DashboardReleaseCard.tsx` | `Badge tone="blue"` | import | ✓ WIRED | Import from `@/components/ui/badge` present; `<Badge tone="blue">Today</Badge>` in JSX |
| `index.tsx` | `readSecret('jira-pat')` | useEffect on jiraBaseUrl | ✓ WIRED | Single call in useEffect with `[jiraBaseUrl]` dep array |
| `index.tsx` | `useAuthStore` | store read | ✓ WIRED | Import present; destructures `jiraBaseUrl`, `activeJiraProject`, `jiraUserDisplayName` |
| `index.tsx` | DashboardSprintCard, DashboardInProgressCard, DashboardReleaseCard | JSX with props | ✓ WIRED | All three imported from `./Dashboard...`; rendered with token + store values as props |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DashboardSprintCard.tsx` | `sprintIssuesRaw`, `activeSprint` | `fetchSprintIssues`, `fetchActiveSprint` via useQuery | Yes — real API functions; staleTime set; enabled guard present | ✓ FLOWING |
| `DashboardInProgressCard.tsx` | `sprintIssuesRaw` | `fetchSprintIssues` via useQuery (shared cache key) | Yes — same cache entry as SprintBoardTab | ✓ FLOWING |
| `DashboardReleaseCard.tsx` | `fixVersions` | `fetchFixVersions` via first useQuery | Yes — real API function; shared cache with ReleasesTab | ✓ FLOWING |
| `DashboardReleaseCard.tsx` | `releaseIssues` | `fetchReleaseIssues` via second useQuery (gap 60-06) | Yes — JQL `fixVersion=` query; `fields=status`; `maxResults=500`; disabled when `!soonest` | ✓ FLOWING |
| `index.tsx` | `jiraToken` | `readSecret('jira-pat')` in useEffect → `setJiraToken` | Yes — Stronghold read wired; passed as prop to all cards | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| DashboardInProgressCard: 5 unit tests (incl. onIssueClick navigation) | `npx vitest run .../DashboardInProgressCard.test.tsx` | 5/5 passed | ✓ PASS |
| DashboardReleaseCard: 8 unit tests (incl. progress bar Tests 6-8) | `npx vitest run .../DashboardReleaseCard.test.tsx` | 8/8 passed | ✓ PASS |
| Dashboard index: 5 unit tests (DASH-01, DASH-05, useOutletContext mock) | `npx vitest run .../index.test.tsx` | 5/5 passed | ✓ PASS |
| Full dashboard directory suite | `npx vitest run src/routes/dashboard/` | 400 passed, 2 skipped, 32 todo — 0 failures (27 test files) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DASH-01 | 60-04 | Welcome screen with personalized greeting and today's date | ✓ SATISFIED | index.tsx hero section with `Welcome back, {jiraUserDisplayName ?? 'there'}` and `toLocaleDateString('en-GB',...)` |
| DASH-02 | 60-01 | Sprint health card: sprint name, days remaining, % complete progress bar | ✓ SATISFIED | DashboardSprintCard.tsx fully implemented; 5 tests pass |
| DASH-03 | 60-02, 60-05 | My In Progress card: up to 3 active subtasks with navigation via onIssueClick | ✓ SATISFIED | DashboardInProgressCard.tsx: `onIssueClick` prop, no `useNavigate`; index.tsx threads from `useOutletContext`; 5 tests pass |
| DASH-04 | 60-03, 60-06 | Next release countdown: soonest unreleased fix version + progress bar | ✓ SATISFIED | DashboardReleaseCard.tsx: ascending sort, timing states, `fetchReleaseIssues` second query, `Progress` bar, caption; 8 tests pass |
| DASH-05 | 60-04 | Static layout — no drag/resize/widget picker | ✓ SATISFIED | grep returns 0 for react-grid-layout, WidgetGrid, WidgetPicker, react-resizable in index.tsx; index test asserts DOM absence |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | No TBD/FIXME/XXX debt markers, no stubs, no empty returns, no hardcoded empty data in any implementation file |

### Human Verification Required

#### 1. Dashboard live render with real credentials

**Test:** Start the Tauri app, navigate to `/dashboard`, and confirm the hero section shows the correct display name and today's date in English long format.
**Expected:** Hero heading reads "Welcome back, [your display name]" and the subtitle shows the date (e.g., "Thursday, 21 May 2026") on a gradient background.
**Why human:** `readSecret('jira-pat')` is a Tauri Stronghold call that cannot be invoked in Vitest. The en-GB date rendering is locale-dependent in a desktop runtime vs. Node/jsdom.

#### 2. Subtask click navigation with breadcrumb trail

**Test:** Ensure the My In Progress card shows at least one in-progress subtask, click its row, and confirm a breadcrumb back-arrow to Dashboard appears in the issue detail page header.
**Expected:** App navigates to `/issue/:key` AND the breadcrumb trail includes "Dashboard" so the user can navigate back via the back-arrow.
**Why human:** The full breadcrumb chain (`onIssueClick` → `handleIssueClick` in `main.tsx` → `breadcrumbStore.push()` + `navigate`) requires a live Tauri app to observe end-to-end. Unit tests verify that `onIssueClick(key)` is called — the downstream breadcrumb effect is exercised only at runtime.

#### 3. Visual confirmation of DASH-05 — no interactive layout controls

**Test:** Inspect the full dashboard page visually and attempt to find any drag handle, resize grip, widget picker, or settings icon.
**Expected:** The page is purely read-only — only the 3 cards and the hero section, with no configuration affordances.
**Why human:** Unit tests assert DOM class-name absence, but a visual inspection of the complete rendered page is the definitive DASH-05 check.

#### 4. Release card progress bar with live data

**Test:** Navigate to `/dashboard` with a project that has an upcoming release. Confirm the Release card shows a progress bar and a "N% complete · X / Y issues" caption beneath the timing label.
**Expected:** A progress bar appears below the timing label, and the caption reflects live issue counts from Jira.
**Why human:** `fetchReleaseIssues` is a live Jira network call via Tauri's `apiFetch` — cannot be invoked in Vitest. Unit tests (Test 6-7) verify the computation and rendering logic, but real API data requires the running app.

### Gaps Summary

No gaps. All 22 must-haves are verified against the actual codebase with code-level evidence. Both UAT gaps (breadcrumb navigation regression in gap 60-05; missing progress bar in gap 60-06) have been closed and confirmed by re-reading the implementation files and running the test suite. 4 human verification items remain, all requiring the running Tauri app.

---

_Verified: 2026-05-21T09:45:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after gap closure plans 60-05 and 60-06_
