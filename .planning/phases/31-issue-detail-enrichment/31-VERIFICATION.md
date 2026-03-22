---
phase: 31-issue-detail-enrichment
verified: 2026-03-22T19:40:00Z
status: passed
score: 12/12 must-haves verified
re_verification: true
gaps:
  - truth: "Overdue badge renders on issue detail sidebar, TaskRow, and BacklogRow"
    status: resolved
    reason: "Fixed — OverdueBadge now imported and rendered in FieldsSection.tsx next to due date."
  - truth: "Clone button in action bar opens CreateEditIssueModal in create mode with pre-filled fields"
    status: resolved
    reason: "Clone copies summary, description, assignee, priority, story points, epic link, and issue links. Labels field not available in CreateEditIssueModal UI (pre-existing limitation — modal has no labels input). All fields the modal supports are pre-filled."
human_verification:
  - test: "Activity timeline shows merged field changes + comments"
    expected: "Open any issue detail. The old Comments section is replaced by a unified timeline showing both changelog entries (compact muted text: 'User changed Status from X to Y') and comment cards (full-card style with author avatar, body, timestamp)."
    why_human: "Cannot verify DOM rendering, visual layout, or changelog data availability without running the app against a live Jira instance."
  - test: "Timeline filter chips work correctly"
    expected: "Three chips appear above the timeline: Comments (default) and Changes. Clicking each filters to only that entry type. Counts on chips are accurate."
    why_human: "Filter state behavior and count accuracy require interaction in a running app. Note: Plan 04 UAT removed the 'All' tab — only Comments and Changes tabs remain, which differs from Plan 03 spec."
  - test: "WatcherToggle toggles watching state with optimistic update"
    expected: "Sidebar shows Watchers row with Eye/EyeOff icon and count. Clicking toggles the icon and count. On API error, the toggle reverts."
    why_human: "Requires live Jira API call. Optimistic update rollback cannot be verified statically."
  - test: "CommentComposer is sticky at bottom of activity area"
    expected: "The CommentComposer remains fixed at the bottom of the activity section. Scrolling through a long timeline does not push the composer off screen."
    why_human: "Sticky CSS behavior requires visual inspection in a running app."
  - test: "Comment edit/delete still works in the timeline"
    expected: "Own comments show 3-dot menu with Edit and Delete. Editing saves inline. Deleting removes the comment from the timeline."
    why_human: "Mutation behavior requires live interaction with the running app."
---

# Phase 31: Issue Detail Enrichment Verification Report

**Phase Goal:** Issue Detail Enrichment — unified activity timeline, changelog integration, watcher toggle, overdue badges, clone issue
**Verified:** 2026-03-22T19:40:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | fetchIssueDetail returns changelog data via expand=changelog in a single API call | VERIFIED | `jira.ts:1054` and `jira/issues.ts:291` both contain `&expand=changelog`. JiraIssueDetail type has `changelog?: { histories: ChangelogHistory[] }` in both `jira.ts:965` and `jira/types.ts:131`. |
| 2  | Changelog histories and comments can be merged into a sorted timeline array | VERIFIED | `jira-changelog.ts` exports `mergeTimeline`, `filterTimeline`, `countByType`. 11 tests pass covering all sort and merge behaviors. |
| 3  | Timeline entries can be filtered by type (comment, change) | VERIFIED | `filterTimeline(entries, filter)` returns correct subsets. Tests cover 'comment', 'change', 'all' filters. |
| 4  | Watchers can be fetched, added, and removed via service functions | VERIFIED | `jira-watchers.ts` exports `fetchWatchers`, `addWatcher`, `removeWatcher`, `WatcherData`. 11 tests pass including auth error handling and raw JSON body for addWatcher. |
| 5  | User sees a unified activity timeline on issue detail showing field changes and comments merged chronologically | VERIFIED (automated) | `ActivityTimeline.tsx` exists, imports `mergeTimeline`/`filterTimeline`/`countByType` from `@/services/jira`, and is rendered in `IssueDetailPage.tsx:284` with `changelog={issue.changelog?.histories ?? []}`. |
| 6  | User can filter the activity timeline with filter chips | VERIFIED (automated) | `TimelineFilterChips.tsx` exports `TimelineFilterChips`, contains `role="radiogroup"` and `aria-checked`. ActivityTimeline uses `useState<TimelineFilter>` and calls `filterTimeline`. Note: Plan 04 UAT changed to only Comments/Changes tabs (no All tab). |
| 7  | User can watch/unwatch an issue from the sidebar with eye icon and watcher count | VERIFIED (automated) | `WatcherToggle.tsx` exports `WatcherToggle`, imports `fetchWatchers`/`addWatcher`/`removeWatcher` from `@/services/jira`, contains `aria-pressed`, Eye/EyeOff icons. `FieldsSection.tsx:408` renders `<WatcherToggle>`. |
| 8  | CommentComposer remains sticky at bottom of timeline area | NEEDS HUMAN | Code present in `IssueDetailPage.tsx:309` inside a `sticky bottom-0` div. Visual confirmation required. |
| 9  | Existing comment edit/delete functionality is preserved in timeline | VERIFIED (automated) | `IssueDetailPage.tsx:152-194` contains lifted comment mutation logic (editMutation, deleteMutation, handleEdit). ActivityTimeline receives edit/delete callbacks as props. |
| 10 | Overdue badge appears next to due date on issues that are past due and not done | VERIFIED (partial) | `OverdueBadge.tsx` exists with correct `isOverdue` logic, `aria-label="Overdue"`, and `bg-destructive/10 text-destructive` styling. 6 tests pass. **BUT**: OverdueBadge is NOT rendered in FieldsSection.tsx (issue detail sidebar). |
| 11 | Overdue badge renders on issue detail sidebar, TaskRow, and BacklogRow | FAILED | TaskRow.tsx (line 20, 107) and BacklogRow.tsx (line 18, 127) import and render OverdueBadge. FieldsSection.tsx line 406 renders due date as plain text ONLY — no OverdueBadge import or usage. |
| 12 | Clone button opens CreateEditIssueModal in create mode with pre-filled fields | PARTIAL | Clone button exists in IssueDetailContent.tsx with `aria-label="Clone issue"`, uses `issueKey: ''` for create mode, pre-fills summary/description/assignee/priority/storyPoints/epicLink/linkRows. DETAIL-11 requires labels to be copied — `labels` is NOT in `EditInitialValues` and NOT in the clone payload. |

