---
phase: quick-260519-eol-flag
plan: "01"
subsystem: jira-flagged
tags: [flagged, sprint-board, backlog, issue-detail, optimistic-update]
dependency_graph:
  requires: []
  provides: [flaggedFieldKey-discovery, setIssueFlagged, isIssueFlagged, sprint-flag-toggle, backlog-flag-toggle, issue-detail-flagged-row]
  affects: [SprintBoardTab, BacklogPage, IssueDetailSidebar, FieldsSection, TaskCard, BacklogRow]
tech_stack:
  added: []
  patterns: [optimistic-update-rollback, customfield-discovery, zustand-persist-migration]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira/fields.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira/backlog.ts
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/main.tsx
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
decisions:
  - "flaggedFieldKey discovery uses f.name === 'Flagged' (display name match) rather than schema.custom, which varies across Jira versions; default fallback is customfield_10021"
  - "Settings store bumped to version 18 with migration backfill for flaggedFieldKey"
  - "isIssueFlagged and setIssueFlagged exported from jira.ts (not jira/fields.ts) to colocate with updateIssueField which setIssueFlagged delegates to"
  - "FieldsSectionProps.flaggedFieldKey is optional (defaults to customfield_10021) so existing test renderFieldsSection helpers remain compatible without changes"
metrics:
  duration_minutes: 25
  completed_date: "2026-05-19"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 12
---

# Quick Task 260519-eol: Jira Flagged Field Support

**One-liner:** Jira "Flagged (Impediment)" field wired end-to-end: discovered via `f.name === 'Flagged'`, persisted in settings, included in sprint/backlog queries, rendered as yellow background + Flag icon in sprint board and backlog, toggled via right-click context menu, and shown in issue detail sidebar with inline toggle button.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Wire flaggedFieldKey discovery, settings, fetch fields, and toggle helper | a2a7f308 | fields.ts, jira.ts, backlog.ts, settings.store.ts, main.tsx |
| 2 | Render flag in sprint view + backlog view with right-click toggle | 614f35c4 | TaskCard.tsx, BacklogRow.tsx, SprintBoardTab.tsx, BacklogPage.tsx |
| 3 | Add Flagged row to issue detail sidebar | 46f6f7fe | FieldsSection.tsx, FieldsSection.test.tsx, IssueDetailSidebar.tsx |

## Implementation Notes

### Discovery heuristic
`discoverCustomFields` (in both `fields.ts` and `jira.ts`) now matches `f.name === 'Flagged'` (case-sensitive) as the primary signal. This is the documented approach — different Jira versions ship the Flagged field under different `schema.custom` keys, but the display name is stable. Default fallback: `customfield_10021`.

### Flagged field shape
Jira represents the Flagged field as `Array<{ value: string }>`. FLAG: `[{ value: "Impediment" }]`. UNFLAG: `null`. IS FLAGGED: `Array.isArray(val) && val.length > 0`. This is encapsulated in `isIssueFlagged(issue, fieldKey)` exported from `jira.ts`.

### Settings store migration
Store version bumped 17 → 18 with `if (s.flaggedFieldKey === undefined) s.flaggedFieldKey = 'customfield_10021'` migration. `setFlaggedFieldKey` setter added. `main.tsx` `useCustomFieldDiscovery` hook now forwards `flaggedFieldKey` from discovery result to the store.

### Query keys
Both `jira-sprint-stories` (SprintBoardTab) and `jira-backlog-sprint-stories` / `jira-backlog-issues` (BacklogPage) query keys now include `flaggedFieldKey` so cache buckets invalidate correctly if the discovered key changes.

### Optimistic updates
- **SprintBoardTab**: `handleToggleFlag` follows the same pattern as `handleTransition` — optimistically mutates `localIssues`, awaits `setIssueFlagged`, rolls back + sets `cardErrors` on failure.
- **BacklogPage**: `handleToggleFlag` snapshots and optimistically updates both `jira-backlog-issues` and `jira-backlog-sprint-stories` caches, rolls back both on failure.

### UI
- **TaskCard**: yellow background `bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700` + `Flag` icon in top row when `isFlagged`. ContextMenu now renders when `onTransition || onToggleFlag`.
- **BacklogRow**: yellow row background replaces `hover:bg-muted/30` when `isFlagged`. `Flag` icon prepended in Summary cell. ContextMenu renders when any handler is provided.
- **FieldsSection**: `Flagged` MetaRow placed after Priority row. Shows flag icon + "Flagged (Impediment)" when flagged; "— Add flag" text when not. Button calls `mutation.mutate` via `useFieldMutation` which handles optimistic update + rollback + cache invalidation.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries introduced.

## Self-Check: PASSED

Files exist:
- taskflow/src/services/jira/fields.ts — FOUND (contains `flaggedFieldKey`)
- taskflow/src/services/jira.ts — FOUND (contains `isIssueFlagged`, `setIssueFlagged`)
- taskflow/src/stores/settings.store.ts — FOUND (contains `flaggedFieldKey`, version: 18)
- taskflow/src/routes/dashboard/TaskCard.tsx — FOUND (contains `isFlagged`, `onToggleFlag`)
- taskflow/src/routes/dashboard/BacklogRow.tsx — FOUND (contains `isFlagged`, `onToggleFlag`)
- taskflow/src/routes/dashboard/SprintBoardTab.tsx — FOUND (contains `handleToggleFlag`)
- taskflow/src/routes/dashboard/BacklogPage.tsx — FOUND (contains `handleToggleFlag`)
- taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx — FOUND (contains `Flagged`)
- taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx — FOUND (3 new tests)

Commits exist:
- a2a7f308 — FOUND
- 614f35c4 — FOUND
- 46f6f7fe — FOUND

TypeScript: CLEAN (tsc --noEmit exits 0)
Tests: 48/48 PASS across TaskCard, BacklogRow, SprintBoardTab, BacklogPage, FieldsSection test files
