# Quick Task: Remove Jira "Save Filter" Flow — Research

**Researched:** 2026-05-31
**Domain:** Deletion / refactor (React + Zustand, taskflow Tauri app)
**Confidence:** HIGH (all findings verified via grep + file reads against `taskflow/src`)

> All paths below are relative to `taskflow/src`. All greps/builds must run from `taskflow/`.

## Summary

The Jira saved-filter subsystem is **cleanly separable** from the kept local "Save" QuickFilters flow. The known delete/edit surface in the focus brief is **complete and accurate**, with **three additions** the planner must handle (see COMPLETENESS). The Tempo `savedFilters`/`activeFilterId` names in `WorklogsPage.tsx` + `tempo-filters.store.ts` are a **separate subsystem — leave untouched** (false-positive string matches only).

**Primary recommendation:** Delete the 7 files (+ 3 test files), edit 5 consumers, then run `npm run check` from `taskflow/`. Biome WILL flag newly-unused imports after edits — three are pre-identified below.

## Completeness Audit — Every Reference (verified)

### DELETE entirely (focus list confirmed — all refs are self-contained or in the delete-set)
| File | Notes |
|------|-------|
| `components/SaveFilterDialog.tsx` | imports `createJiraFilter`, `useSavedFilterStore`, `JiraSavedFilter` |
| `components/EditFilterDialog.tsx` | imports `updateJiraFilter`, `useSavedFilterStore`, `JiraSavedFilter` |
| `components/SavedFilterList.tsx` | imports `deleteJiraFilter`, `EditFilterDialog`, `useSavedFilterStore`, `JiraSavedFilter` |
| `components/SavedFilterList.test.tsx` | mocks `./EditFilterDialog`, `@/services/jira/filters`, `@/stores/saved-filter.store` |
| `stores/saved-filter.store.ts` | defines `useSavedFilterStore`; imports `JiraSavedFilter` |
| `stores/saved-filter.store.test.ts` | |
| `hooks/useSavedFilterSync.ts` | imports `fetchFavouriteFilters`, `useSavedFilterStore` |
| `services/jira/filters.ts` | the 4 functions |
| `services/jira/filters.test.ts` | |

`SavedFilterList.tsx` is the **only** consumer of `SavedFilterList` and is itself deleted — no external render site exists (grep confirmed only self/test refs). Same for `EditFilterDialog` (rendered only inside `SavedFilterList.tsx:164` + its test).

### EDIT (remove refs, keep rest working)
| File:line | What to remove | Resulting unused import to also remove |
|-----------|----------------|----------------------------------------|
| `components/UnifiedFilterBar.tsx:26` | `import { SaveFilterDialog }` | — |
| `components/UnifiedFilterBar.tsx:199` | `const [saveDialogOpen, setSaveDialogOpen] = useState(false)` | — |
| `components/UnifiedFilterBar.tsx:500-510` | the "Save Filter" `<Button>` block (the 2nd one, gated on `jiraBaseUrl`) | — |
| `components/UnifiedFilterBar.tsx:569-577` | `{jiraBaseUrl && <SaveFilterDialog .../>}` block | see SHARED CODE: `currentJql`/`currentJqlClauses` (218-243) become unused → remove |
| `components/app/CommandPalette.tsx:37` | `import { useSavedFilterStore }` | `Bookmark` import @15 (`Bookmark, SearchX`) becomes unused → drop `Bookmark`, keep `SearchX` |
| `components/app/CommandPalette.tsx:75-76` | `savedFilters` + `setActiveFilter` selectors | — |
| `components/app/CommandPalette.tsx:294-313` | "Saved Filters" group (default state) | — |
| **`components/app/CommandPalette.tsx:432-450`** | **SECOND "Saved Filters" group (always-visible) — NOT in focus brief** | — |
| `routes/dashboard/SprintBoardTab.tsx:50` | `import { useSavedFilterStore }` | `Bookmark` import @16 (`Bookmark, Columns3, RefreshCw`) → drop `Bookmark`; `fetchAllSearchPages` import @44 → unused, remove |
| `routes/dashboard/SprintBoardTab.tsx:965-968` | 3 selectors + `activeFilter` derive | — |
| `routes/dashboard/SprintBoardTab.tsx:970-981` | the `savedFilterIssueKeys` `useQuery` block | — |
| `routes/dashboard/SprintBoardTab.tsx:1050-1060` | the JQL-intersection `if (savedFilterIssueKeys...)` block | — |
| `routes/dashboard/SprintBoardTab.tsx:1231-1247` | the "Active saved filter banner" JSX block | — |
| `main.tsx:34` | `import { useSavedFilterSync }` | — |
| `main.tsx:495` | `useSavedFilterSync();` call | — |
| `services/jira/index.ts:10` | `export * from './filters';` | — |

