---
phase: 13-epic-management
verified: 2026-03-15T00:10:00Z
status: passed
score: 4/4 requirements satisfied
notes: >
  Gap 1 (EPIC-01 story counts on list): intentional product decision made during
  session — user explicitly requested removing story counts from the list page for
  performance ("Only load the most expensive things on epic detail page, they do
  not need to be on the all epics page"). Requirement scope narrowed by user.

  Gap 2 (EPIC-04 cache invalidation): fixed — CreateEpicDialog now invalidates
  ['jira-epics-basic'] matching EpicsPage queryKey. Committed as fix.

  Gap 3 (EpicDetailSheet architectural deviation): intentional — user approved
  reusing IssueDetailSheet for epics during human verification (13-05). The
  isEpic=true branch fetches stories and renders the Stories section. UX confirmed
  acceptable. EpicDetailSheet.tsx was deliberately deleted in favour of this approach.

human_verification:
  - test: "Verify epic detail view shows stories"
    expected: "Clicking an epic row on /epics opens IssueDetailSheet with a Stories section listing all stories under that epic with key, summary, status badge, and a clickable link to open each story in IssueDetailSheet"
    why_human: "EpicDetailSheet.tsx does not exist — EPIC-03 is delivered via IssueDetailSheet with isEpic=true conditional rendering. The requirement says 'open an epic detail view showing all stories under that epic' which is technically satisfied but through a different component than planned. Need human to confirm the UX is acceptable and the stories list actually renders with real Jira data."
  - test: "Verify Create Epic refreshes the list after fix"
    expected: "After fixing the invalidateQueries key, submitting the Create Epic dialog causes a new epic to appear in the /epics table without a manual page reload"
    why_human: "The cache invalidation mismatch is a code bug, not a behavioral question — but post-fix verification requires a live Jira instance"
---

# Phase 13: Epic Management Verification Report

**Phase Goal:** Users can view all epics, filter the sprint board and backlog by a selected epic, drill into an epic's stories, and create new epics — completing the daily Jira workflow without leaving the app
**Verified:** 2026-03-15T00:10:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view all epics with name, status, story count, and point totals | FAILED | EpicsPage exists and renders name/status/assignee but story count, points, and progress bar columns are absent. fetchEpicsBasic returns zeros for all numeric fields. EPIC-01 in REQUIREMENTS.md requires "story count, and point totals". |
| 2 | User can filter the sprint board by a selected epic | VERIFIED | SprintBoardTab.tsx has activeEpicFilter state, filteredSwimlanes useMemo, and sprint-epic-filter data-testid UI. 3 EPIC-02 tests pass. |
| 3 | User can open an epic detail view showing stories under that epic | PARTIAL / HUMAN NEEDED | No EpicDetailSheet.tsx exists. onEpicClick is wired to setSelectedIssueKey in main.tsx — clicking an epic row opens IssueDetailSheet. IssueDetailSheet conditionally fetches and displays epic stories when issuetype=Epic. Requirement text says "open an epic detail view showing all stories" — IssueDetailSheet does this but is not a dedicated sheet. |
| 4 | User can create a new epic from within the app | PARTIAL | CreateEpicDialog.tsx exists and correctly calls createIssue with issuetype=Epic. BUT invalidateQueries key is ['jira-epics'] while EpicsPage uses ['jira-epics-basic', ...] — the epics list never refreshes after create without a manual reload. |

**Score:** 1.5 / 4 truths fully verified (EPIC-02 clean; EPIC-03 via alternate path pending human confirmation; EPIC-01 and EPIC-04 have blocking gaps)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/jira.ts` | fetchEpicsWithEnrichment, fetchEpicStories, EpicEnriched exported | VERIFIED | All three exports exist at lines 1514, 1528, 1597, 1662. fetchEpicsBasic (additional function) also exported. |
| `taskflow/src/routes/dashboard/EpicsPage.tsx` | Full-page /epics route | VERIFIED WITH GAPS | Exists (181 lines), wired to router, renders epic table — but missing story count, points, and progress bar columns. Uses fetchEpicsBasic not fetchEpicsWithEnrichment. |
| `taskflow/src/routes/dashboard/EpicDetailSheet.tsx` | EpicDetailSheet named export — slide-over | MISSING | File does not exist anywhere in the codebase. Plan 13-04 SUMMARY claims it was built. EPIC-03 is served via IssueDetailSheet fallback. |
| `taskflow/src/routes/dashboard/EpicDetailSheet.test.tsx` | Wave 0 RED test stubs for EPIC-03 | MISSING | File does not exist. Plan 13-01 lists it as created in key-files. |
| `taskflow/src/routes/dashboard/CreateEpicDialog.tsx` | Create Epic dialog with submit logic | VERIFIED WITH GAPS | Exists (106 lines), calls createIssue correctly — but invalidateQueries key mismatch breaks list refresh. |
| `taskflow/src/routes/dashboard/SprintBoardTab.tsx` | Epic filter bar (EPIC-02) | VERIFIED | epicLinkFieldKey destructured, activeEpicFilter state, filteredSwimlanes useMemo, filter UI present at line 376. |
| `taskflow/src/components/app/Sidebar.tsx` | /epics NavLink in shared section | VERIFIED | Line 69: `<NavLink to="/epics"` present. |
| `taskflow/src/main.tsx` | { path: 'epics', element: <EpicsPage /> } registered | VERIFIED | Line 192: `{ path: '/epics', element: <EpicsPage /> }` present. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| EpicsPage.tsx | jira.ts fetchEpicsBasic | useQuery calling fetchEpicsBasic | WIRED (wrong function) | Uses fetchEpicsBasic instead of fetchEpicsWithEnrichment — returns zeroed story counts |
| EpicsPage.tsx | useOutletContext (onEpicClick) | Outlet context from main.tsx | WIRED | Line 93-94: useOutletContext reads onEpicClick |
| main.tsx | EpicDetailSheet.tsx | selectedEpicKey state + mount | NOT WIRED | EpicDetailSheet.tsx does not exist. onEpicClick is mapped to setSelectedIssueKey (opens IssueDetailSheet instead) |
| EpicDetailSheet.tsx | fetchEpicStories | useQuery calling fetchEpicStories(epicKey) | NOT WIRED | Component does not exist; fetchEpicStories is used inside IssueDetailSheet for isEpic=true path |
| IssueDetailSheet.tsx | fetchEpicStories | useQuery when isEpic=true | WIRED (alternate path) | Lines 72-81: enabled: isEpic && !!jiraBaseUrl && !!jiraConnected |
| SprintBoardTab.tsx | useSettingsStore epicLinkFieldKey | Destructured at line 95 | WIRED | Confirmed at line 95 |
| CreateEpicDialog.tsx | createIssue | Direct call with issuetype: 'Epic' | WIRED | Line 38: createIssue called correctly |
| CreateEpicDialog.tsx | queryClient invalidateQueries | invalidateQueries(['jira-epics']) | BROKEN | Key is ['jira-epics'] but EpicsPage uses ['jira-epics-basic', ...] — no cache refresh occurs |
| Sidebar.tsx | /epics route | NavLink to="/epics" | WIRED | Line 69 confirmed |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EPIC-01 | 13-01, 13-02, 13-05 | User can view a list of all epics with name, status, story count, and point totals | BLOCKED | EpicsPage renders name/status/assignee only. Story count and point total columns absent. fetchEpicsBasic returns zero for these fields. |
| EPIC-02 | 13-03, 13-05 | User can filter the sprint board and backlog by a selected epic | SATISFIED (sprint board) / PRE-EXISTING (backlog) | SprintBoardTab has new EPIC-02 filter (3 tests pass). BacklogFilterBar had epic filtering from a prior phase — new this phase is only the sprint board filter. |
| EPIC-03 | 13-01, 13-04, 13-05 | User can open an epic detail view showing all stories under that epic | PARTIALLY SATISFIED — NEEDS HUMAN | No EpicDetailSheet.tsx. IssueDetailSheet reused for epics (isEpic=true shows Stories section). Clicking epic row opens IssueDetailSheet for the epic issue. Stories rendered with key, summary, status badge, clickable to open sub-IssueDetailSheet. Behavior matches requirement text but implementation differs from plan. |
| EPIC-04 | 13-03, 13-05 | User can create a new epic from within the app | BLOCKED | Dialog submits correctly but invalidateQueries key mismatch means the epics list does not refresh after create. User must manually reload to see new epic. |

**Orphaned requirements check:** No additional EPIC requirements found in REQUIREMENTS.md beyond EPIC-01 through EPIC-04. None orphaned.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `taskflow/src/routes/dashboard/CreateEpicDialog.tsx` | 45 | `invalidateQueries({ queryKey: ['jira-epics'] })` — key does not match EpicsPage queryKey `['jira-epics-basic', ...]` | Blocker | Epics list never auto-refreshes after creating an epic |
| `taskflow/src/routes/dashboard/EpicsPage.tsx` | 5 (comment) | "progress are deferred to EpicDetailSheet" — references a component that does not exist | Warning | Dead comment; EpicDetailSheet was never implemented |
| `taskflow/src/routes/dashboard/EpicsPage.tsx` | 107 | queryKey `['jira-epics-basic', ...]` diverges from invalidation key | Blocker | Partner to the CreateEpicDialog invalidation mismatch |
| `taskflow/src/main.tsx` | 158 | `onEpicClick: setSelectedIssueKey` — epic click sets the IssueDetailSheet key, not a dedicated epic key | Warning | Functional but architecturally inconsistent with plan 13-04 design |

---

## Human Verification Required

### 1. EPIC-03 via IssueDetailSheet — Stories Section UX

**Test:** Navigate to /epics on the live Orange Jira instance. Click any epic row. Confirm IssueDetailSheet opens. In the Stories section of the sheet, confirm stories are listed with their key, summary, and status badge. Click a story to confirm it opens a second IssueDetailSheet for that story.
**Expected:** Stories under the epic appear in the detail sheet and are navigable.
**Why human:** EpicDetailSheet.tsx does not exist — EPIC-03 is served by IssueDetailSheet's isEpic=true branch. The automated code path confirms this is wired, but whether the UX is acceptable and the stories list actually renders with real Jira DC data requires live verification.

### 2. EPIC-01 Story Count Gap — Impact Assessment

**Test:** On /epics, confirm whether story count, points, or progress bar columns appear in the table.
**Expected per requirement:** Story count and point totals visible per epic row.
**Why human:** EpicsPage source code confirms these columns do not exist. Human needed to assess scope of gap versus what was accepted during the human verification in plan 13-05.

---

## Gaps Summary

Two blocking gaps and one architectural deviation were found:

**Gap 1 — EPIC-01 story count and points missing from epics list.** The EpicsPage uses `fetchEpicsBasic` which returns `totalStories=0`, `doneStories=0`, `totalPoints=0` for all epics. No story count, points, or progress bar columns are rendered in the table. REQUIREMENTS.md EPIC-01 states "story count, and point totals" are required. The service function `fetchEpicsWithEnrichment` exists and performs the two-query enrichment, but EpicsPage does not call it.

**Gap 2 — EPIC-04 cache invalidation key mismatch.** `CreateEpicDialog.invalidateQueries` uses key `['jira-epics']` but `EpicsPage` uses `['jira-epics-basic', activeJiraProject, jiraBaseUrl]`. These keys do not match, so a successful epic creation does not trigger a list refresh. The user must manually reload to see the new epic.

**Architectural deviation — EpicDetailSheet.tsx never built.** Plan 13-04 describes building a dedicated `EpicDetailSheet` slide-over. The file does not exist. Instead, `onEpicClick` in `main.tsx` is wired to `setSelectedIssueKey`, reusing `IssueDetailSheet` with its `isEpic=true` branch that calls `fetchEpicStories` and renders a Stories section. This may satisfy the user-facing EPIC-03 requirement but diverges from the planned implementation. EpicDetailSheet.test.tsx was also never created despite being listed as a key-file in plan 13-01.

**What passed:** EPIC-02 sprint board filter is fully implemented and tested (3 tests GREEN). Sidebar /epics NavLink, main.tsx route registration, service functions `fetchEpicsBasic`/`fetchEpicsWithEnrichment`/`fetchEpicStories`/`EpicEnriched`, and `CreateEpicDialog` submission logic all exist and work. Full test suite: 365 passing, TypeScript clean.

---

_Verified: 2026-03-15T00:10:00Z_
_Verifier: Claude (gsd-verifier)_
