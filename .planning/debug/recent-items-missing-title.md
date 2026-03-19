---
status: diagnosed
trigger: "Investigate why recently opened items in the RecentItemsPopover show without their title"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: main.tsx handleIssueClick calls pushRecentItem without title, so stored item has no title; cache lookup is unreliable fallback
test: confirmed by reading call sites
expecting: n/a — confirmed
next_action: report diagnosis

## Symptoms

expected: Recent items popover shows issue key AND title (e.g. "PROJ-123  Fix login bug")
actual: Only the issue key shows; title column is empty
errors: none (no runtime error, just missing data)
reproduction: Open any Jira issue from sprint board or backlog, then open recent items popover
started: Since recent items feature was introduced

## Eliminated

(none needed — root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-16T00:00:00Z
  checked: main.tsx line 125 — handleIssueClick call to pushRecentItem
  found: Only passes { type: 'jira', id: issueKey } — no title field
  implication: RecentItem is stored without a title

- timestamp: 2026-03-16T00:00:00Z
  checked: CommandPalette.tsx line 137 — handleIssueSelect call to pushRecentItem
  found: Passes { type: 'jira', id: issueKey, title: resolvedTitle } — title IS included
  implication: Items opened via command palette DO get titles; the bug is specific to the main click path

- timestamp: 2026-03-16T00:00:00Z
  checked: RecentItemsPopover.tsx lines 67-69 — title resolution in RecentItemRow
  found: Falls back to cache lookup (findJiraIssueInCache) then item.title; both can be undefined
  implication: Cache lookup is unreliable (pagination, GC, timing) and item.title was never set

- timestamp: 2026-03-16T00:00:00Z
  checked: recent-items.store.ts line 44 — pushItem preserves existing title
  found: `item.title ?? existing?.title` — preserves title if one existed, but first push has no title
  implication: Even dedup logic can't recover a title that was never stored

## Resolution

root_cause: main.tsx handleIssueClick (line 125) calls pushRecentItem({ type: 'jira', id: issueKey }) without a title. The RecentItemsPopover falls back to a react-query cache lookup, but that lookup is unreliable — the issue data may not be in cache at render time (pagination, GC, timing). Since no title was stored and cache lookup fails, the title renders as empty string.
fix: (not applied — diagnosis only)
verification: (not applied)
files_changed: []