### FLAGGED — NOT in focus brief (planner must add to plan)
1. **`CommandPalette.tsx:432-450`** — a **second** "Saved Filters" `<CommandGroup>` (the "always visible when filters exist" branch). The brief only named ~295-313. Both must be removed; both use the same `savedFilters`/`setActiveFilter`/`Bookmark`.
2. **`CommandPalette.tsx:15`** — `Bookmark` is imported only for these two groups (uses at 308, 446). After removal it's unused → biome flag. Keep `SearchX`.
3. **`SprintBoardTab.tsx:44`** `fetchAllSearchPages` import + **`:16`** `Bookmark` import — both used ONLY by the saved-filter code (`fetchAllSearchPages` at 975 only; `Bookmark` at 1234 only). Both become unused → biome flag.

### NOT references — DO NOT TOUCH (Tempo subsystem, separate)
- `stores/tempo-filters.store.ts` — its own `savedFilters` field (TempoFilter[]).
- `routes/worklogs/WorklogsPage.tsx` (lines 284, 312, 734, 750, 766-825) — Tempo `activeFilterId`/`savedFilters` via `useTempoFiltersStore`. Brief says leave WorklogsPage alone. Confirmed unrelated.
- `stores/tempo-filters.store.test.ts`, `WorklogsPage.test.tsx:111,657` — Tempo tests.

## Shared-Code Risk Analysis

### SprintBoardTab — SAFE, cleanly separable
The saved-filter narrowing and local-filter narrowing are **sequential, independent blocks** sharing only the reassignable `let filteredSwimlanes` accumulator:
```
1048: let filteredSwimlanes = swimlanes;
1050-1060: if (savedFilterIssueKeys...) { filteredSwimlanes = ... }   ← DELETE this block
1062-1078: if (activeEpics.size>0 || ...) { filteredSwimlanes = ... } ← KEEP (local filters)
```
Removing lines 1050-1060 leaves `filteredSwimlanes` starting from `swimlanes` and flowing straight into the local-filter block. **No shared variable breaks.** `filteredSwimlanes` itself stays (used at 132, 186, 412, 429, 1264-1266 for rendering/virtualization — all kept).
- `activeFilter` (968) feeds only: the `useQuery` (972,974,980), the banner (1232-1235), `setActiveFilter` clear (1241). All deleted together.
- `fetchAllSearchPages` (975) — imported at line 44 **solely** for this query. Remove import.
- `Bookmark` icon (1234) — used **solely** in the deleted banner. Remove from import @16.
- `useFilterStore` selectors (`activeEpics` etc. @962-963) — KEPT, drive the local block. Untouched.

### UnifiedFilterBar — SAFE, two Save buttons fully independent
- **KEEP** local "Save" button (488-499): gated `hasActiveFilters && !savingName && !activeFilterMatchesSaved`, calls `handleStartSave`, uses `BookmarkPlus`.
- **DELETE** "Save Filter" button (501-510): same gates **plus `&& jiraBaseUrl`**, calls `setSaveDialogOpen(true)`, uses `BookmarkPlus`.
- `BookmarkPlus` (import @13) is **shared** by both → KEEP it. `Bookmark` (@12) used at 356/394 (filter chips) → KEEP.
- `saveDialogOpen` state (@199) used only by deleted button + dialog → remove.
- `currentJql`/`currentJqlClauses` (218-243) feed **only** `<SaveFilterDialog jql={currentJql}/>` (574). After removing the dialog they're unused → **remove 218-243 too** (else biome flags `currentJql` unused).
- `jiraBaseUrl` (@198 `useAuthStore`) used at 501, 570, 575 (all deleted). After removal `jiraBaseUrl` is unused → **remove from the `useAuthStore()` destructure @198** (verify no other use; grep showed none).
- The local QuickFilter input/save UI (513-548 `savingName` block) is independent → KEEP entirely.

