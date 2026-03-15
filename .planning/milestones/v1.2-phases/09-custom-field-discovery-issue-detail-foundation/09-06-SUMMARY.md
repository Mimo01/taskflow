---
phase: 09-custom-field-discovery-issue-detail-foundation
plan: "06"
subsystem: ui
tags: [react, jira, tanstack-query, lucide-react, tauri, vitest, wiki-markup]

# Dependency graph
requires:
  - phase: 09-04
    provides: IssueDetailContent component structure with placeholder comment section
  - phase: 09-01
    provides: WikiRenderer component for rendering wiki markup
provides:
  - CommentComposer component with bold/italic/code/bullet wiki markup toolbar
  - Comment thread section in IssueDetailContent (newest-first, author + relativeTime + WikiRenderer)
  - Open in Jira button via @tauri-apps/plugin-opener openUrl
  - Textarea UI component (standard shadcn animate pattern)
affects: [09-07, 09-08, future-comment-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CommentComposer uses useMutation + invalidateQueries pattern for post-then-refresh"
    - "relativeTime inline utility using Intl.RelativeTimeFormat (zero-dependency)"
    - "applyMarkup helper for wiki toolbar: selectionStart/selectionEnd text wrapping"
    - "Comment thread rendered newest-first via [...comments].reverse()"

key-files:
  created:
    - taskflow/src/routes/dashboard/CommentComposer.tsx
    - taskflow/src/components/ui/textarea.tsx
  modified:
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx

key-decisions:
  - "CommentComposer uses readSecret('jira-pat') directly — no prop drilling of token"
  - "relativeTime inlined in IssueDetailContent — no dependency, avoids date-fns for this single utility"
  - "Textarea created as native <textarea> wrapper — shadcn add not available in env; pattern consistent with existing input.tsx"
  - "On submit, postComment receives text.trim() — prevents whitespace-only comments"

patterns-established:
  - "Post comment pattern: useMutation -> readSecret -> postComment -> onSuccess clears text + invalidates ['jira-issue-detail', issueKey, jiraBaseUrl]"
  - "Wiki toolbar pattern: applyMarkup(textarea, prefix, suffix) -> setState -> requestAnimationFrame focus restore"

requirements-completed: [ISSUE-07, ISSUE-08, ISSUE-09]

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 09 Plan 06: Comment Thread, Compose Box, and Open in Jira Summary

**Comment read/post thread with wiki markup compose toolbar and Tauri deep-link "Open in Jira" button added to issue detail view**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-13T23:54:00Z
- **Completed:** 2026-03-13T23:57:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Built `CommentComposer` with bold/italic/code/bullet wiki markup toolbar and useMutation submit flow
- Extended `IssueDetailContent` with full comment thread (newest-first, relativeTime, WikiRenderer per body)
- Added "Open in Jira" button calling `openUrl` from `@tauri-apps/plugin-opener`
- Created `textarea.tsx` UI component (native textarea, consistent with existing component patterns)
- All ISSUE-07, ISSUE-08, ISSUE-09 tests passing (20/20 in IssueDetailSheet.test.tsx)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build CommentComposer with wiki markup toolbar** - `76df759` (feat)
2. **Task 2: Add comment thread and Open in Jira to IssueDetailContent** - `7c69e41` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD tasks had combined RED+GREEN commits — tests written alongside implementation in same commit_

## Files Created/Modified
- `taskflow/src/routes/dashboard/CommentComposer.tsx` - New comment compose component with toolbar and useMutation
- `taskflow/src/components/ui/textarea.tsx` - Standard native textarea UI component
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` - Extended with comment thread + Open in Jira button
- `taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx` - ISSUE-07, 08, 09 tests filled in (todos -> real tests)

## Decisions Made
- `CommentComposer` reads its own Jira token via `readSecret('jira-pat')` rather than receiving it as a prop — consistent with how other mutation components (IssueDetailSidebar) handle auth
- `relativeTime` inlined as a local function rather than importing a library — the plan specified this zero-dependency approach from RESEARCH.md
- `Textarea` created manually following the existing `input.tsx` pattern since `npx shadcn add` is not available in the execution environment
- Text trimmed on submit (`text.trim()`) to prevent whitespace-only comments being posted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created Textarea UI component manually**
- **Found during:** Task 1 (CommentComposer creation)
- **Issue:** `@/components/ui/textarea` did not exist; plan noted "run `npx shadcn@latest add textarea`" as fallback but CLI is unavailable
- **Fix:** Created `textarea.tsx` as a native `<textarea>` wrapper following exact same pattern as existing `input.tsx`
- **Files modified:** `taskflow/src/components/ui/textarea.tsx`
- **Verification:** CommentComposer renders and tests pass with the component
- **Committed in:** `76df759` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Textarea creation was the only deviation — functionally identical to what shadcn would produce. No scope creep.

## Issues Encountered
- Full test suite shows 6 pre-existing failures in MyTasksTab, ReleasesTab, SubtasksPanel (unrelated to this plan's files). Documented in deferred-items.
- IssueDetailSheet.test.tsx was modified by editor auto-formatting during execution (ISSUE-04 tests expanded); all 20 tests in the file pass.

## Next Phase Readiness
- ISSUE-07, 08, 09 complete — comment read, post, and deep-link are functional
- IssueDetailContent is ready for plan 09-07 (custom field display) — comment section is below all content
- CommentComposer pattern established for any future compose UI components

---
*Phase: 09-custom-field-discovery-issue-detail-foundation*
*Completed: 2026-03-13*

## Self-Check: PASSED

- CommentComposer.tsx: FOUND
- textarea.tsx: FOUND
- IssueDetailContent.tsx: FOUND (verified openUrl + reverse() present)
- 09-06-SUMMARY.md: FOUND
- Commit 76df759 (Task 1): FOUND
- Commit 7c69e41 (Task 2): FOUND
- 20/20 tests passing in IssueDetailSheet.test.tsx