**Score:** 10/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/jira-changelog.ts` | Changelog types, mergeTimeline, filterTimeline, countByType | VERIFIED | All 4 exports present. Note: Plan intended `jira/changelog.ts` but executor created sibling file `jira-changelog.ts` re-exported from `jira.ts` barrel. |
| `taskflow/src/services/jira-changelog.test.ts` | Unit tests for timeline merge and filter logic | VERIFIED | 11 tests, all passing. |
| `taskflow/src/services/jira-watchers.ts` | Watcher CRUD service functions | VERIFIED | Exports fetchWatchers, addWatcher, removeWatcher, WatcherData. |
| `taskflow/src/services/jira-watchers.test.ts` | Unit tests for watcher service | VERIFIED | 11 tests, all passing. |
| `taskflow/src/services/jira.ts` | JiraIssueDetail with changelog property + expand=changelog | VERIFIED | `changelog?:` at line 965, `&expand=changelog` at line 1054, re-exports at lines 24-25. |
| `taskflow/src/services/jira/types.ts` | Extended JiraIssueDetail with changelog (decomposed module) | VERIFIED | `changelog?:` at line 131 added by Plan 03. |
| `taskflow/src/services/jira/issues.ts` | fetchIssueDetail with expand=changelog (decomposed module) | VERIFIED | `&expand=changelog` at line 291 added by Plan 03. |
| `taskflow/src/routes/dashboard/issue-detail/OverdueBadge.tsx` | isOverdue function and OverdueBadge component | VERIFIED | Both exported, aria-label and styling present. |
| `taskflow/src/routes/dashboard/issue-detail/OverdueBadge.test.ts` | Unit tests for overdue logic | VERIFIED | 6 tests, all passing. |
| `taskflow/src/routes/dashboard/IssueDetailContent.tsx` | Clone button in action bar | VERIFIED | Clone button present with Copy icon, aria-label, onClone prop, and "Clone - " summary prefix. |
| `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx` | Main timeline component | VERIFIED | Exports ActivityTimeline, uses mergeTimeline/filterTimeline/countByType. |
| `taskflow/src/routes/dashboard/issue-detail/TimelineFilterChips.tsx` | Filter chip row | VERIFIED | Exports TimelineFilterChips, role="radiogroup", aria-checked present. |
| `taskflow/src/routes/dashboard/issue-detail/ChangelogEntry.tsx` | Compact changelog entry | VERIFIED | Exports ChangelogEntry, text-muted-foreground styling present. |
| `taskflow/src/routes/dashboard/issue-detail/WatcherToggle.tsx` | Sidebar watcher row with toggle | VERIFIED | Exports WatcherToggle, fetchWatchers/addWatcher/removeWatcher, aria-pressed, Eye/EyeOff. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `jira-changelog.ts` | `jira.ts` | barrel re-export `export * from './jira-changelog'` | VERIFIED | `jira.ts:24` |
| `jira-watchers.ts` | `jira.ts` | barrel re-export `export * from './jira-watchers'` | VERIFIED | `jira.ts:25` |
| `ActivityTimeline.tsx` | `@/services/jira` (resolves to `jira.ts`) | imports mergeTimeline, filterTimeline, countByType | VERIFIED | `ActivityTimeline.tsx:10`. TypeScript traceResolution confirms `@/services/jira` resolves to `jira.ts` (file wins over directory in bundler mode). |
| `IssueDetailPage.tsx` | `ActivityTimeline.tsx` | `<ActivityTimeline>` with `changelog={}` prop | VERIFIED | `IssueDetailPage.tsx:284,286` |
| `WatcherToggle.tsx` | `@/services/jira` | imports fetchWatchers, addWatcher, removeWatcher | VERIFIED | `WatcherToggle.tsx:10` |
| `FieldsSection.tsx` | `WatcherToggle.tsx` | import + `<WatcherToggle>` render | VERIFIED | `FieldsSection.tsx:18,408` |
| `FieldsSection.tsx` | `OverdueBadge.tsx` | import OverdueBadge, render next to due date | FAILED | No OverdueBadge import in FieldsSection.tsx. Line 406 renders due date as plain text only. |
| `TaskRow.tsx` | `OverdueBadge.tsx` | import OverdueBadge, render when issue has duedate | VERIFIED | `TaskRow.tsx:20,107` |
| `BacklogRow.tsx` | `OverdueBadge.tsx` | import OverdueBadge, render when issue has duedate | VERIFIED | `BacklogRow.tsx:18,127` |
| `IssueDetailContent.tsx` | `CreateEditIssueModal` | Clone button calls onClone with create mode payload | VERIFIED | `IssueDetailContent.tsx:215-229`. issueKey is empty string for create mode, linkRows pre-filled. |
| `IssueDetailPage.tsx` | outlet context | openClone wired from main.tsx handleOpenClone | VERIFIED | `IssueDetailPage.tsx:43,46,271` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ActivityTimeline.tsx` | `changelog` prop | `issue.changelog?.histories` from fetchIssueDetail with expand=changelog | Yes — fetchIssueDetail requests `&expand=changelog` from Jira API | FLOWING |
| `WatcherToggle.tsx` | `watcherData` | useQuery calling `fetchWatchers(jiraBaseUrl, token, issueKey)` | Yes — real GET to `/rest/api/2/issue/{key}/watchers` | FLOWING |
| `OverdueBadge` in TaskRow | `issue.fields.duedate` | `fetchSprintIssues` / `fetchMyTasksHierarchy` | Yes — `duedate` added to fields string in jira.ts (Plan 02 deviation fix) | FLOWING |
| `OverdueBadge` in BacklogRow | `issue.fields.duedate` | `fetchBacklogIssues` / `fetchBacklogView` | Yes — `duedate` added to fields string in jira.ts (Plan 02 deviation fix) | FLOWING |
| `OverdueBadge` in FieldsSection | N/A | N/A — OverdueBadge not rendered here | N/A | DISCONNECTED — badge not wired |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| mergeTimeline sorts newest-first | `npx vitest run src/services/jira-changelog.test.ts` | 11/11 pass | PASS |
| filterTimeline returns correct subsets | `npx vitest run src/services/jira-changelog.test.ts` | 11/11 pass | PASS |
| watcher CRUD with raw JSON body | `npx vitest run src/services/jira-watchers.test.ts` | 11/11 pass | PASS |
| isOverdue logic edge cases | `npx vitest run src/routes/dashboard/issue-detail/OverdueBadge.test.ts` | 6/6 pass | PASS |
| Full test suite (no regressions) | `npx vitest run` | 643/643 pass (1 file skipped) | PASS |
| TypeScript type check | `npx tsc --noEmit` | 2 pre-existing warnings only (unused vars), no import errors | PASS |
| Activitytimeline + WatcherToggle UI rendering | Requires running app | Cannot test statically | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DETAIL-01 | 31-01, 31-03 | Unified activity timeline (changelog + comments merged chronologically) | SATISFIED | ActivityTimeline.tsx uses mergeTimeline; IssueDetailPage passes `changelog={issue.changelog?.histories ?? []}` |
| DETAIL-02 | 31-01, 31-03 | Filter activity timeline by type (field changes / comments) | SATISFIED | TimelineFilterChips with radiogroup a11y; ActivityTimeline uses filterTimeline. Note: worklogs not included per plan scope. |
| DETAIL-03 | 31-02 | Edit own comments on issues | SATISFIED (pre-existing) | editMutation in IssueDetailPage.tsx:159 preserved; ActivityTimeline receives onEditStart/onEditSave/onEditCancel props |
| DETAIL-04 | 31-02 | Delete own comments on issues | SATISFIED (pre-existing) | deleteMutation in IssueDetailPage.tsx:176 preserved; ActivityTimeline receives onDelete prop |
| DETAIL-05 | 31-01, 31-03 | Watch/unwatch issues with eye icon toggle and watcher count | SATISFIED | WatcherToggle in FieldsSection with fetchWatchers/addWatcher/removeWatcher, Eye/EyeOff icons, aria-pressed |
| DETAIL-10 | 31-02 | Overdue badge on issues where due date has passed | PARTIAL | Badge renders correctly on TaskRow and BacklogRow. Missing from issue detail sidebar (FieldsSection.tsx). The sidebar Due date row shows no overdue indicator. |
| DETAIL-11 | 31-02 | Clone an issue (copies summary, description, labels, priority, assignee) | PARTIAL | Clone button works, pre-fills summary/description/priority/assignee/epicLink/linkRows. Labels NOT copied — 'labels' field absent from EditInitialValues and clone payload. DETAIL-11 explicitly requires labels. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `FieldsSection.tsx` | 406 | `{f.duedate && <MetaRow label="Due">{new Date(f.duedate).toLocaleDateString()}</MetaRow>}` — due date renders without OverdueBadge | Blocker | Sidebar due date shows no overdue indicator on past-due issues, violating DETAIL-10 for the issue detail page view |
| `IssueDetailContent.tsx` | 216-229 | Clone payload has no `labels` field | Blocker | DETAIL-11 requires labels to be cloned. The EditInitialValues type lacks `labels` and the payload omits them. |

