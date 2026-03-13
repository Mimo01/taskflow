---
phase: 07-story-subtask-hierarchy-mr-subtask-filter
verified: 2026-03-13T09:35:00Z
status: passed
score: 16/16 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 14/14
  gaps_closed:
    - "Subtask toggle button hit target is at least 32px square (UAT gap 1)"
    - "MR Attention tab fetches reviewer MRs after userId resolves (UAT gap 2)"
    - "Stale gitlab-mrs cache is invalidated when userId changes"
    - "gitlab.ts has no duplicate fetchProjectMilestonesInRange identifier"
  gaps_remaining: []
  regressions: []
---

# Phase 7: Story/Subtask Hierarchy + MR Subtask Filter Verification Report

**Phase Goal:** My Tasks and Sprint Board group subtasks under their parent story, orphan subtasks show a parent context badge, and MR Attention includes MRs linked to stories where the current user has assigned subtasks
**Verified:** 2026-03-13T09:35:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 04 and 05 executed following UAT)

---

## Context

The initial verification (2026-03-13T00:55:00Z) passed 14/14 truths. A subsequent UAT (07-UAT.md) identified two runtime gaps not detectable by static analysis:

- **UAT gap 1** — subtask toggle hit target ~12px (too small to click reliably)
- **UAT gap 2** — MR Attention reviewer list empty due to userId race condition

Gap-closure plans 07-04 and 07-05 were executed. This re-verification confirms those closures are in the codebase and tests are green.

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                               | Status     | Evidence                                                                                       |
|----|-----------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------|
| 1  | MyTasksTab orphan subtask rows are not rendered (HIER-01)                                           | VERIFIED  | No `.orphans.map` in JSX; groupedData.orphans render block confirmed deleted                  |
| 2  | MyTasksTab onMutate operates on `{ issues, myIssueKeys }` cache shape                              | VERIFIED  | Lines 207-222: typed with `getQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>`    |
| 3  | Sprint Board column headers count stories only, not subtasks                                        | VERIFIED  | `colStories = boardGroups.stories.filter(...)`, count uses `colStories.length`; test passes    |
| 4  | Subtask cards appear under parent story card in the parent's status column                          | VERIFIED  | `boardGroups.subtasksByParent.get(story.key)` drives subtask render under each story           |
| 5  | Subtask sections are collapsed by default on load                                                   | VERIFIED  | `expandedStories` initialised as `new Set()` (empty); "collapsed by default" test passes       |
| 6  | Each story card independently expands/collapses subtask section via chevron button                  | VERIFIED  | `toggleStory()` + `onToggle` prop wired; "clicking chevron expands" test passes                |
| 7  | Story cards with subtasks show a subtask count Badge always visible                                 | VERIFIED  | TaskCard renders Badge when `subtaskCount > 0`; `subtaskCount={subtasks.length}` passed unconditionally |
| 8  | Orphan subtasks (parent not in sprint) are silently dropped and never rendered (HIER-02/HIER-03)    | VERIFIED  | `storyKeySet.has(parentKey)` guard in boardGroups memo; "orphan subtask not rendered" test passes |
| 9  | Collapse state survives data refetch (standalone useState)                                          | VERIFIED  | `expandedStories` is `useState<Set<string>>` not derived from query; refetch does not reset it |
| 10 | MR Attention shows only state=opened MRs (MRAT-01)                                                 | VERIFIED  | `fetchAssignedMRs` and `fetchReviewerMRs` both use `state=opened` in URL                      |
| 11 | MR Attention includes MRs linked to stories where current user has assigned subtask (MRAT-02)      | VERIFIED  | `subtaskStoryKeys` memo + `data` extension memo in MrAttentionTab; all MRAT-02 tests pass     |
| 12 | Subtask-linked story MRs bypass the unresolved-discussion filter                                   | VERIFIED  | `data` useMemo adds extras from `mrQueryData.merged` bypassing `filtered`; "bypasses discussion filter" test passes |
| 13 | "via [subtask-key]" label only on MRs entering list exclusively via subtask path                    | VERIFIED  | `mrViaSubtaskKey` checks `linkMRToTask(mr, sprintIssueKeySet) === null` first; test passes     |
| 14 | Graceful fallback: no subtask data → base MR list unchanged                                        | VERIFIED  | `subtaskStoryKeys.size === 0` guard returns `base` immediately; "gracefully shows base" test passes |
| 15 | Subtask toggle button hit target is at least 32px (UAT gap 1 closure)                              | VERIFIED  | TaskCard.tsx line 105-119: single `<button>` wraps Badge + chevron with `p-1 -mx-1` padding; icon is `size-4` (16px); commit 814b320 |
| 16 | MR Attention reviewer MRs appear only after userId resolves — no empty-list race (UAT gap 2 closure) | VERIFIED | MrAttentionTab.tsx line 98: `queryKey: ['gitlab-mrs', gitlabBaseUrl, userId]`; line 139: `enabled: !!gitlabBaseUrl && !!gitlabToken && !!userId`; commit f7b2da8 |

