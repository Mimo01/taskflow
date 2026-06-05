---
phase: 260605-hx2
plan: 01
subsystem: issue-detail
tags: [jira, issue-detail, resolution, field-editing, react-query]
requires:
  - useFieldMutation (optimistic update + rollback)
  - updateIssueField (PUT issue field)
  - base-ui Select primitive (inline edit pattern)
provides:
  - fetchResolutions service fetcher + JiraResolution type
  - resolution member on canonical JiraIssueDetail
  - done-gated Resolution MetaRow in FieldsSection
affects:
  - taskflow/src/services/jira.ts (type + fetch fields + re-export)
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
tech-stack:
  added: []
  patterns:
    - on-open React Query fetch (enabled gated, staleTime Infinity)
    - inline Select edit mirroring Priority field
    - native <select> Select stand-in for jsdom Select tests
key-files:
  created:
    - taskflow/src/services/jira/resolutions.ts
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
decisions:
  - "Resolution row always rendered; editable Select only when status category is 'done'"
  - "Unresolved option clears via mutate({ fieldName: 'resolution', value: null })"
  - "Set via { name } (mirrors Priority), not { id }"
  - "Tests mock @/components/ui/select with native <select> stand-in (base-ui portal does not lay out in jsdom)"
metrics:
  duration: ~12m
  completed: 2026-06-05
  tasks: 3
  files: 4
---

# Quick Task 260605-hx2: Add resolution field control to issue detail sidebar Summary

Adds an always-visible Resolution field to the issue-detail sidebar (FieldsSection) that is
editable via an inline Select only for done-category issues, with an "Unresolved" option that
clears the field via `value: null`. Built entirely on existing infrastructure (`useFieldMutation`,
`updateIssueField`, on-open React Query fetch).

## What Was Built

- **`fetchResolutions` service** (`taskflow/src/services/jira/resolutions.ts`): mirrors
  `statuses.ts`. Hits `GET /rest/api/2/resolution`, returns a bare array of
  `JiraResolution { id, name, description? }`. 401/403 → `ApiError`; other non-OK → generic `Error`.
- **Type + fetch wiring** (`jira.ts`): re-exports `fetchResolutions`/`JiraResolution` per the
  dual-file convention; added `'resolution'` to the `fetchIssueDetail` fields array; added
  `resolution: { id; name; description? } | null` to the **canonical** `JiraIssueDetail` at
  jira.ts:1206 (NOT the `jira/types.ts` duplicate — per the known dual-file gotcha).
- **Resolution MetaRow** (`FieldsSection.tsx`): always rendered. For `statusCategory?.key === 'done'`
  it offers an inline Select (Unresolved + fetched options) wired to `mutation.mutate` with
  `{ name }` / `null`; the options query (`['jira-resolutions', jiraBaseUrl]`) fetches on first
  open. For non-done issues it renders read-only `f.resolution?.name ?? 'Unresolved'`
  (`data-testid="resolution-value"`). Error message is scoped via
  `mutation.variables?.fieldName === 'resolution'`.
- **Tests** (`FieldsSection.test.tsx`): read-only gate (non-done → no edit button), set payload
  (`{ name: 'Done' }`), clear payload (`null`).

## Requirements Satisfied

- HX2-1: Resolution row always visible in the sidebar.
- HX2-2: Editable only when `f.status.statusCategory?.key === 'done'`.
- HX2-3: Inline Select of resolution options (mirrors Priority).
- HX2-4: "Unresolved" clears via `mutate({ fieldName: 'resolution', value: null })`.
- HX2-5: Non-done issues render `f.resolution?.name ?? 'Unresolved'` read-only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] handleResolutionChange signature mismatch with base-ui Select**
- **Found during:** Task 2 (tsc verify)
- **Issue:** Plan specified `handleResolutionChange(value: string)`, but the base-ui Select
  `onValueChange` signature is `(value: string | null, eventDetails) => void` — `(value: string)`
  did not type-check.
- **Fix:** Changed signature to `(value: string | null)` with an early `if (!value) return;`
  guard, mirroring the existing `handlePriorityChange` exactly.
- **Files modified:** taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
- **Commit:** 10125ce4

**2. [Rule 3 - Blocking] base-ui Select options do not mount/drive onValueChange in jsdom**
- **Found during:** Task 3 (vitest)
- **Issue:** The plan's test approach (`findByText('Done')` then `fireEvent.click(option)`) failed —
  base-ui Select renders options into a floating-ui portal that does not lay out in jsdom, so
  clicking the option never fired `onValueChange` (mutate called 0 times).
- **Fix:** Adopted the codebase's established pattern (AioBlock.test.tsx / IntegrationsSection.test.tsx):
  `vi.mock('@/components/ui/select', ...)` with a deterministic native `<select>`/`<option>`
  stand-in that preserves the `value`/`onValueChange` API. Tests select via
  `fireEvent.change(getByTestId('select-native'), { target: { value } })` after awaiting the async
  options query. This exercises the real FieldsSection → mutate wiring.
- **Files modified:** taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
- **Commit:** d5d9815a

**3. [Rule 3 - Blocking] biome format normalization on Task 1 files**
- **Found during:** final `npm run check`
- **Issue:** biome's import/export sort reordered the re-export block (resolutions before statuses)
  and collapsed the `fetchResolutions` signature onto one line.
- **Fix:** Ran `biome check --write` on the changed files; folded the formatting-only diffs into
  the Task 3 commit.
- **Commit:** d5d9815a

## Verification Results

- `npm run check` (biome check ./src && tsc --noEmit): **clean, exit 0** (460 files checked).
- `vitest run FieldsSection.test.tsx`: **18/18 passing** (3 new resolution tests + existing suite).

## Notes

- `notifications.ts` already maps `resolution` in `TRACKED_FIELDS` — no change needed (confirmed).
- Worktree had no `node_modules`; symlinked the shared checkout's `node_modules` (gitignored, not
  committed) to run tsc/biome/vitest.
- Per CONTEXT/RESEARCH Pitfall 2, Jira screen-config rejection of direct `resolution` edits is the
  accepted failure surface (inline `mutation.isError` message) — not special-cased.

## Self-Check: PASSED
- FOUND: taskflow/src/services/jira/resolutions.ts
- FOUND commit 2f3fd571 (Task 1)
- FOUND commit 10125ce4 (Task 2)
- FOUND commit d5d9815a (Task 3)
