---
phase: 260606-oyy-on-sprint-board-i-want-to-change-how-pri
reviewed: 2026-06-06T00:00:00Z
depth: quick
files_reviewed: 6
files_reviewed_list:
  - taskflow/src/components/ui/priority-icon.tsx
  - taskflow/src/lib/issueDisplayUtils.test.ts
  - taskflow/src/lib/issueDisplayUtils.ts
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 260606-oyy: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** quick
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the change that replaces the priority-colored left border on sprint board
cards/swimlanes with a Jira priority `iconUrl` image and repurposes the left border
to encode issue-type color via the new `issueTypeStripeClass()` helper.

The core helpers are well-constructed: full-literal Tailwind class strings (JIT-safe),
robust null/empty `iconUrl` handling in both `prioritySeverityFromIcon` and
`PriorityIcon`, the `subtask`-flag-first ordering in `issueTypeStripeClass`, and a
strong accompanying test suite. No blockers found.

The most material finding is an accessibility regression: priority is now conveyed
*only* by an icon image rendered with `alt=""`, so screen-reader users lose all
priority information (WR-01). Secondary findings cover the now-orphaned
`priorityStripeClass` export (and a stale adapter comment that still claims TaskCard
uses it), an unverified "iconUrl is absolute" assumption behind the plain `<img>`,
and a missing `width`/`height` on the priority image.

## Warnings

### WR-01: Priority icon is invisible to screen readers (`alt=""` with no text fallback)

**File:** `taskflow/src/components/ui/priority-icon.tsx:20`
**Issue:** The priority is now communicated *exclusively* through the icon image
(the colored left border was repurposed to issue-type). The image renders with
`alt=""`, which marks it decorative and removes it from the accessibility tree, and
relies on `title` for the label. `title` is not reliably announced by screen readers
(and never on touch). Net effect: assistive-tech users get no priority signal at all
on cards or swimlane headers — a regression from the prior text/color encoding.
**Fix:** Use the priority name as the accessible name instead of an empty alt:
```tsx
export function PriorityIcon({ priority, className = 'w-3.5 h-3.5 shrink-0' }: PriorityIconProps) {
  if (!priority?.iconUrl) return null;
  const label = priority.name ? `Priority: ${priority.name}` : 'Priority';
  return (
    <img
      src={priority.iconUrl}
      alt={label}
      title={priority.name ?? undefined}
      width={14}
      height={14}
      className={className}
    />
  );
}
```
If the icon is genuinely redundant with adjacent visible text, keep `alt=""` — but
here there is no adjacent priority text, so a non-empty alt is required.

### WR-02: `priorityStripeClass` is now an orphaned export; adapter comment is stale and misleading

**File:** `taskflow/src/lib/issueDisplayUtils.ts:131` and `taskflow/src/services/jira/greenhopper/adapter.ts:127-131`
**Issue:** After this change no component calls `priorityStripeClass` — a repo-wide
grep finds only its definition, its tests, and a comment. The context brief asked
that it "remain intact for other consumers," but there are no remaining consumers.
Worse, `adapter.ts:127-131` still asserts: "SprintBoardTab's TaskCard renders a
left-edge priority colour stripe via `priorityStripeClass`" — that is now false
(TaskCard uses `issueTypeStripeClass` for the border and `PriorityIcon` for priority).
The stale comment will mislead the next reader about why `fields.priority.iconUrl`
is synthesized.
**Fix:** Update the `adapter.ts` comment to state the live consumer is `PriorityIcon`
(needs `iconUrl`) and `issueTypeStripeClass` (border). Either keep `priorityStripeClass`
explicitly documented as a retained public utility with no current caller, or remove
it with its tests if it is not part of a committed export contract.

### WR-03: `PriorityIcon` renders a plain `<img>` on the unverified assumption that `iconUrl` is absolute