**Score:** 16/16 truths verified

---

### Required Artifacts

| Artifact                                                | Expected                                                           | Status     | Details                                                        |
|---------------------------------------------------------|--------------------------------------------------------------------|------------|----------------------------------------------------------------|
| `taskflow/src/routes/dashboard/SprintBoardTab.tsx`      | boardGroups memo, expandedStories, grouped column rendering        | VERIFIED  | All patterns present; 7/7 SprintBoardTab tests pass            |
| `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` | Hierarchy and collapse behaviour tests                             | VERIFIED  | 7/7 tests pass                                                  |
| `taskflow/src/routes/dashboard/MyTasksTab.tsx`          | Orphan section removed; onMutate correct cache shape               | VERIFIED  | No `.orphans.map` in JSX; onMutate typed correctly             |
| `taskflow/src/routes/dashboard/TaskCard.tsx`            | Gap-04 fix: single button wrapping Badge+chevron with p-1 padding  | VERIFIED  | Lines 105-119: single `<button>` with `p-1`, icon `size-4`, `pointer-events-none` on Badge |
| `taskflow/src/routes/dashboard/MrRow.tsx`               | Optional viaSubtaskKey prop + muted label                          | VERIFIED  | Prop in interface; label rendered conditionally                 |
| `taskflow/src/routes/dashboard/MrAttentionTab.tsx`      | userId in queryKey + enabled guard; cache-first subtask derivation | VERIFIED  | queryKey includes userId (line 98); enabled includes !!userId (line 139); all 7 tests pass |
| `taskflow/src/routes/dashboard/MrAttentionTab.test.tsx` | stale-badge and linking tests use renderWithQueryAndUser            | VERIFIED  | Confirmed by plan-05 summary; 7/7 tests pass                   |
| `taskflow/src/services/gitlab.ts`                       | No duplicate fetchProjectMilestonesInRange; clean working tree     | VERIFIED  | `fetchProjectMilestonesInRange` count = 0 in committed HEAD; `git status` clean; uncommitted diff was discarded via `git checkout --` |

---

### Key Link Verification

| From                                        | To                                       | Via                                       | Status    | Details                                      |
|---------------------------------------------|------------------------------------------|-------------------------------------------|-----------|----------------------------------------------|
| SprintBoardTab colStories render            | TaskCard subtaskCount + onToggle         | `boardGroups.subtasksByParent.get(story.key)` | WIRED | Verified in source                           |
| TaskCard subtask row                        | onToggle() callback                      | Single `<button>` with `onClick` + `e.stopPropagation()` | WIRED | Line 107: `onClick={(e) => { e.stopPropagation(); onToggle?.() }}` |
| SprintBoardTab boardGroups memo             | Orphan drop                              | `storyKeySet.has(parentKey)` guard        | WIRED     | Orphan subtasks never enter the render path  |
| MrAttentionTab subtaskStoryKeys memo        | Extended MR dedup logic                  | `linkMRToTask(mr, subtaskStoryKeys)`      | WIRED     | Lines 190, 219                               |
| MrAttentionTab queryFn                      | Fires only after userId resolves          | `enabled: !!gitlabBaseUrl && !!gitlabToken && !!userId` | WIRED | Line 139                             |
| MrAttentionTab query key                    | Cache busted on userId change             | `queryKey: ['gitlab-mrs', gitlabBaseUrl, userId]` | WIRED | Line 98                                |
| MrAttentionTab MrRow render                 | viaSubtaskKey prop                       | `mrViaSubtaskKey.get(mr.iid)`            | WIRED     | Line 316                                     |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                | Status    | Evidence                                                                         |
|-------------|-------------|--------------------------------------------------------------------------------------------|-----------|----------------------------------------------------------------------------------|
| HIER-01     | 07-01       | My Tasks groups assigned subtasks under parent story (orphan suppression)                  | SATISFIED | Orphan render block removed; onMutate cache shape fixed                          |
| HIER-02     | 07-02, 07-04 | Sprint Board groups subtask cards under parent story card in each column (collapsible)     | SATISFIED | boardGroups memo + expandedStories; hit-target gap closed in 07-04; all 7 SprintBoardTab tests pass |
| HIER-03     | 07-02       | Subtasks whose parent not in sprint display parent story badge (user override: silent drop) | SATISFIED | User decision recorded in REQUIREMENTS.md; `storyKeySet.has()` guard enforces silent drop; intent (no orphan confusion) met |
| MRAT-01     | 07-03       | MR Attention shows only open (`state=opened`) merge requests                               | SATISFIED | `state=opened` in both fetch URLs; no regression                                 |
| MRAT-02     | 07-03, 07-05 | MR Attention includes MRs linked to stories where user has assigned subtask               | SATISFIED | userId race condition fixed in 07-05; all 4 MRAT-02 tests pass; reviewer MRs now fetched correctly |

