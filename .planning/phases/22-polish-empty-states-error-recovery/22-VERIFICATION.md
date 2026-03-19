---
phase: 22-polish-empty-states-error-recovery
verified: 2026-03-19T12:46:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Disconnect Jira credentials (clear token in Settings), navigate to My Tasks. Verify ErrorState with 'Session expired' message and 'Reconnect' button appears."
    expected: "ErrorState alert shows ShieldAlert icon, 'Session expired' title, 'Jira token may have been revoked or expired' description, and a Reconnect button that navigates to /settings."
    why_human: "Requires running Tauri app with real Jira credentials to trigger a 401/403 ApiError."
  - test: "With valid credentials, verify empty states render with correct icons when no data exists (e.g., empty sprint, no MRs, no epics)."
    expected: "Each view shows its specific EmptyState with the correct icon, title, and subtitle per the plan spec."
    why_human: "Requires running Tauri app with specific data conditions (empty sprint, no GitLab project, etc.)."
  - test: "Simulate a network error while cached data exists. Verify StaleDataBanner appears with 'Couldn't refresh -- showing cached data' message, Retry button, and dismiss X button."
    expected: "StaleDataBanner renders above cached data. Retry button triggers refetch. Dismiss button hides the banner."
    why_human: "Requires running Tauri app and simulating network failure (e.g., disconnect WiFi mid-session)."
  - test: "Note: CommandPalette uses inline SearchX JSX in CommandEmpty (not shared EmptyState component) -- intentional deviation documented in Phase 22 decisions."
    expected: "N/A -- design decision, not a defect."
    why_human: "Informational only."
---

# Phase 22: Polish -- Empty States + Error Recovery Verification Report

**Phase Goal:** Every data-driven view has a polished empty state, graceful error recovery with stale-data banner, and auth-aware error detection with Reconnect CTA

**Verified:** 2026-03-19T12:46:00Z
**Status:** human_needed (all automated checks pass -- 31/31 tests)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EmptyState component renders icon + title + optional subtitle + optional action | VERIFIED | `empty-state.tsx` (22 lines): accepts `icon: LucideIcon`, `title: string`, `subtitle?: string`, `action?: ReactNode`; renders icon with `size-12 text-muted-foreground`, title in `text-base font-medium`, conditional subtitle and action wrapper |
| 2 | Each of the 10 views uses EmptyState with its specific icon and title | VERIFIED | See Requirements Coverage POLISH-01 below -- all 10 views confirmed with file-path and line evidence |
| 3 | ErrorState component renders error message + Retry button | VERIFIED | `error-state.tsx` (53 lines): renders Alert with AlertCircle icon, "Couldn't load {viewName}" title, and "Retry" Button with `onClick={onRetry}` |
| 4 | ErrorState auto-detects auth errors and shows Reconnect CTA to /settings | VERIFIED | `error-state.tsx` lines 16-17: `const authError = isAuthError(error)` + `const source = getErrorSource(error)`. Lines 23-38: auth branch renders ShieldAlert icon, "Session expired" title, service-specific description, and "Reconnect" Button with `onClick={() => navigate('/settings')}` |
| 5 | StaleDataBanner renders retry + dismiss buttons | VERIFIED | `stale-data-banner.tsx` (24 lines): renders "Couldn't refresh -- showing cached data" text, "Retry" Button with `onClick={onRetry}`, and dismiss Button (X icon) with `onClick={onDismiss}` |
| 6 | Three-state detection pattern implemented in all 8 query-based views | VERIFIED | All 8 useQuery-based views implement: `isError && !data -> ErrorState`, `isError && data -> StaleDataBanner`, `!isError && empty -> EmptyState`. NotificationPopover uses store-level `fetchError/retryFetch`. CommandPalette uses inline SearchX JSX (intentional). |
| 7 | ApiError thrown on 401/403 in jira.ts and gitlab.ts | VERIFIED | `jira.ts`: ApiError imported at line 20, 20 `throw new ApiError(...)` sites (plus 3 re-throws). `gitlab.ts`: ApiError imported at line 16, 17 `throw new ApiError(...)` sites. All 401/403 responses produce structured ApiError with status + source. |

**Score:** 7/7 truths verified

---

## Required Artifacts