**File:** `taskflow/src/components/ui/priority-icon.tsx:18-21`
**Issue:** The component comment states "The priority iconUrl is absolute and needs
no auth, so it renders a plain `<img>` (not AuthImage)." The value originates from
the GreenHopper envelope (`entityMaps.ts:85` → `entry.priorityUrl`), which is not
guaranteed absolute — Jira frequently returns context-relative icon paths
(e.g. `/images/icons/priorities/major.svg`) and some priority icons require auth.
If the URL is relative or auth-gated, the `<img>` silently 404s/broken-images.
There is no `onError` fallback, so a broken icon leaves no priority indication at all.
**Fix:** Confirm the envelope's `priorityUrl` is always absolute and auth-free for the
deployed Jira topology. If it can be relative, resolve it against `jiraBaseUrl`; if it
can be auth-gated, route through `AuthImage` as the codebase does elsewhere. At minimum
add an `onError` handler that hides the broken image so the card degrades cleanly.

### WR-04: `prioritySeverityFromIcon` only ever resolved through icon path — name fallback for renamed priorities is effectively dead on the board

**File:** `taskflow/src/lib/issueDisplayUtils.ts:138-140`
**Issue:** Not a correctness bug in the helper itself, but a scope note worth flagging:
`priorityStripeClass`'s name-based fallback (`PRIORITY_STRIPE`) is only reachable when
`iconUrl` is absent/unmapped. Since the live board path no longer calls
`priorityStripeClass` at all (see WR-02), the entire name→color fallback branch and
`PRIORITY_STRIPE` map are exercised only by tests. If the intent was for stripe color
to survive when the icon image fails to load, that linkage no longer exists — the
border is issue-type now, and a failed priority image has no color fallback (compounds
WR-03). Confirm this is the intended product behavior.
**Fix:** If priority color is meant to remain a fallback signal when the icon image is
unavailable, wire `priorityStripeClass`/`prioritySeverityFromIcon` into the
`PriorityIcon` error path or a sibling element. Otherwise document that
`PRIORITY_STRIPE` and the name fallback are retained only as a public utility.

## Info

### IN-01: Task and Subtask issue types are indistinguishable by stripe color

**File:** `taskflow/src/lib/issueDisplayUtils.ts:161-175`
**Issue:** Both the `Subtask`/`Sub-task` cases and the `default` (Task and unknown
types) return the same `BLUE`. This mirrors `IssueTypeIcon` (Task and Subtask both
blue) so it is intentional and consistent, but it means the new left-border encoding
cannot visually separate a Task from a Subtask — only the icon/name does.
**Fix:** No action required if matching `IssueTypeIcon` is the contract. If Task vs
Subtask differentiation is desired, give the `default`/Task case a distinct color.

### IN-02: `ICON_SEVERITY_STRIPE` collapses several severity tokens onto identical colors

**File:** `taskflow/src/lib/issueDisplayUtils.ts:80-95`
**Issue:** `critical`/`blocker` both map to `dark:border-l-red-400`, and `minor`/`trivial`
are fully identical (`gray-700 / gray-500`). The header doc and the
"all-distinct ramp" test (test line 199-204) only assert distinctness across the
specific 8-token subset, not the full map. Custom schemes that surface both `minor`
and `trivial`, or rely on `blocker` vs `critical` distinction in dark mode, will see
colliding colors. This is documented as an accepted trade-off; flagging for awareness.
**Fix:** None required if the documented trade-off stands. Revisit if a customer scheme
needs `minor`/`trivial` separation.

### IN-03: `priority` prop is double-cast through `as { name?: string; iconUrl?: string }` at call sites

**File:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx:493-495,668-670` and `taskflow/src/routes/dashboard/TaskCard.tsx:218-222`
**Issue:** Each call site casts `story.fields.priority` / `issue.fields.priority` with
an inline `as { name?: string; iconUrl?: string } | null | undefined`. The cast drops
the `| null` on the inner field types (`name?: string` vs the helper's
`name?: string | null`) and bypasses the real `JiraIssue['fields']['priority']` type.
If the underlying field shape drifts, these casts hide the mismatch from the compiler.
**Fix:** Type `JiraIssue['fields']['priority']` to match `PriorityIconProps['priority']`
and drop the inline casts, or narrow with a small typed accessor so the compiler
verifies the shape at the boundary.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
