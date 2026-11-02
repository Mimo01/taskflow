---
phase: 261102-fy2
reviewed: 2026-11-02T00:00:00Z
depth: quick
files_reviewed: 15
files_reviewed_list:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
  - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
  - taskflow/src/routes/standup-notes/TodayColumn.tsx
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  - taskflow/src/routes/standup-notes/StandupPageHeader.tsx
  - taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx
  - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
  - taskflow/src/routes/standup-notes/TodayMrsSection.tsx
  - taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 261102-fy2: Code Review Report

**Depth:** quick (diff-focused). No blockers. The markdown generator does not read the new status fields, so its output is unchanged. The header pill is click-through (`pointer-events-none`) and is not a sibling of the overlay button, so it does not block clicks. The `staleTime` drop to 5 min is consistent with refresh-all, which refetches every `['standup']` query. The issue-meta key includes `referencedKeys`.

## Warnings

### WR-01: Story-points slot is a fixed `w-7` and drops the "pts" label
**File:** `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx` (IssueRow SP slot; same in TodayUpNextSection.tsx)
**Issue:** `w-7` (1.75rem) with `px-1` fits 1-2 digits. Values such as `13`, `0.5`, `100` or `20.5` overflow or clip the border box. `sp ?? 0` is rendered invisibly for rows without points, so the width calc is also driven by a fake "0".
**Fix:** Use `min-w-7` with `w-auto` on the slot, or size the slot with `ch` units for the widest value in the section. Compute the slot width from the max formatted length.

### WR-02: Progress bar hidden below a 32rem container with no fallback
**File:** `TodayInProgressSection.tsx` / `TodayUpNextSection.tsx` (`hidden ... @[32rem]:flex`)
**Issue:** At narrow widths the time spent/estimate disappears entirely, so information is lost, not just compacted. It relies on an `@container` ancestor. One was added in TodayColumn.tsx, but any other consumer of these sections would silently never show progress. The memory note on container queries applies: container variants never style the container itself, so the check is correct only because the wrapper is an inner element.
**Fix:** Confirm the sections are only rendered inside TodayColumn. Optionally keep a compact text-only `spent / est` at narrow widths.

### WR-03: Parent-status fallback can show a stale status for rolled-up groups
**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` (resolveRollup / ensureGroup)
**Issue:** When the parent has no own meta, `meta.parentStatusName` comes from the sub-task's embedded `parent.fields.status`. The `ensureGroup` upgrade is first-wins (`!existing.statusName`). If the group is first created via an embedded (possibly different or older) parent status and the parent's own fetched status arrives for a later key, the own status never replaces it. Both come from the same response, so the risk is low, but the "prefer own" rule is not enforced after creation.
**Fix:** Track provenance, or always overwrite when the resolved status comes from `parentMeta` (own).

## Info

### IN-01: Fetched-parent meta lacks summary/type
**File:** `taskflow/src/services/jira.ts` (missingParents block)
**Issue:** `map[p.key] = {...(map[p.key] ?? {}), ...}` creates an entry with only `subtaskKeys` and status, so `meta.summary` and `meta.type` are undefined for that key. This is pre-existing, but status is now also stored there. A parent group keyed off it falls back to `parentSummary` and `parentType`, which is fine. Add a comment, or fetch `summary,issuetype` in the same request.