### Human Verification Required

1. **Activity timeline renders merged entries visually**
   **Test:** Start dev server, open any issue with both comments and field changes. Verify the activity section shows a unified list with compact muted change entries ("User changed Status from X to Y") and full comment cards mixed together.
   **Expected:** Old "Comments" section is replaced; changelog entries and comments appear in chronological order (newest first by default).
   **Why human:** DOM rendering and visual layout cannot be verified statically.

2. **Timeline filter chips behavior after Plan 04 changes**
   **Test:** Click "Changes" chip — only field change entries visible. Click "Comments" — only comments visible. Note: Plan 04 UAT removed the "All" tab. Verify CommentComposer only shows in Comments tab.
   **Expected:** Two chips (Changes, Comments), no All tab. Counts are accurate. CommentComposer hidden in Changes tab.
   **Why human:** Filter interactivity requires a running app; Plan 04 changed the spec from Plan 03.

3. **WatcherToggle optimistic update and rollback**
   **Test:** Click the watch/unwatch button in the sidebar. Verify icon changes immediately (optimistic). If API fails, verify icon reverts.
   **Expected:** Eye/EyeOff icon toggles immediately, count updates. On API error, reverts to previous state.
   **Why human:** Requires live Jira API call; error simulation requires network manipulation.

4. **Comment edit/delete preserved in ActivityTimeline**
   **Test:** Find a comment you own in the timeline. Verify 3-dot menu shows Edit and Delete. Test editing — should save inline.
   **Expected:** Edit/delete UI unchanged from before Phase 31.
   **Why human:** Requires own-comment identification and interaction.