## Type / Import Fallout

`JiraSavedFilter` (defined `services/jira/types.ts:262`) is consumed ONLY by files in the delete-set: `saved-filter.store.ts`, `SaveFilterDialog.tsx`, `EditFilterDialog.tsx`, `SavedFilterList.tsx`, `filters.ts`, + the def in `types.ts`. **Recommendation:** the interface in `types.ts:262-269` becomes orphaned. Safe to **delete the `JiraSavedFilter` interface** too (optional cleanup; leaving it causes no error since `export * from './types'` is kept, but it's dead code). No other type imports break.

Barrel: removing `export * from './filters'` (`index.ts:10`) breaks nothing else — `filters.ts` exports only the 4 functions, all consumers deleted.

## Test Impact

| Test file | Action |
|-----------|--------|
| `stores/saved-filter.store.test.ts` | DELETE (whole subject deleted) |
| `services/jira/filters.test.ts` | DELETE |
| `components/SavedFilterList.test.tsx` | DELETE |
| `components/app/CommandPalette.test.tsx` | **No saved-filter refs** (grep empty) → no edit needed |
| `components/UnifiedFilterBar.test.tsx` | **No `SaveFilterDialog`/`Save Filter` refs** (grep empty) → no edit needed |
| `routes/dashboard/SprintBoardTab.test.tsx` | Does NOT mock `useSavedFilterStore` (real store default = empty `savedFilters`, so saved-filter path was already inert in tests). Mocks `fetchAllSearchPages` @139-141 + stale comment @138 "saved filter integration". After source edit removes the only `fetchAllSearchPages` consumer, **the mock becomes harmless but stale** — recommend removing the `@/services/jira/client` mock (138-141) and its comment for hygiene. Not strictly required for green. |
| `routes/worklogs/WorklogsPage.test.tsx:683` | Comment mentions `SavedFilterList.test.tsx` as a precedent. After deleting that file the comment dangles but is harmless. Optional: reword. LEAVE WorklogsPage logic alone per brief. |

## Verification Gates (run from `taskflow/`)

```bash
# Primary gate — MUST be green (biome check + tsc --noEmit)
npm run check

# Auto-fix unused imports/formatting biome flags after edits
npm run fix          # = biome check --write ./src

# Tests
npm run test         # = vitest run
```
- `package.json:16` → `"check": "biome check ./src && tsc --noEmit"`
- `package.json:19` → `"test": "vitest run"`

**Expected biome flags before cleanup** (all pre-identified above): unused `Bookmark` in CommandPalette.tsx & SprintBoardTab.tsx, unused `fetchAllSearchPages` in SprintBoardTab.tsx, unused `currentJql`/`currentJqlClauses`/`jiraBaseUrl`/`saveDialogOpen` in UnifiedFilterBar.tsx. Per MEMORY: `biome check` (gate) ≠ `biome lint`; trust `npm run check`. `npm run fix` will auto-remove unused imports.

## Recommended Execution Order
1. Delete the 7 source files + 3 test files.
2. Edit `services/jira/index.ts` (drop filters export).
3. Edit the 4 consumers (UnifiedFilterBar, CommandPalette ×2 groups, SprintBoardTab, main.tsx), removing refs **and** the newly-unused imports listed above.
4. (Optional) drop `JiraSavedFilter` interface + stale test mocks/comments.
5. `npm run fix` then `npm run check` → expect green. `npm run test` → expect green.

## Assumptions Log
| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | `jiraBaseUrl` from `useAuthStore()` @198 has no other consumer in UnifiedFilterBar | LOW — grep showed only 501/570/575; verify before removing the destructure |
| A2 | Deleting `JiraSavedFilter` interface is safe | NONE — it's exported via barrel but has zero remaining importers; leaving it is also fine |

## Sources
- Verified via grep + Read across `taskflow/src` (HIGH). No external docs needed (deletion task).
