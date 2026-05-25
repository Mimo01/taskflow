---
status: complete
phase: 69-standup-notes-route-yesterday-recap
source: [69-01-SUMMARY.md, 69-02-SUMMARY.md, 69-03-SUMMARY.md, 69-04-SUMMARY.md]
started: 2026-05-25T21:06:37Z
updated: 2026-05-25T21:08:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Navigate to Standup Notes
expected: "Standup Notes" entry appears in the sidebar (main section, clipboard icon). Clicking it navigates to /standup-notes and the breadcrumb/title reads "Standup Notes".
result: pass

### 2. Page Shell + Header
expected: Two-column 50/50 layout with a vertical divider. Full-width header shows title "Standup notes" (lowercase n), a full-date line below it (e.g. "Monday, 25 May 2026"), and on the right a sync-status text + ghost "Refresh" button + primary "Copy markdown" button (with a Copy icon).
result: pass

### 3. Today Column Placeholder
expected: Right column shows a "Today" heading with the current date, plus an empty state (Clock icon, "Today section coming soon", subtitle "Planned tasks, pinned issues, and worklog targets will appear here.").
result: pass

### 4. Yesterday Resolves to Last Working Day
expected: Left column "Yesterday" heading shows the last working day's date. Since today is Monday, it should show Friday (2026-05-22) — NOT Saturday/Sunday and not off-by-one (e.g. not Thursday). Tempo holidays are also skipped.
result: pass

### 5. Issue Activity Groups Populate
expected: Issue groups appear with a type icon + issue key + summary, and hours logged right-aligned. Sub-items list worklog hours, status transitions, Jira comments, commits, and MR comments beneath each issue.
result: pass

### 6. Parent-Story Rollup
expected: Sub-task activity rolls up under its parent story — logged sub-tasks appear with their hours beneath the parent story group, rather than as separate top-level entries.
result: pass

### 7. Standalone MR Groups
expected: MRs not linked to an issue appear as their own group labeled by MR name (!IID), showing a per-MR comment count and approvals. Only your own comments are counted (count is not inflated).
result: pass

### 8. Issue Header Click Navigates
expected: Hovering an issue group header shows a pointer cursor; clicking it opens that issue's detail view and adds a breadcrumb trail entry.
result: pass

### 9. Summary Stat Line
expected: Beneath the Yesterday heading, a muted stat line like "7.5h logged across 3 stories · 7 commits · 2 MR events" appears when data exists, and is hidden (not shown as "0h · 0 commits") when all sources are empty.
result: pass

### 10. Copy Markdown
expected: Clicking "Copy markdown" copies the Yesterday recap as markdown to the clipboard; the button label changes to "Copied!" for ~2 seconds then reverts. Pasting elsewhere shows the recap content (not an empty string).
result: pass

### 11. Refresh Refetches All Sources
expected: Clicking "Refresh" refetches all four sources at once; existing data stays visible (no full skeleton replay), and the "synced Xm ago" status updates.
result: pass

### 12. Independent Section Loading & Degradation
expected: Sections load independently — populated groups appear first with empty/loading notices below. A slow or failing single source (e.g. Jira) degrades gracefully and does not hang the whole column.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
