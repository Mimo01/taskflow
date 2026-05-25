---
phase: 260525-kfi
reviewed: 2026-05-25T00:00:00Z
depth: quick
files_reviewed: 3
files_reviewed_list:
  - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
  - taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx
  - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 260525-kfi: Code Review Report

**Reviewed:** 2026-05-25
**Depth:** quick (context: pure className/layout restyle)
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three standup-notes display components reviewed. No logic, data model, or prop changes are present — consistent with the stated scope. No security issues and no accessibility regressions on interactive elements. Three warnings found: a missing text-size class on a header label in `OtherCommitsGroup` (visual inconsistency), a non-exhaustive `switch` that will produce a runtime crash if `SubItemKind` ever gains a new variant, and an ambiguous approvals-count collapse in `StandaloneMrGroup` that silently discards information when `approvals > 1`.

---

## Warnings

### WR-01: `OtherCommitsGroup` header label missing text-size class — renders at browser default (16 px)

**File:** `taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx:24`
**Issue:** The "Other commits" label `<span>` has no Tailwind text-size utility. Every equivalent label in the sibling components uses `text-sm`. Without the class the browser renders this span at ~16 px (the root default), making it visually larger than every other group header label on the same page.
**Fix:**
```tsx
- <span>Other commits</span>
+ <span className="text-sm">Other commits</span>
```

---

### WR-02: `subItemIcon` switch has no `default` branch — will crash on unrecognised `SubItemKind`

**File:** `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx:48-65`
**Issue:** `subItemIcon` returns a Lucide component from a `switch` statement covering every current `SubItemKind` variant, but has no `default` branch. TypeScript considers this exhaustive today, but if a new variant is added to the `SubItemKind` union without updating the switch, the function returns `undefined`. That `undefined` is then invoked as `<SubIcon ... />` at line 101, producing a React runtime crash ("SubIcon is not a function").
**Fix:** Add a `default` that returns a safe fallback so a missing mapping is gracefully visible rather than a crash:
```tsx
default:
  return GitBranch; // fallback — add the new kind to the switch above
```

---

### WR-03: `StandaloneMrGroup` collapses multiple approvals into a single line — data loss when `approvals > 1`

**File:** `taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx:44-51`
**Issue:** When `approvals > 1` the component renders exactly one "Approved !{iid}" line. The JSDoc says "approvals stay discrete", which could mean one line per approver, not a single aggregate line. If multiple approvals are expected to be surfaced individually, the current render silently hides all but the first. If the intended behaviour is intentionally one line ("the MR was approved"), the prop type should be `boolean` rather than `number` to make the intent explicit and prevent confusion.
**Fix (option A — surface count):**
```tsx
<span className="flex-1 min-w-0 truncate text-sm text-foreground">
  {approvals === 1 ? `Approved !${iid}` : `Approved !${iid} (${approvals}×)`}
</span>
```
**Fix (option B — clarify intent, rename prop):**
```tsx
// If one line is always correct, change prop type to boolean:
approved: boolean;
// and guard with: {approved && ( ... "Approved !{iid}" ... )}
```

---

_Reviewed: 2026-05-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