| Artifact | Status | Size | Key Evidence |
|----------|--------|------|--------------|
| `taskflow/src/lib/api-error.ts` | VERIFIED | 59 lines | Exports `ApiError` (extends Error, status + source fields), `isAuthError` (3-tier detection: ApiError.status, raw .status, message heuristic), `getErrorSource` |
| `taskflow/src/lib/api-error.test.ts` | VERIFIED | 61 lines | 12 tests covering ApiError construction, isAuthError (401, 403, 500, raw object, message heuristic, null), getErrorSource |
| `taskflow/src/components/ui/empty-state.tsx` | VERIFIED | 22 lines | EmptyState component with icon, title, subtitle, action props |
| `taskflow/src/components/ui/empty-state.test.tsx` | VERIFIED | 38 lines | 6 tests covering icon, title, subtitle presence/absence, action presence/absence |
| `taskflow/src/components/ui/error-state.tsx` | VERIFIED | 53 lines | ErrorState with isAuthError detection, auth branch (ShieldAlert + Reconnect), generic branch (AlertCircle + Retry), console.error logging |
| `taskflow/src/components/ui/error-state.test.tsx` | VERIFIED | 97 lines | 10 tests covering generic error, auth error (401 Jira, 403 GitLab), Reconnect navigation, Retry callback, logging |
| `taskflow/src/components/ui/stale-data-banner.tsx` | VERIFIED | 24 lines | StaleDataBanner with RefreshCw icon, "Couldn't refresh" text, Retry + dismiss (X) buttons |
| `taskflow/src/components/ui/stale-data-banner.test.tsx` | VERIFIED | 27 lines | 3 tests covering text display, onRetry callback, onDismiss callback |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| MyTasksTab.tsx | EmptyState | `import { EmptyState }` + render at line 371 | WIRED | `<EmptyState icon={ClipboardList} title="You're all caught up!" ...>` |
| MyTasksTab.tsx | ErrorState | `import { ErrorState }` + render at line 362 | WIRED | `<ErrorState error={error} onRetry={refetch} viewName="tasks" />` |
| MyTasksTab.tsx | StaleDataBanner | `import { StaleDataBanner }` + render at line 366 | WIRED | `<StaleDataBanner onRetry={refetch} onDismiss={...} />` |
| SprintBoardTab.tsx | EmptyState | `import { EmptyState }` + render at line 454 | WIRED | `<EmptyState icon={Columns3} title="No sprint issues" ...>` |
| SprintBoardTab.tsx | ErrorState | `import { ErrorState }` + render at line 436 | WIRED | `<ErrorState error={error} onRetry={refetch} viewName="sprint board" />` |
| SprintBoardTab.tsx | StaleDataBanner | `import { StaleDataBanner }` + render at line 443 | WIRED | `<StaleDataBanner onRetry={refetch} onDismiss={...} />` |
| SprintProgressTab.tsx | EmptyState | `import { EmptyState }` + render at line 204 | WIRED | `<EmptyState icon={BarChart3} title="No sprint data yet" ...>` |
| SprintProgressTab.tsx | ErrorState | `import { ErrorState }` + render at line 195 | WIRED | `<ErrorState error={error} onRetry={refetch} viewName="sprint progress" />` |
| SprintProgressTab.tsx | StaleDataBanner | `import { StaleDataBanner }` + render at line 199 | WIRED | `<StaleDataBanner onRetry={refetch} onDismiss={...} />` |
| BacklogPage.tsx | EmptyState | `import { EmptyState }` + render at line 513 | WIRED | `<EmptyState icon={Inbox} title="Backlog is empty" ... action={<Button>Create Issue</Button>}>` |
| BacklogPage.tsx | ErrorState | `import { ErrorState }` + render at line 492 | WIRED | `<ErrorState error={error} onRetry={refetch} viewName="backlog" />` |
| BacklogPage.tsx | StaleDataBanner | `import { StaleDataBanner }` + render at line 499 | WIRED | `<StaleDataBanner onRetry={refetch} onDismiss={...} />` |
| MrAttentionTab.tsx | EmptyState | `import { EmptyState }` + render at line 343 | WIRED | `<EmptyState icon={GitMerge} title="No merge requests need attention" ... action={<Button>Connect GitLab</Button>}>` |
| MrAttentionTab.tsx | ErrorState | `import { ErrorState }` + render at line 334 | WIRED | `<ErrorState error={error} onRetry={refetch} viewName="merge requests" />` |
| MrAttentionTab.tsx | StaleDataBanner | `import { StaleDataBanner }` + render at line 338 | WIRED | `<StaleDataBanner onRetry={refetch} onDismiss={...} />` |
| WorkloadTab.tsx | EmptyState | `import { EmptyState }` + render at line 349 | WIRED | `<EmptyState icon={Users} title="No workload data" ...>` |
| WorkloadTab.tsx | ErrorState | `import { ErrorState }` + render at line 337 | WIRED | `<ErrorState error={error} onRetry={refetch} viewName="workload" />` |
| WorkloadTab.tsx | StaleDataBanner | `import { StaleDataBanner }` + render at line 342 | WIRED | `<StaleDataBanner onRetry={refetch} onDismiss={...} />` |
| ReleasesTab.tsx | EmptyState | `import { EmptyState }` + render at line 258 | WIRED | `<EmptyState icon={Package} title="No releases found" ...>` |
| ReleasesTab.tsx | ErrorState | `import { ErrorState }` + render at line 247 | WIRED | `<ErrorState error={versionError} onRetry={refetch} viewName="releases" />` |
| ReleasesTab.tsx | StaleDataBanner | `import { StaleDataBanner }` + render at line 251 | WIRED | `<StaleDataBanner onRetry={refetch} onDismiss={...} />` |
| EpicsPage.tsx | EmptyState | `import { EmptyState }` + render at line 205 | WIRED | `<EmptyState icon={Layers} title="No epics yet" ... action={<Button>Create Epic</Button>}>` |
| EpicsPage.tsx | ErrorState | `import { ErrorState }` + render at line 158 | WIRED | `<ErrorState error={error} onRetry={refetch} viewName="epics" />` |
| EpicsPage.tsx | StaleDataBanner | `import { StaleDataBanner }` + render at line 165 | WIRED | `<StaleDataBanner onRetry={refetch} onDismiss={...} />` |
| NotificationPopover.tsx | EmptyState | `import { EmptyState }` + render at lines 183-216 | WIRED | Multiple EmptyState usages: Bell/"No notifications yet", BellOff/"All caught up", TicketCheck/"No Jira notifications", GitMerge/"No GitLab notifications" |
| NotificationPopover.tsx | ErrorState | `import { ErrorState }` + render at line 328 | WIRED | `<ErrorState error={fetchError} onRetry={retryFetch} viewName="notifications" />` -- uses store-level fetchError/retryFetch |
| NotificationPopover.tsx | notifications.store | `useNotificationsStore` for fetchError + retryFetch | WIRED | Lines 86-87: `fetchError` and `retryFetch` destructured from store |
| CommandPalette.tsx | SearchX (inline) | `import { SearchX }` + render in CommandEmpty at line 213 | WIRED | `<SearchX className="size-8 text-muted-foreground mb-2" />` in CommandEmpty -- intentional inline JSX (not shared EmptyState) |
| jira.ts | ApiError | `import { ApiError }` at line 20 | WIRED | 20 throw sites for 401/403 and other HTTP errors, 3 re-throws |
| gitlab.ts | ApiError | `import { ApiError }` at line 16 | WIRED | 17 throw sites for 401/403 and other HTTP errors |
| error-state.tsx | isAuthError | `import { isAuthError, getErrorSource }` at line 6 | WIRED | `const authError = isAuthError(error)` at line 16, gates auth branch rendering |
| error-state.tsx | useNavigate /settings | `useNavigate` + Reconnect CTA | WIRED | `const navigate = useNavigate()` at line 15; `onClick={() => navigate('/settings')}` at line 33 |

