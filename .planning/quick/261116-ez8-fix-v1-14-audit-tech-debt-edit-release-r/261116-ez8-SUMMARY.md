---
quick_id: 261116-ez8
status: complete
commits: [0b497f51]
---

# Quick 261116-ez8: Fix v1.14 audit tech debt — Summary

**One fix, two items closed as non-defects.** After saving a new Jira token, global search's backlog index and board lookup no longer refetch with the old token.

## Fixed

- `useGhBacklogData.ts` now reads `credentialsRevision`, stores the revision with each PAT read, and enables the query only when both the base URL and the revision are current. Before the fix, the render after `queryClient.clear()` and `bumpCredentialsRevision()` (`ConnectionsSection.tsx:514`) refetched the backlog with the old token. The new token then arrived on a fresh-data key, so nothing refetched again.
- `useGlobalSearchSources.ts` gets the same guard, so `useBoardId` and the loading/error flags (`secretRead`) ignore a read made before the save. The `biome-ignore` comments became unnecessary because the effect now reads the revision, so I removed them.

## Tests

- `useGhBacklogData.test.tsx`: after a clear and revision bump, the hook refetches with the rotated token and makes exactly 2 calls (no old-token call in between).
- `useGlobalSearchSources.test.tsx`: after a credential save, no board or backlog call carries the old PAT.
- Both tests fail against the HEAD sources (checked on a temporary copy) and pass with the fix. Full suite on commit: 339 files, 5306 tests passed.

## Not changed (verified non-defects)

- **Edit-release RM refresh.** RM data doesn't depend on the fix version. The package match re-derives from the invalidated `jira-fix-versions`.
- **Breakdown seed invalidation.** The seed is a disabled query fed by `setQueryData`, so invalidating it would do nothing, and batch refetches rewrite it.

## Remaining from the audit (not code)

- Phase 95 real-avatar check in Tauri (human).
- Phase 94/95 VALIDATION.md still in draft (`/gsd-validate-phase 94`, `/gsd-validate-phase 95`).
