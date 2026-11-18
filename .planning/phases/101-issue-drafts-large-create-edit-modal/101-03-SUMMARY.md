---
phase: 101-issue-drafts-large-create-edit-modal
plan: 03
subsystem: drafts
tags: [zustand, persist, autosave, tauri-store]
requires: []
provides:
  - useIssueDraftsStore / useIssueDraftsHydrated / useSortedIssueDrafts (persisted multi-draft store)
  - useIssueDraft (lazy-id debounced autosave hook)
  - useCreateModalStore (global open create/edit/epic/resume entry)
  - shortRelativeTime
affects: [101-04, 101-06]
key-files:
  created:
    - taskflow/src/stores/issue-drafts.store.ts
    - taskflow/src/stores/issue-drafts.store.test.ts
    - taskflow/src/hooks/useIssueDraft.ts
    - taskflow/src/hooks/useIssueDraft.test.tsx
    - taskflow/src/stores/create-modal.store.ts
    - taskflow/src/stores/create-modal.store.test.ts
  modified:
    - taskflow/src/lib/relative-time.ts
    - taskflow/src/lib/relative-time.test.ts
decisions:
  - saveFailed only flips on change inside the storage wrapper, because setState re-enters persist and would otherwise retry-loop on a persistent write failure
metrics:
  completed: 2026-11-18
---

# Phase 101 Plan 03: Draft data layer Summary

Persisted uuid-keyed issue/epic draft store (issue-drafts.json), a lazy-id debounced autosave hook gated on user content, a global create-modal store with draft resume, and a compact `shortRelativeTime` helper.

## Tasks

1. issue-drafts store: multi-draft upsert/remove/restore, owner reconcile (returns true so callers purge files), save-failure flag excluded from persistence, sorted selector via useMemo.
2. useIssueDraft: reuses `DRAFT_DEBOUNCE_MS`, no id until content exists, hydration guard, unchanged-snapshot skip, adopt/discard/ensureId, flush on hidden and unmount.
3. create-modal store + `shortRelativeTime`: every open action sets all fields; `resumeDraft` routes by draft kind.

## Deviations from Plan

None to production behavior. Notes:
- The global test setup replaces `window.crypto` without `randomUUID`, so the hook test stubs it with `vi.stubGlobal`.
- The pre-commit full suite timed out on unrelated tests (EpicDetailSheet, IssueDetailParts, WorklogsPage) while machine load was ~55 from parallel agents; these pass in isolation. Commits were retried without `--no-verify`.

## Known Stubs

None.

## Self-Check: PASSED (all listed files exist; vitest, tsc and biome green for them)
