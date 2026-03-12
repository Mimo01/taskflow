---
phase: 07-story-subtask-hierarchy-mr-subtask-filter
verified: 2026-03-13T00:55:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 7: Story/Subtask Hierarchy + MR Subtask Filter Verification Report

**Phase Goal:** Implement story/subtask hierarchy in SprintBoardTab and extend MrAttentionTab to include MRs linked to stories with assigned subtasks for the current user.
**Verified:** 2026-03-13T00:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                     | Status     | Evidence                                                                 |
|----|-------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------|
| 1  | MyTasksTab orphan subtask rows are not rendered (HIER-01)                                | VERIFIED  | `groupedData.orphans` render block deleted; grep finds no `.orphans.map` in JSX |
| 2  | MyTasksTab onMutate operates on `{ issues, myIssueKeys }` cache shape                    | VERIFIED  | Lines 207-222: `getQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>` + `setQueryData` with same type |
| 3  | Sprint Board column headers count stories only, not subtasks                              | VERIFIED  | `colStories = boardGroups.stories.filter(...)`, count uses `colStories.length`; test passes |
| 4  | Subtask cards appear under parent story card in the parent's status column                | VERIFIED  | `boardGroups.subtasksByParent.get(story.key)` drives subtask render under each story |
| 5  | Subtask sections are collapsed by default on load                                         | VERIFIED  | `expandedStories` initialised as `new Set()` (empty); test "subtask section is collapsed by default" passes |
| 6  | Each story card independently expands/collapses subtask section via chevron button        | VERIFIED  | `toggleStory()` + `onToggle` prop wired; "clicking chevron expands" test passes |
| 7  | Story cards with subtasks show a subtask count Badge always visible                       | VERIFIED  | TaskCard renders Badge when `subtaskCount > 0`; `subtaskCount={subtasks.length}` passed unconditionally |
| 8  | Orphan subtasks (parent not in sprint) are silently dropped and never rendered (HIER-02/HIER-03) | VERIFIED | `storyKeySet.has(parentKey)` guard in `boardGroups` memo; "orphan subtask not rendered" test passes |
| 9  | Collapse state survives data refetch (standalone useState)                                | VERIFIED  | `expandedStories` is `useState<Set<string>>` not derived from query; refetch does not reset it |
| 10 | MR Attention shows only state=opened MRs (MRAT-01)                                      | VERIFIED  | `fetchAssignedMRs` and `fetchReviewerMRs` both use `state=opened` in URL (gitlab.ts lines 211, 246) |
| 11 | MR Attention includes MRs linked to stories where current user has assigned subtask (MRAT-02) | VERIFIED | `subtaskStoryKeys` memo + `data` extension memo in MrAttentionTab; MRAT-02 tests pass |
| 12 | Subtask-linked story MRs bypass the unresolved-discussion filter                         | VERIFIED  | `data` useMemo adds extras from `mrQueryData.merged` bypassing `filtered`; test "bypasses discussion filter" passes |
| 13 | "via [subtask-key]" label only on MRs entering list exclusively via subtask path          | VERIFIED  | `mrViaSubtaskKey` checks `linkMRToTask(mr, sprintIssueKeySet) === null` first; test "does not show via label on sprint path" passes |
| 14 | Graceful fallback: no subtask data → base MR list unchanged                              | VERIFIED  | `subtaskStoryKeys.size === 0` guard returns `base` immediately; test "gracefully shows base MR list" passes |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact                                                | Expected                                              | Status     | Details                                               |
|---------------------------------------------------------|-------------------------------------------------------|------------|-------------------------------------------------------|
| `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` | Wave 0 stubs + infrastructure tests                   | VERIFIED  | 7/7 tests pass; all 4 HIER-02 behavior stubs now GREEN |
| `taskflow/src/routes/dashboard/MyTasksTab.tsx`          | Orphan section removed; onMutate correct cache shape  | VERIFIED  | No `.orphans.map` in JSX; onMutate typed correctly     |
| `taskflow/src/routes/dashboard/TaskCard.tsx`            | Extended props: subtaskCount, isExpanded, onToggle, isSubtask | VERIFIED | All 4 props in interface and implemented; existing callers unaffected |
| `taskflow/src/routes/dashboard/SprintBoardTab.tsx`      | boardGroups memo, expandedStories, grouped column rendering | VERIFIED | All patterns present and wired; `expandedStories` confirmed standalone |
| `taskflow/src/routes/dashboard/MrRow.tsx`               | Optional viaSubtaskKey prop + muted label             | VERIFIED  | Prop in interface; label rendered conditionally at line 93 |
| `taskflow/src/routes/dashboard/MrAttentionTab.tsx`      | Cache-first subtask derivation, extended MR list, viaSubtaskKey to MrRow | VERIFIED | All three concerns implemented and tested |

---

### Key Link Verification

