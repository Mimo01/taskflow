# Phase 63: Tempo Saved Filters + Test Pass - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Persist Tempo filter state (people + date preset) across app restarts; fix the 2 known test failures in `jira.test.ts`; sweep dead code left behind by v1.9 removals. Phase 63 covers TEMPO-04, TEMPO-05, QUAL-01, QUAL-02.

Phase 62 already built the WorklogsPage with `preset`, `customFrom`, `customTo`, `selectedUsername`, and `selectedDisplayName` as component state. Phase 63 adds the persistence layer and the save/load/rename/delete UX on top of that existing page.

</domain>

<decisions>
## Implementation Decisions

### Saved Filter Storage
- **D-01:** New dedicated `tempo-filters.store.ts` using `createTauriStorage('tempo-filters.json')` + Zustand `persist` middleware. Same pattern as `pinned-tabs.store.ts`. No settings store version bump. (Claude's discretion — saves belong in their own store, not in app configuration.)
- **D-02:** Saved filter record shape: `{ id: string, name: string, preset: DatePreset, username: string | null, displayName: string | null }`. Custom dates (`customFrom`/`customTo`) are **not** persisted — if a "custom" preset is saved, date inputs start empty on load.

### Saved Filter UI
- **D-03:** Saved filters are shown as a separate row **above** the existing preset pills row. The row is only rendered when at least one saved filter exists (no empty row).
- **D-04:** Save interaction: a "Save filter" button at the end of the main filter bar. Clicking it toggles a small inline text input + confirm/cancel (same row). No popover component. (Claude's discretion — inline is simpler.)
- **D-05:** Edit interactions on saved filter pills: × button on hover for delete (matching the Jira saved filter inline delete from v1.5); double-click on the pill label to rename inline. (Claude's discretion — matches existing codebase conventions.)
- **D-06:** Clicking a saved filter pill in the saved-filters row applies it: sets `preset` and `selectedUsername`/`selectedDisplayName` in the WorklogsPage component state, triggering a re-fetch.

### Test Fix
- **D-07:** The 2 failures in `jira.test.ts` are caused by the `discoverCustomFields` test not expecting `flaggedFieldKey`. The field was intentionally added (it is actively used in `main.tsx`, `BacklogPage.tsx`, and `settings.store.ts`). Fix = update the test expectation to include `flaggedFieldKey: 'customfield_10021'`.
- **D-08:** Phase 62 tests (WorklogsPage.test.tsx, Sidebar.test.tsx) all pass (24/24). No further Phase 62 audit needed. After Phase 63 additions, run the full suite to verify QUAL-01.

### Dead Code Sweep
- **D-09 (Claude's discretion):** Scope the sweep to dead code from removed features (QUAL-02 literal scope): unused imports referencing deleted widget/workload files, stale `widget` or `workload` mentions in non-deleted source files, and any unused imports introduced by Phase 62. Leave unrelated cleanup to a future pass.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §"Tempo Worklog Viewer" — TEMPO-04, TEMPO-05 (saved filter persistence requirements)
- `.planning/REQUIREMENTS.md` §"Quality & Cleanup" — QUAL-01, QUAL-02 (test pass + dead code sweep)

### Phase Details
- `.planning/ROADMAP.md` §"Phase 63: Tempo Saved Filters + Test Pass" — goal, 4 success criteria, dependencies

### Prior Phase Context (MUST read before touching WorklogsPage)
- `.planning/phases/62-tempo-worklog-viewer-ui/62-CONTEXT.md` — all WorklogsPage decisions locked in Phase 62
- `.planning/phases/61-tempo-probe-service-layer/61-CONTEXT.md` — Tempo service module structure and auth decisions

### Persistence Pattern to Mirror
- `taskflow/src/stores/pinned-tabs.store.ts` — exact template for the new `tempo-filters.store.ts`: Zustand `persist` + `createTauriStorage('filename.json')` + version field + migrate function
- `taskflow/src/lib/tauri-storage.ts` — `createTauriStorage(filename)` factory used by all LazyStore-backed Zustand stores

### Existing Saved Filter Pattern (Jira — for UI reference only)
- `taskflow/src/stores/saved-filter.store.ts` — Jira saved filter store (session-only; different from Tempo which needs persistence); reference for store shape conventions
- Inline delete pattern from v1.5: inline × on hover without a nested dialog

### WorklogsPage (Phase 62 output)
- `taskflow/src/routes/worklogs/WorklogsPage.tsx` — the page being extended with save/load UX; all filter state lives here as component state
- `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` — test file to extend with TEMPO-04/TEMPO-05 coverage

### Test Fix
- `taskflow/src/services/jira.test.ts` — the failing test file; `discoverCustomFields` test at line ~929 needs `flaggedFieldKey: 'customfield_10021'` added to expected object
- `taskflow/src/services/jira.ts` line 1309 — `discoverCustomFields` implementation (for reference)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createTauriStorage` from `taskflow/src/lib/tauri-storage.ts` — the factory for Zustand LazyStore persistence; use directly in the new `tempo-filters.store.ts`
- `usePinnedTabsStore` from `taskflow/src/stores/pinned-tabs.store.ts` — exact structural template for `tempo-filters.store.ts`
- WorklogsPage filter state: `preset`, `customFrom`, `customTo`, `selectedUsername`, `selectedDisplayName` — these are what saved filter pills write back on load

### Established Patterns
- **Zustand persist + createTauriStorage:** all local-persistent stores (`pinned-tabs.store.ts`, `recent-items.store.ts`) use this — no LazyStore singleton, just `createTauriStorage(filename)` in the persist options
- **LazyStore mock in tests:** `src/test/setup.ts` mocks `@tauri-apps/plugin-store` globally with a `Map`-based `LazyStore` — the new store will work in tests automatically
- **Saved filter UX shape:** `{ id, name }` with × delete on hover and double-click rename — consistent with `useSavedFilterStore` conventions

### Integration Points
- `taskflow/src/routes/worklogs/WorklogsPage.tsx` — add the saved-filters row above the preset pills, the Save button at the end of the filter bar, and the load/rename/delete handlers; import from new `tempo-filters.store.ts`
- New file: `taskflow/src/stores/tempo-filters.store.ts` — the persistent store
- New file (optional): `taskflow/src/stores/tempo-filters.store.test.ts` — unit tests for save/load/rename/delete actions
- `taskflow/src/services/jira.test.ts` line ~929 — one-line fix to the `discoverCustomFields` test

</code_context>

<specifics>
## Specific Ideas

- Saved filter pill row: renders above the preset pills row, hidden when `savedFilters.length === 0`
- Active saved filter: when a saved filter is loaded, its pill can be visually highlighted (e.g., `bg-primary text-primary-foreground`) to indicate it's the current active filter — similar to the active preset pill style
- Save button label: "Save filter" or a bookmark/save icon button — Claude's discretion on icon vs text
- Store version: start at `version: 1` with identity migrate (same as pinned-tabs store initial version)
- `id` generation: `crypto.randomUUID()` or a timestamp-based ID — Claude's discretion

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 63-Tempo Saved Filters + Test Pass*
*Context gathered: 2026-05-21*