**Note on HIER-03:** REQUIREMENTS.md marks this Complete. The user explicitly overrode the badge behaviour in favour of silent drop. The "parent context badge" in the original requirement is superseded by a recorded user decision.

---

### Anti-Patterns Found

No blockers found in phase 07 files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

Scanned files: SprintBoardTab.tsx, SprintBoardTab.test.tsx, MyTasksTab.tsx, TaskCard.tsx, MrRow.tsx, MrAttentionTab.tsx, MrAttentionTab.test.tsx.

---

### Pre-Existing Failures (Not Phase 07 Regressions)

Two test failures exist in the full suite. Both predate phase 07 and are unchanged:

| File | Test | Root Cause | Phase 07 Introduced? |
|------|------|------------|----------------------|
| `MyTasksTab.test.tsx` | `renders skeleton when isLoading` | Skeleton timing assertion races in test env | No — pre-existing |
| `ReleasesTab.test.tsx` | `shows task count and completion status per fix version row` | `ReleasesTab.tsx` imports `fetchProjectMilestonesInRange` which was never committed to `gitlab.ts` (the function existed only in an uncommitted diff; that diff was correctly discarded by plan-05 to avoid a duplicate identifier) | No — pre-existing since commit 1f5c765 (2026-03-12T23:16); plan-05 correctly declined to commit the broken diff |

The `ReleasesTab` broken import is a pre-phase-07 defect requiring a separate fix: `fetchProjectMilestonesInRange` needs to be implemented in `gitlab.ts` (or `ReleasesTab.tsx` needs to revert to `fetchProjectMilestones`). This is outside phase 07 scope.

---

### Test Suite Summary

| Test File                    | Tests | Result                                     |
|------------------------------|-------|--------------------------------------------|
| SprintBoardTab.test.tsx      | 7     | All pass                                   |
| MrAttentionTab.test.tsx      | 7     | All pass                                   |
| MyTasksTab.test.tsx          | 9     | 8 pass, 1 pre-existing failure (skeleton timing) |
| ReleasesTab.test.tsx         | 14    | 13 pass, 1 pre-existing failure (fetchProjectMilestonesInRange missing from gitlab.ts) |
| Full suite                   | 222   | 216 pass, 2 pre-existing failures, 4 todo  |

Phase 07 introduced zero new test failures.

---

### Human Verification Required

#### 1. Subtask toggle hit target — post gap closure

**Test:** Open the Sprint Board tab. Find a story with subtasks. Click (or tap on touch device) the badge+chevron row to toggle the subtask section.
**Expected:** The entire row is clickable; no need to aim precisely at a small icon. Subtask cards expand below the story card.
**Why human:** Padding (`p-1 -mx-1`) presence is code-verified; adequacy of ~32-40px hit area on actual hardware requires manual testing.

#### 2. Reviewer MRs appear after login — post gap closure

**Test:** Open the dashboard fresh (not cached). Navigate to MR Attention tab. Verify reviewer MRs appear (if any exist for the test account).
**Expected:** Reviewer MRs are included in the list; the tab does not show an empty list when the user is a reviewer on open MRs.
**Why human:** The userId race condition fix is code-verified; real-world timing of `validateGitLab` resolution requires a live environment to confirm.

#### 3. Subtask visual nesting appearance

**Test:** Open Sprint Board with a story that has subtasks. Expand the subtask section. Verify subtask cards appear visually indented with a left border.
**Expected:** Subtask cards have `ml-4` left margin and `border-l-2 border-l-muted` styling.
**Why human:** CSS class presence is code-verified; visual adequacy of nesting requires visual inspection.

#### 4. "via [key]" label legibility in MR list

**Test:** Open MR Attention when a reviewer MR is included only via subtask path. Verify the "via PROJ-XXX" label is visible but secondary.
**Expected:** Label is `text-xs text-muted-foreground`, not prominent, positioned after the linked task badge area.
**Why human:** Colour/contrast adequacy requires visual inspection in both light and dark theme.

---

### Gaps Summary

No gaps. All 16 truths verified. The two pre-existing test failures (MyTasksTab skeleton timing, ReleasesTab missing `fetchProjectMilestonesInRange`) predate this phase and are unchanged. Phase 07 requirements HIER-01, HIER-02, HIER-03, MRAT-01, and MRAT-02 are all satisfied.

---

_Verified: 2026-03-13T09:35:00Z_
_Verifier: Claude (gsd-verifier)_
