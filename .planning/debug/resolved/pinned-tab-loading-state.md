---
status: resolved
trigger: "Pinned tabs show only issue key + checkmark after reload until cache loads; no loading skeleton; also wants two-line layout"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: resolveIssueFromCache returns undefined on cold start, causing empty summary and fallback CheckSquare icon
test: code review of rendering when resolved is undefined
expecting: confirms no loading indicator exists
next_action: report findings

## Symptoms

expected: Pinned tabs should show a loading skeleton while issue metadata loads from API cache
actual: Tabs show only the issue key and a blue CheckSquare (checkmark) icon with empty summary text
errors: none (visual/UX issue)
reproduction: reload the app with pinned tabs; observe tabs before jira-issues queries resolve
started: since pinned tabs feature was added

## Eliminated

(none)

## Evidence

- timestamp: 2026-03-16T00:00:00Z
  checked: PinnedTabStrip.tsx lines 119, 133-135
  found: When resolveIssueFromCache returns undefined, issueTypeName falls back to '' which hits the default switch case (CheckSquare icon), and summary renders as empty string
  implication: No loading state exists — tab looks "done" but with missing data

- timestamp: 2026-03-16T00:00:00Z
  checked: PinnedTabStrip.tsx line 114, 127
  found: Container is h-9, tabs are h-7 with single-line flex layout. Summary and key are inline on same line via flex items-center.
  implication: Two-line layout requires changing from h-7 single-line to a taller two-row structure

- timestamp: 2026-03-16T00:00:00Z
  checked: skeleton.tsx
  found: Skeleton component exists at components/ui/skeleton.tsx — standard animate-pulse rounded-md div
  implication: Can be used directly for loading placeholder

## Resolution

root_cause: resolveIssueFromCache returns undefined when react-query cache is empty (cold start / reload). The rendering code treats undefined the same as resolved — it just renders empty strings and a fallback icon. There is no loading/pending visual state.
fix: (not yet applied — diagnosis only)
verification: (pending)
files_changed: []
