---
phase: 260525-rtu-polish-the-visual-design-of-standup-note
reviewed: 2026-05-25T00:00:00Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
  - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
  - taskflow/src/routes/standup-notes/TodayMrsSection.tsx
  - taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx
  - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 260525-rtu: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** quick
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Visual polish pass on eight standup-notes route files. The h3 header refactoring
(wrapping section labels in a `flex items-center gap-2` div alongside a count
badge) is structurally sound in all five section components — no unclosed tags
or mismatched JSX. No hardcoded secrets, no eval/innerHTML, no debug artifacts.

Three issues are worth fixing before shipping:

1. `TodayMrsSection` keys MR rows by `mr.iid` alone; `iid` is only unique within
   a single GitLab project, so multi-project reviewer queues can produce duplicate
   React keys and silent render bugs.
2. `TodayUpNextSection` (and the three sections that follow it in TodayColumn)
   render a top `border-t` unconditionally. When InProgress returns null and
   UpNext is the first visible element, the border paints against the column
   heading rather than against a preceding section — a visual regression introduced
   by making sections independently collapsible.
3. `import type React from 'react'` in `StandaloneMrGroup.tsx` is placed after the
   component definition and the `MrRow` helper that uses `React.ReactNode`; the
   type is referenced before the import appears in source order, which is
   technically a style violation and confuses readers (though bundlers hoist it).

---

## Warnings

### WR-01: `TodayMrsSection` — MR row key is `mr.iid` only; not unique across projects

**File:** `taskflow/src/routes/standup-notes/TodayMrsSection.tsx:94`
**Issue:** GitLab MR `iid` values are scoped per project. The reviewer-MR query
(`fetchReviewerMRs` / `fetchUserMREvents`) can in principle return MRs from
multiple projects. Keying solely on `mr.iid` means two MRs from different
projects that share the same integer IID (e.g. `!42` from project A and `!42`
from project B) produce identical React keys. React silently deduplicated list
items on duplicate keys, so one of the two MRs would not render.

**Fix:**
```tsx
// Before
key={mr.iid}

// After — composite key matches what TodayParticipatingSection already does
key={`${mr.project_id}/${mr.iid}`}
```

### WR-02: `TodayUpNextSection` (and `TodayMrsSection`, `TodayParticipatingSection`) — orphaned top border when InProgress is the only hidden section

**File:** `taskflow/src/routes/standup-notes/TodayUpNextSection.tsx:206`
**Issue:** `TodayInProgressSection` has no `border-t`; it is intended to be the
topmost section. Every subsequent section (`TodayUpNextSection`, `TodayMrsSection`,
`TodayParticipatingSection`) adds `border-t border-border pt-4` to visually
separate it from the section above. When `TodayInProgressSection` returns `null`
(empty + settled, per D-03), `TodayUpNextSection` becomes the first rendered
element and its `border-t` draws a line directly under the column heading with no
preceding section — a spurious horizontal rule that was not present before the
sections were made independently collapsible.

This is a visual regression that surfaces in any sprint where the user has no
in-progress items but does have up-next items.

**Fix:** The cleanest resolution is for TodayColumn to apply the separator
conditionally, or for each section to receive an `isFirst?: boolean` prop that
suppresses the top border. A simpler one-liner if the column renders them
sequentially: use CSS `divide-y` on the parent container and remove the
per-section `border-t`:

```tsx
// In TodayColumn, replace individual section wrappers with:
<div className="flex flex-col divide-y divide-border">
  <TodayInProgressSection ... />
  <TodayUpNextSection ... />
  ...
</div>
// Then remove `border-t border-border pt-4` from each section's root div.
```

### WR-03: `StandaloneMrGroup` — `YesterdayColumn` keys standalone MR groups by `mr.iid`; same cross-project uniqueness gap

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:496`
**Issue:** Identical root cause to WR-01. The `standaloneMrMap` in `buildGroups`
is keyed by MR iid (a `number`). `YesterdayColumn` passes that iid as the React
`key` prop for each `StandaloneMrGroup`. MR events across multiple GitLab projects
can collide on the same iid integer.

**Fix:**
```tsx
// Before (YesterdayColumn.tsx:496)
key={mr.iid}

// After
key={`${mr.projectId}/${mr.iid}`}
```

Additionally, `standaloneMrMap` in `buildGroups` should be keyed by a composite
string (`"projectId/iid"`) rather than a bare `number` to prevent the data-level
collision that precedes the key collision:

```ts
// buildGroups — change map type and key
const standaloneMrMap = new Map<string, StandaloneMrGroupData>();
// ...
const mrKey = `${event.project_id}/${mrIid}`;
const existing = standaloneMrMap.get(mrKey);
// ...
standaloneMrMap.set(mrKey, { ... });
```

---

## Info

### IN-01: `StandaloneMrGroup.tsx` — `import type React` placed after component body

**File:** `taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx:50`
**Issue:** `import type React from 'react'` appears at line 50, after the `MrRow`
helper (lines 21–48) that uses `React.ReactNode` in its prop type annotation.
While TypeScript/bundlers hoist type imports correctly, placing a type import
below the code that depends on it is confusing and violates the project import-
ordering convention (external imports at the top). This is the only out-of-order
import in the reviewed files.

**Fix:** Move the import to the top of the file, above the lucide-react import:

```tsx
import type React from 'react';
import { CheckCircle, GitMerge, MessageSquare } from 'lucide-react';
```

### IN-02: `IssueActivityGroup.tsx` — index-keyed sub-items with suppressed lint warning

**File:** `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx:118,136,152`
**Issue:** All three sub-item render branches use `key={i}` (array index). The
biome-ignore comments acknowledge this, citing "static render, no reorder". That
reasoning holds only so long as the parent never updates subItems in-place while
keeping the component mounted. With React Query's `staleTime` re-fetches, the
`subItems` array can change between data refreshes, and index keys would cause
stale child state to be associated with the wrong item. A stable key derived from
the item's content (e.g. `kind + label`) would be safer with negligible cost.

**Fix:**
```tsx
// Replace key={i} with a content-derived key across all three branches
key={`${item.kind}-${item.label}`}
```

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