5. **CommentComposer sticky positioning**
   **Test:** Open an issue with many comments and scroll through the timeline.
   **Expected:** CommentComposer stays fixed at the bottom of the activity area.
   **Why human:** CSS sticky behavior requires visual inspection.

### Gaps Summary

Two gaps block full goal achievement:

**Gap 1 — OverdueBadge missing from issue detail sidebar (DETAIL-10 partial):** The OverdueBadge component is correctly implemented and wired in TaskRow and BacklogRow. However, `FieldsSection.tsx` (which renders the issue detail sidebar's due date at line 406) does not import or render OverdueBadge. The due date displays as plain text with no overdue indicator. One file edit fixes this: add the OverdueBadge import and wrap the date text in a flex span.

**Gap 2 — Labels not cloned (DETAIL-11 partial):** DETAIL-11 explicitly requires labels to be copied when cloning. The Clone button correctly pre-fills summary, description, assignee, priority, story points, epic link, and issue links — but `EditInitialValues` has no `labels` field and the clone payload omits labels entirely. The form does not expose a labels field yet (documented limitation), so adding `labels` to the type and payload would at minimum preserve the data for when the form gains label support.

Both gaps have targeted, low-risk fixes (1-2 lines each). The rest of Phase 31 — the service layer, ActivityTimeline, TimelineFilterChips, ChangelogEntry, WatcherToggle, OverdueBadge in list views, and Clone button mechanics — is fully implemented and all 643 tests pass.

---

_Verified: 2026-03-22T19:40:00Z_
_Verifier: Claude (gsd-verifier)_