---

## Requirements Coverage

### POLISH-01: Empty States for All 10 Views

| # | View | Icon | Title | Subtitle | Action | Status |
|---|------|------|-------|----------|--------|--------|
| 1 | MyTasksTab.tsx (line 371) | ClipboardList | "You're all caught up!" | "No tasks assigned to you in the active sprint" | -- | SATISFIED |
| 2 | SprintBoardTab.tsx (line 454) | Columns3 | "No sprint issues" | "This board will populate when issues are added to the active sprint" | -- | SATISFIED |
| 3 | SprintProgressTab.tsx (line 204) | BarChart3 | "No sprint data yet" | "Sprint progress will appear once a sprint is active" | -- | SATISFIED |
| 4 | BacklogPage.tsx (line 513) | Inbox | "Backlog is empty" | "All issues are assigned to sprints" | Create Issue Button | SATISFIED |
| 5 | MrAttentionTab.tsx (line 343) | GitMerge | "No merge requests need attention" | "MRs requiring your review will appear here" | Connect GitLab Button (conditional) | SATISFIED |
| 6 | WorkloadTab.tsx (line 349) | Users | "No workload data" | "Team workload will appear when sprint issues have assignees" | -- | SATISFIED |
| 7 | ReleasesTab.tsx (line 258) | Package | "No releases found" | "Releases will appear once versions are created in Jira" | -- | SATISFIED |
| 8 | EpicsPage.tsx (line 205) | Layers | "No epics yet" | "Epics will appear once they are created in your project" | Create Epic Button | SATISFIED |
| 9 | NotificationPopover.tsx (lines 183-216) | Bell/BellOff/TicketCheck/GitMerge | "No notifications yet" / "All caught up" / source-specific | Context-specific subtitles | -- | SATISFIED |
| 10 | CommandPalette.tsx (line 212) | SearchX (inline) | "No results found" | "Try a different search term or check your spelling" | -- | SATISFIED (intentional inline JSX deviation) |

