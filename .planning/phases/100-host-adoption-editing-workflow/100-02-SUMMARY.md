---
phase: 100-host-adoption-editing-workflow
plan: 02
subsystem: editor-drafts
tags: [zustand, persist, drafts, FLOW-01]
requires: []
provides:
  - useDraftsStore (drafts.json persisted drafts + owner)
  - draftKey helpers
  - useEditorDraft hook (debounce 500 ms, flush, discard, stale)
  - useDraftsAccountGuard (D-21)
affects: [100-06, 100-07, 100-08]
key-files:
  created:
    - taskflow/src/lib/draft-keys.ts
    - taskflow/src/stores/drafts.store.ts
    - taskflow/src/stores/drafts.store.test.ts
    - taskflow/src/hooks/useDraftsAccountGuard.ts
    - taskflow/src/hooks/useDraftsAccountGuard.test.tsx
    - taskflow/src/hooks/useEditorDraft.ts
    - taskflow/src/hooks/useEditorDraft.test.tsx
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/routes/settings/ConnectionsSection.tsx
    - taskflow/src/routes/settings/ConnectionsSection.test.tsx
decisions:
  - Pre-hydration guard reads useDraftsStore.persist.hasHydrated() inside flush (not hook state), so no write can race hydration
  - Pending write captures its own key/base, so unmount or key-switch flush writes the draft being left
metrics:
  tasks: 2
  completed: 2026-11-17
---

# Phase 100 Plan 02: Local drafts layer Summary

Persisted zustand drafts store (drafts.json), key helpers, a debounced `useEditorDraft` hook and a Jira-account guard that clears drafts only on a real account change.

## Tasks

1. Drafts store, key helpers, account guard, wiring in main.tsx and ConnectionsSection Jira onConnected: 1913428b
2. useEditorDraft hook (500 ms debounce, flush on blur/unmount/visibilitychange, discard, stale verdict, no pre-hydration writes, no duplicate writes): 71ec7528

## Deviations from Plan

**1. [Rule 3 - Blocking] ConnectionsSection.test.tsx auth-store mock lacked getState**
- Issue: the mock `useAuthStore` was a plain function; the new `useAuthStore.getState()` call in onConnected threw.
- Fix: mock now `Object.assign(() => mockAuthStore, { getState: () => mockAuthStore })` and adds `jiraUsername`. Production code unchanged.
- Commit: 1913428b

**2. [Style] Biome import ordering** in ConnectionsSection.tsx fixed with `biome check --write` on that single file.

`npm run check` has pre-existing diagnostics in unrelated files (3 errors, 45 warnings); touched files are clean and `tsc --noEmit` passes. Full vitest suite passed in both commit hooks.

## Known Stubs

None.

## Threat Flags

None. T-100-05/06/07 mitigations implemented (owner reconcile, string-only drafts, no pre-hydration writes).

## Self-Check: PASSED
