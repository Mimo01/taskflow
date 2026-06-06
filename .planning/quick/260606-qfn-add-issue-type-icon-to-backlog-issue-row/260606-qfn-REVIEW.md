---
phase: 260606-qfn-add-issue-type-icon-to-backlog-issue-row
reviewed: 2026-06-06T00:00:00Z
depth: quick
files_reviewed: 3
files_reviewed_list:
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 260606-qfn: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** quick
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the diff (2801f9aa..af17e7fd, commits 825ddbda, b9120a5f, af17e7fd) that adds
an issue-type icon column to `BacklogRow` and an issue-type icon to the sprint-board story
swimlane header (`StoryHeaderRow`), wired through `SprintBoardTab`.

The change is small, mechanical, and low-risk. No bugs, security issues, or correctness
defects were found. The Backlog table is header-less (no `<thead>`, colgroup, or `colSpan`
cells in `BacklogPage.tsx`), so inserting a new leading `<td>` does not desync any header
or spanning row — the most likely failure mode for "add a table column" changes does not
apply here. The new column mirrors the existing `PriorityIcon` cell pattern (explicit-px
inner span to survive the WebKit virtualized-table sizing pitfall noted in project memory),
and the sprint-board props thread cleanly through all three call sites (lines 496, 672, 1686).

Three info-level items below concern dead defensive code and a comment that does not match
the actual type contract — none affect runtime behavior.

## Info

### IN-01: Null guard on `issuetype` is dead code; comment contradicts the type

**File:** `taskflow/src/routes/dashboard/BacklogRow.tsx:88-102`
**Issue:** The cell comment states it "Renders nothing (empty span) when the issue has no
issuetype" and `aria-hidden={!issue.fields.issuetype}` plus `issue.fields.issuetype?.name &&`
guard against a missing issuetype. But `JiraIssue.fields.issuetype` is typed as
non-nullable with `name: string` always present (`jira.ts:153-160`). Given the type, the
guard can never be false, `aria-hidden` is always `false`, and the icon always renders.
The defensive code is harmless but misleading — a reader will assume issuetype can be
absent, which the type denies.
**Fix:** Either keep the guard and document it as runtime defense-in-depth against malformed
API payloads (preferred, since Jira fields can be unexpectedly absent at runtime), or remove
the dead conditional. If keeping it, drop the comment's claim about the `CheckSquare` default
since that path is unreachable through this guard.

### IN-02: `IssueTypeIcon` switches on issue-type *name*, which admins can rename

**File:** `taskflow/src/routes/dashboard/BacklogRow.tsx:101`, `taskflow/src/routes/dashboard/StoryHeaderRow.tsx:133`
**Issue:** Both new call sites pass `issuetype.name` to `IssueTypeIcon`, which selects the
glyph via a `switch (typeName)` on string literals ('Bug', 'Story', 'Epic', 'Subtask').
`jira.ts:159` explicitly warns: "Use this [`subtask` boolean] — NOT name comparison. Admins
can rename issue types." On a Jira instance with renamed/localized issue types, every row
falls through to the default `CheckSquare`, silently degrading the feature. The defect lives
in the `IssueTypeIcon` component (outside this diff), but this change is the first consumer
to render it per-row at scale, so it is worth flagging here.
**Fix:** Out of scope for this diff. Track a follow-up to drive `IssueTypeIcon` (at least the
subtask case) off the `subtask` boolean rather than the display name, or to map known type
ids.

### IN-03: Sprint-board and backlog use different icon sizing conventions

**File:** `taskflow/src/routes/dashboard/BacklogRow.tsx:96-102` vs `taskflow/src/routes/dashboard/StoryHeaderRow.tsx:133`
**Issue:** In `BacklogRow` the icon is wrapped in an explicit 18x18px span (to defeat the
virtualized-table column-collapse pitfall), so the rendered glyph sits in an 18px box while
`IssueTypeIcon`'s own default class is `w-3.5 h-3.5` (14px). In `StoryHeaderRow` the icon is
dropped directly into a flex row with no wrapper, rendering at its native 14px next to a
`size-3.5` flag and the `PriorityIcon`. The two surfaces will present the issue-type glyph at
slightly different visual weights/alignment. Not a defect, but a minor consistency gap if
visual parity across the two views was intended.
**Fix:** If parity matters, align on one approach — e.g., pass a shared `className` to
`IssueTypeIcon` in both, or wrap the header icon in a matching fixed-size span. Otherwise
leave as-is; both are individually correct.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