| From                                      | To                                    | Via                              | Status    | Details                                          |
|-------------------------------------------|---------------------------------------|----------------------------------|-----------|--------------------------------------------------|
| SprintBoardTab colStories render          | TaskCard subtaskCount + onToggle      | `boardGroups.subtasksByParent.get(story.key)` | WIRED | Line 195 + 204                           |
| TaskCard chevron button                   | onToggle() callback                   | `onClick` with `e.stopPropagation()` | WIRED | Line 111                                   |
| SprintBoardTab boardGroups memo           | Orphan drop                           | `storyKeySet.has(parentKey)` guard | WIRED | Line 122                                    |
| MrAttentionTab subtaskStoryKeys memo      | Extended MR dedup logic               | `linkMRToTask(mr, subtaskStoryKeys)` | WIRED | Lines 190, 219                            |
| MrAttentionTab queryFn                    | Subtask-linked MRs always included    | `mrQueryData.merged` bypass      | WIRED     | Lines 185-197: extras pulled from pre-filter pool |
| MrAttentionTab MrRow render               | viaSubtaskKey prop                    | `mrViaSubtaskKey.get(mr.iid)`    | WIRED     | Line 316                                         |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                             | Status    | Evidence                                                    |
|-------------|-------------|-----------------------------------------------------------------------------------------|-----------|-------------------------------------------------------------|
| HIER-01     | 07-01       | My Tasks groups assigned subtasks under parent story (orphan suppression)               | SATISFIED | Orphan render block removed; onMutate cache shape fixed     |
| HIER-02     | 07-02       | Sprint Board groups subtask cards under parent story card in each column (collapsible)  | SATISFIED | boardGroups memo + expandedStories; all 7 SprintBoardTab tests pass |
| HIER-03     | 07-02       | Subtasks whose parent not in sprint display parent story badge (user override: silent drop) | SATISFIED | User decision recorded: orphans silently dropped, not badged. `storyKeySet.has()` guard enforces this. Requirement intent (no orphan confusion) is met by the override. |
| MRAT-01     | 07-03       | MR Attention shows only open (state=opened) MRs                                         | SATISFIED | `state=opened` in both fetch URLs; no regression in test suite |
| MRAT-02     | 07-03       | MR Attention includes MRs linked to stories where user has assigned subtask             | SATISFIED | All 4 MRAT-02 tests pass; cache-first + fallback + via label all working |

**Note on HIER-03:** The original requirement specifies a "parent story badge" on orphan subtasks. The plan explicitly records a user decision to override this behaviour: orphans are silently dropped instead. The REQUIREMENTS.md marks HIER-03 as `[x]` Complete. The intent (user is not confused by orphan subtasks) is satisfied by the drop approach.

---

### Anti-Patterns Found

No blockers or warnings detected.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

Scanned files: SprintBoardTab.tsx, SprintBoardTab.test.tsx, MyTasksTab.tsx, TaskCard.tsx, MrRow.tsx, MrAttentionTab.tsx, MrAttentionTab.test.tsx. No TODOs, placeholders, empty handlers, or console-log-only implementations found.

---

### Human Verification Required

#### 1. Subtask visual nesting appearance

**Test:** Open the sprint board with a story that has subtasks. Expand the subtask section. Verify that subtask cards appear visually indented below the parent story card with a left border treatment.
**Expected:** Subtask cards have `ml-4` left margin and `border-l-2 border-l-muted` styling providing clear visual hierarchy.
**Why human:** CSS class presence can be verified programmatically, but visual adequacy of the nesting requires visual inspection.

#### 2. Subtask count Badge legibility

**Test:** With a story that has 1 subtask and another with 3 subtasks, verify the chip text reads "1 subtask" and "3 subtasks" respectively.
**Expected:** Correct singular/plural and chip is visible but not distracting.
**Why human:** Pluralisation logic is verified in code but visual balance in context of the full card requires visual check.

#### 3. "via [key]" label legibility in MR list

**Test:** Open MR Attention when a reviewer MR is included only via subtask path. Verify the "via PROJ-101" label is visible but clearly secondary/muted.
**Expected:** Label is `text-xs text-muted-foreground`, positioned after the linked task badge area, not prominent.
**Why human:** Colour/contrast adequacy requires visual inspection in both light and dark theme.

#### 4. Cache-first behaviour under real conditions

**Test:** Open the dashboard on MyTasksTab first (populating my-tasks cache), then switch to MrAttentionTab. Verify no duplicate network calls to the my-tasks endpoint are made.
**Expected:** MrAttentionTab reads from cache immediately; network call only fires if cache is empty.
**Why human:** Requires network inspector to verify cache hit vs. miss behaviour in the real app.

---

### Test Suite Summary

| Test File | Tests | Result |
|---|---|---|
| SprintBoardTab.test.tsx | 7 | All pass |
| MrAttentionTab.test.tsx | 7 | All pass |
| MyTasksTab.test.tsx | 9 | 8 pass, 1 pre-existing failure (skeleton timing) |
| ReleasesTab.test.tsx | 14 | 13 pass, 1 pre-existing failure (task count) |
| Full suite | 222 | 216 pass, 2 pre-existing failures, 4 todo |

Pre-existing failures are unchanged from before this phase. No new failures introduced.

---

_Verified: 2026-03-13T00:55:00Z_
_Verifier: Claude (gsd-verifier)_