**POLISH-01 Status: SATISFIED** -- All 10 views have appropriate empty states with specific icons and titles.

### POLISH-02: Error States + Stale Data Banner for All 10 Views

| # | View | ErrorState | StaleDataBanner | Three-State Pattern | Status |
|---|------|-----------|----------------|-------------------|--------|
| 1 | MyTasksTab.tsx | line 362: `isError && !data` | line 366: `isError && data && !bannerDismissed` | Yes | SATISFIED |
| 2 | SprintBoardTab.tsx | line 434: `isError && !data` | line 441: `isError && data && !bannerDismissed` | Yes | SATISFIED |
| 3 | SprintProgressTab.tsx | line 195: `isError && !data` | line 198: `isError && data && !bannerDismissed` | Yes | SATISFIED |
| 4 | BacklogPage.tsx | line 490: `isError && !backlogView` | line 497: `isError && backlogView && !bannerDismissed` | Yes | SATISFIED |
| 5 | MrAttentionTab.tsx | line 334: `isError && !mrQueryData` | line 337: `isError && mrQueryData && !bannerDismissed` | Yes | SATISFIED |
| 6 | WorkloadTab.tsx | line 336: `isError && !data` | line 341: `isError && data && !bannerDismissed` | Yes | SATISFIED |
| 7 | ReleasesTab.tsx | line 245: `isError && !fixVersions` | line 250: `isError && fixVersions && !bannerDismissed` | Yes | SATISFIED |
| 8 | EpicsPage.tsx | line 156: `isError && !epicsData` | line 163: `isError && epicsData && !bannerDismissed` | Yes | SATISFIED |
| 9 | NotificationPopover.tsx | line 326: `fetchError && visibleItems.length === 0 && retryFetch` | N/A (store-level error, shows ErrorState only) | Store-based | SATISFIED |
| 10 | CommandPalette.tsx | N/A (reads from cache only, no direct API query) | N/A | N/A -- cache-only | SATISFIED (no query = no error state needed) |

**POLISH-02 Status: SATISFIED** -- All 10 views handle error states appropriately. 8 query-based views use the three-state pattern. NotificationPopover uses store-level error propagation. CommandPalette reads from cache only.

### POLISH-03: ApiError Throw Sites + ErrorState Reconnect CTA

**ApiError throw sites:**
- `jira.ts`: 20 `throw new ApiError(...)` sites + 3 re-throws (`if (err instanceof ApiError) throw err`). Imported at line 20.
- `gitlab.ts`: 17 `throw new ApiError(...)` sites. Imported at line 16.
- Both services throw `ApiError` with `status: 401` and `status: 403` for authentication/authorization failures, preserving the `source` field ('jira' | 'gitlab').

