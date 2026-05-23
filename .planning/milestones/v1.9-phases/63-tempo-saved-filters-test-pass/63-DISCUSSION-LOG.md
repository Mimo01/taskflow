# Phase 63: Tempo Saved Filters + Test Pass - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 63-tempo-saved-filters-test-pass
**Areas discussed:** Saved filter storage, Save/load/rename/delete UX, Test fix scope, Dead code sweep depth

---

## Saved Filter Storage

### Where to store

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated store file | tempo-filters.store.ts using createTauriStorage('tempo-filters.json') + Zustand persist | ✓ |
| Add to settings.store.ts v21 | Add savedTempoFilters[] to the existing settings store, bump to v21 | |
| You decide | Claude picks the most consistent approach | |

**User's choice:** "You decide"
**Notes:** Claude chose dedicated store file — consistent with pinned-tabs.store.ts and recent-items.store.ts precedents. Settings store is for app configuration; filter presets are user workflow data.

### Saved filter data model

| Option | Description | Selected |
|--------|-------------|----------|
| preset + username + custom dates | Full state including customFrom/customTo | |
| preset + username only | Custom dates not persisted | ✓ |
| You decide | Claude picks fullest model | |

**User's choice:** Preset + username only (no custom dates)
**Notes:** TEMPO-04 says "people selection + date preset" — custom date ranges are transient. If a "custom" preset is saved, date inputs start empty on load.

---

## Save/Load/Rename/Delete UX

### Where saved filters are surfaced

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown button before preset pills | 'Saved' button opens small dropdown, click name applies it | |
| Separate row above filter bar | Full-width row above preset pills shows saved filter pills | ✓ |
| You decide | Claude picks approach that fits without layout changes | |

**User's choice:** Separate row above the filter bar
**Notes:** Row only renders when at least one saved filter exists.

### Save interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Inline name input in filter bar | 'Save filter' button toggles small text input inline | |
| Popover from a save button | Clicking opens popover with text input + buttons | |
| You decide | Claude picks simpler option | ✓ |

**User's choice:** "You decide"
**Notes:** Claude chose inline name input — no new component type, simpler interaction.

### Rename and delete

| Option | Description | Selected |
|--------|-------------|----------|
| × delete on hover; double-click to rename | Hover shows × for delete; double-click for inline rename | |
| Right-click context menu | Rename/Delete in context menu | |
| You decide | Claude picks closest to existing conventions | ✓ |

**User's choice:** "You decide"
**Notes:** Claude chose × on hover + double-click rename — matches Jira saved filter inline delete pattern from v1.5.

---

## Test Fix Scope

### Fix approach for jira.test.ts

| Option | Description | Selected |
|--------|-------------|----------|
| Update the test | Add flaggedFieldKey to expected object | |
| Investigate before touching | Verify flaggedFieldKey is actually used downstream first | ✓ |

**User's choice:** Investigate before touching
**Notes:** Live grep confirmed flaggedFieldKey is actively used in main.tsx, BacklogPage.tsx (10+ references), and settings.store.ts. Fix = update test expectation. Intentional field, stale test.

### Phase 62 test audit

| Option | Description | Selected |
|--------|-------------|----------|
| Targeted fix + full suite run | Fix known failure, run full suite | |
| Audit Phase 62 tests first | Inventory Phase 62 tests before fixing | ✓ |

**User's choice:** Audit Phase 62 tests first
**Notes:** Live run confirmed WorklogsPage.test.tsx (24/24) and Sidebar.test.tsx all pass. No Phase 62 regressions. Only jira.test.ts needs fixing.

---

## Dead Code Sweep Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Stale widget/workload refs only | Focus on what Phase 59 removals may have left | |
| Full codebase unused import scan | Run Biome noUnusedImports across codebase | |
| You decide | Claude scopes to QUAL-02 literal scope | ✓ |

**User's choice:** "You decide"
**Notes:** Claude chose: dead code from removed features only — unused imports referencing deleted widget/workload files, stale mentions in non-deleted files, unused imports from Phase 62. Unrelated cleanup deferred.

---

## Claude's Discretion

- **Saved filter storage mechanism** — dedicated `tempo-filters.store.ts` (not settings store extension)
- **Save interaction** — inline text input (not popover)
- **Edit interactions** — × on hover for delete; double-click to rename (matching v1.5 Jira saved filter pattern)
- **Dead code sweep scope** — removed-feature dead code only; not a full codebase unused import scan

## Deferred Ideas

None — discussion stayed within phase scope.