**ErrorState auth detection:**
- `error-state.tsx` line 6: `import { isAuthError, getErrorSource } from '@/lib/api-error'`
- `error-state.tsx` line 16: `const authError = isAuthError(error)` -- 3-tier detection (ApiError.status, raw .status, message heuristic)
- `error-state.tsx` line 17: `const source = getErrorSource(error)` -- extracts 'jira' | 'gitlab' from ApiError instances
- Auth branch (lines 23-38): ShieldAlert icon, "Session expired" title, "{Jira|GitLab} token may have been revoked or expired" description, "Reconnect" Button navigating to `/settings`

**POLISH-03 Status: SATISFIED** -- 37 ApiError throw sites across jira.ts and gitlab.ts. ErrorState auto-detects auth errors via isAuthError and renders Reconnect CTA to /settings with service-specific messaging.

---

## Test Results

| Test File | Tests | Result | Notes |
|-----------|-------|--------|-------|
| `src/lib/api-error.test.ts` | 12/12 | PASS | ApiError construction (2), isAuthError (7), getErrorSource (2), edge case null (1) |
| `src/components/ui/empty-state.test.tsx` | 6/6 | PASS | Icon rendering, title, subtitle presence/absence, action presence/absence |
| `src/components/ui/error-state.test.tsx` | 10/10 | PASS | Generic error (3), auth error (5), plain error non-auth (1), logging (1) |
| `src/components/ui/stale-data-banner.test.tsx` | 3/3 | PASS | Text display, onRetry callback, onDismiss callback |

**Total: 31/31 tests pass**

---

## Anti-Patterns Found

None. All Phase 22 tests pass cleanly with no warnings or errors in the test output.

---

## Human Verification Required

### 1. ErrorState with Auth Reconnect CTA

**Test:** Disconnect Jira credentials (clear token in Settings), then navigate to My Tasks or Sprint Board.
**Expected:** ErrorState alert appears with ShieldAlert icon, "Session expired" title, "Your Jira token may have been revoked or expired" description, and a "Reconnect" button. Clicking "Reconnect" navigates to /settings.
**Why human:** Requires running Tauri app with real Jira credentials to trigger a 401 ApiError from the service layer.

### 2. Empty States with Correct Icons

**Test:** With valid credentials but no data (e.g., empty sprint, no epics), navigate through each view.
**Expected:** Each view renders its specific EmptyState with the correct Lucide icon:
- My Tasks: ClipboardList + "You're all caught up!"
- Sprint Board: Columns3 + "No sprint issues"
- Sprint Progress: BarChart3 + "No sprint data yet"
- Backlog: Inbox + "Backlog is empty" + Create Issue button
- MR Attention: GitMerge + "No merge requests need attention"
- Workload: Users + "No workload data"
- Releases: Package + "No releases found"
- Epics: Layers + "No epics yet" + Create Epic button
- Notifications: Bell + "No notifications yet"
**Why human:** Requires running Tauri app with specific data conditions.

### 3. StaleDataBanner on Network Failure

**Test:** Load any view with data, then disconnect network (e.g., disable WiFi). Wait for the 60s refetch interval to fire.
**Expected:** StaleDataBanner appears above the cached data showing "Couldn't refresh -- showing cached data" with Retry and dismiss (X) buttons. Cached data remains visible below the banner.
**Why human:** Requires running Tauri app and simulating network failure.

### 4. CommandPalette Empty State (Intentional Deviation)

**Note:** CommandPalette uses inline `<SearchX>` JSX inside `CommandEmpty` instead of the shared `EmptyState` component. This is an intentional design decision documented in Phase 22 decisions: using the shared EmptyState would break cmdk's visibility logic for the CommandEmpty slot.

---

## Gaps Summary

No code gaps found. All three POLISH requirements are fully satisfied:

- **POLISH-01:** All 10 views have EmptyState components with specific icons, titles, subtitles, and optional actions
- **POLISH-02:** All 8 query-based views implement the three-state detection pattern (ErrorState / StaleDataBanner / EmptyState). NotificationPopover uses store-level error propagation. CommandPalette reads from cache only.
- **POLISH-03:** 37 ApiError throw sites across jira.ts (20) and gitlab.ts (17). ErrorState auto-detects auth via isAuthError (3-tier detection) and renders Reconnect CTA navigating to /settings with service-specific messaging.

All 31 Phase 22 component tests pass. The remaining items are human verification tests that require a running Tauri app to confirm visual rendering and end-to-end auth error flows.

---

_Verified: 2026-03-19T12:46:00Z_
_Verifier: Claude (gsd-executor)_
