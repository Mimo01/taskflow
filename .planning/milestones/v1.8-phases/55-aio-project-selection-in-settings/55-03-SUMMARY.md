---
phase: 55-aio-project-selection-in-settings
plan: 03
subsystem: sidebar
tags: [sidebar, navlink, gating, dynamic-route, aio]

# Dependency graph
requires:
  - phase: 55-aio-project-selection-in-settings
    plan: 01
    provides: "selectedAioProjectKey: string | null on useSettingsStore (defaults null) + setSelectedAioProjectKey setter + v17 persist migration"
provides:
  - "Sidebar.tsx destructures selectedAioProjectKey from useSettingsStore (Pitfall 2 mitigated — Zustand shallow-equal subscription now picks up changes)"
  - "Sidebar 'testing' section gated on (aioEnabled && selectedAioProjectKey) — D-09"
  - "'aio-projects' NavLink href computed dynamically as /aio-project/${selectedAioProjectKey} at render time — D-09, D-10 Option B"
  - "sidebar-items.ts 'aio-projects' path field changed to '/aio' sentinel (never resolves to a real route — D-10 Option B per RESEARCH.md recommendation, Pitfall 5 mitigated)"
  - "Sidebar.test.tsx mock state and renderSidebar helper extended with selectedAioProjectKey support; 3 new gate tests + 1 in-place updated existing test"
affects:
  - "55-04 (route removal): consumes the '/aio' sentinel — Plan 04 deletes the matching '/aio-projects' route in routes.tsx + AioProjectsPage.tsx so the sentinel never matches any real route. The /aio-project/:projectKey route (Phase 52) STAYS — it is the destination this plan deep-links to."

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sidebar render-time intercept by nav.id ('aio-projects') with ternary on the NavLink `to` prop — the simplest possible dynamic-path representation; no new abstractions (RESEARCH.md D-10 Resolution rejected Options A and C)"
    - "Sentinel path '/aio' in static SIDEBAR_NAV_ITEMS table (clearly invalid as a real route; fails obviously if the intercept is ever removed)"
    - "Mock-state extension pattern: when adding a new Zustand field consumed by a component, the matching test file must extend the `state` object in `vi.mock('@/stores/settings.store', ...)` AND add a module-level `mock<FieldName>` variable that the per-test helper mutates (parallel to mockAioEnabled — Pitfall 4)"

key-files:
  created: []
  modified:
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/components/app/sidebar-items.ts
    - taskflow/src/components/app/Sidebar.test.tsx

key-decisions:
  - "D-10 implemented as Option B (sentinel path '/aio') per RESEARCH.md recommendation — sentinel is self-documenting and fails clearly if the intercept is ever removed; cleaner diff than Option A's dead placeholder, no over-engineering vs Option C's resolvePath function"
  - "Plan-order implementation-before-tests (matching Plan 55-01's approach): Task 1 ships impl + 1 expected pre-existing test break, Task 2 fixes the mock and adds the 3 new tests. Strict RED-first would require writing all 4 tests first against a still-static path, which is more work for no additional safety since the gate-extension is a 1-line predicate change."
  - "Defensive note in code: the filter guarantees selectedAioProjectKey is non-null when the intercept branch is hit, but no runtime null-check is added (template literal would still produce a string, just never reached). Comment in Sidebar.tsx documents the invariant."
  - "Pre-commit hook bypassed with --no-verify per approved policy (feedback_no_verify_lint.md): pre-existing biome errors in files NOT touched by this plan (e.g., test mocks, WikiRenderer.test.tsx). My edits introduce 0 new errors verified via `biome check` on the 3 touched files."

patterns-established:
  - "Zustand-driven sidebar dynamic routing: when a nav item's `to` must depend on store state, extend the destructure at line 70, then add the `nav.id === 'X' ? <dynamic> : nav.path` ternary inside the section.items.map render — keeps SIDEBAR_NAV_ITEMS as a static config and avoids inflating SidebarNavDef with a resolver function"
  - "Test-mock extension recipe for new Zustand fields consumed by Sidebar: add `let mockX: T = default;` at module scope, add `X: mockX` inside the vi.mock state object, extend `renderSidebar(...)` with an optional parameter that mutates `mockX`. Existing tests that depend on the old behavior must explicitly set the new field via the helper's new parameter."

requirements-completed: []

# Metrics
duration: ~14min
completed: 2026-05-14
---

# Phase 55 Plan 03: Sidebar AIO Project Deep-Link Summary

**Wires the consumer side of Plan 01's `selectedAioProjectKey` store field — `Sidebar.tsx` now hides the AIO Projects nav item until a project is picked (D-09) and deep-links its NavLink href to `/aio-project/${selectedAioProjectKey}` (D-09, D-10 Option B); `sidebar-items.ts` `'aio-projects'` path becomes the `/aio` sentinel; `Sidebar.test.tsx` gains 3 new tests covering the gate and dynamic href with 1 existing test updated in-place. Sets up Plan 04 to delete the old `/aio-projects` route safely.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-14T17:37Z (approx — worktree spawn + npm install)
- **Completed:** 2026-05-14T17:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `Sidebar.tsx` line 70 destructure now includes `selectedAioProjectKey` — Zustand shallow-equal subscription re-renders the sidebar when the value changes (Pitfall 2 mitigated)
- `Sidebar.tsx` line 277 filter predicate extended to `!(nav.section === 'testing' && (!aioEnabled || !selectedAioProjectKey))` — single line change, no structural refactor (D-09)
- `Sidebar.tsx` NavLink rendering (~line 345) intercepts `nav.id === 'aio-projects'` with a `const navTo` ternary that computes `/aio-project/${selectedAioProjectKey}` at render time — D-10 Option B
- `sidebar-items.ts` `'aio-projects'` item `path` changed from `/aio-projects` to `/aio` sentinel; defensive inline comment documents that `Sidebar.tsx` overrides the `to` prop (Pitfall 5 mitigated)
- `Sidebar.test.tsx`: new `mockSelectedAioProjectKey: string | null` module-level variable; mock state extended; `renderSidebar(aioEnabled, selectedAioProjectKey?)` helper; existing `aioEnabled=true → visible` test updated in-place to pass `'PROJ'`; 3 new tests covering (a) null hides AIO Projects, (b) string shows it, (c) NavLink href = `/aio-project/PROJ`
- Full Sidebar test file: 5 tests pass (2 prior + 3 new); `tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Sidebar.tsx — destructure, filter, and dynamic NavLink to** + **sidebar-items.ts sentinel path** — `bc27ac5` (feat) — committed with `--no-verify` (pre-existing unrelated biome errors)
2. **Task 2: Extend Sidebar.test.tsx with selectedAioProjectKey gate + dynamic href tests** — `71da592` (test) — committed with `--no-verify` (same reason)

**Plan metadata + deferred-items.md amendment:** to be committed alongside this SUMMARY.md (docs).

## Files Created/Modified

- **`taskflow/src/components/app/Sidebar.tsx`** — line 70 destructure (+ `selectedAioProjectKey`), line 277 filter predicate, lines 343-347 NavLink intercept block (added a 4-line `const navTo = ...` with inline comment, then `to={navTo}` replacing `to={nav.path}`)
- **`taskflow/src/components/app/sidebar-items.ts`** — `'aio-projects'` item `path` field changed from `/aio-projects` to `/aio` sentinel; inline comment above the field documents the rationale
- **`taskflow/src/components/app/Sidebar.test.tsx`** — added `let mockSelectedAioProjectKey: string | null = null;` at module scope; extended mock state with `selectedAioProjectKey: mockSelectedAioProjectKey`; widened `renderSidebar(...)` signature; updated `'aioEnabled=true → visible'` test to pass `'PROJ'`; appended 3 new `it()` cases at end of existing `describe('Sidebar — aioEnabled gate', ...)` block
- **`.planning/phases/55-aio-project-selection-in-settings/deferred-items.md`** — appended new section "Pre-existing Biome Errors (Phase 55-03)" documenting the `--no-verify` bypass and confirming biome check on the 3 touched files reports 0 new errors (10 pre-existing warnings only)

## Line-Number Traceability (for 55-04 / downstream agents)

`taskflow/src/components/app/Sidebar.tsx`:

| Anchor | Line(s) | Content |
| --- | --- | --- |
| Destructure | 70 | `const { devToolsEnabled, sidebarItems, aioEnabled, selectedAioProjectKey } = useSettingsStore();` |
| Filter predicate | 277 | `!(nav.section === 'testing' && (!aioEnabled || !selectedAioProjectKey)),` |
| navTo intercept | 343-347 | `// Phase 55 D-10: ... const navTo = nav.id === 'aio-projects' ? \`/aio-project/${selectedAioProjectKey}\` : nav.path;` |
| NavLink to= consumer | 350 | `to={navTo}` |

`taskflow/src/components/app/sidebar-items.ts`:

| Anchor | Line(s) | Content |
| --- | --- | --- |
| Sentinel comment | 78-79 | `// sentinel: real \`to\` is computed in Sidebar.tsx as \`/aio-project/${selectedAioProjectKey}\` — see Phase 55 D-10` |
| Sentinel path | 80 | `path: '/aio',` |

## Decisions Made

- **D-10 Option B (sentinel `/aio`) implemented.** The recommendation in RESEARCH.md was Option B — cleanest diff, self-documenting, fails obviously if the intercept is ever removed. Option A (leave `/aio-projects` as dead placeholder) was rejected because the literal would look like a real route and could mislead future readers / tests. Option C (`resolvePath: (state) => string` on `SidebarNavDef`) was rejected as over-engineered — only one item needs dynamic routing, no future items planned.
- **Plan-order implementation-before-tests** (matching Plan 55-01's Phase 51 / 55-01 approach). Strict RED-first would have required four test stubs against unchanged Sidebar code to fail in the expected way (gate doesn't exist yet), then the impl, then unstubbing. Plan order was: Task 1 implements + breaks 1 existing test (documented in plan as the "one breaking change"); Task 2 fixes the mock and adds 3 new tests. Same net outcome, smaller cognitive load.
- **Defensive in-code comment, no runtime null-check.** The filter at line 277 guarantees `selectedAioProjectKey` is non-null when the intercept branch at line 347 is hit. A `selectedAioProjectKey ?? ''` fallback would add dead-code complexity. The 2-line comment block above the ternary documents the invariant and the threat-model rationale (T-55-08: server-controlled enum, never user free-text).
- **`--no-verify` for both task commits**, per the approved policy (`feedback_no_verify_lint.md`). Pre-commit hook (`npm run check` → biome) fails on pre-existing errors in files NOT touched by this plan (e.g., `WikiRenderer.test.tsx` per Plan 55-01's deferred-items entry, plus a `LazyStore` mock issue at ~line 45 visible in the husky output). My touched files introduce 0 new errors — verified by running `biome check` on the 3 files explicitly: "Found 10 warnings" (all pre-existing, same warnings present before my edits).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Pre-existing Issues Encountered (out of scope, logged not fixed)

**1. [Out-of-scope] Pre-existing biome formatter errors in files NOT touched by this plan**
- **Found during:** Task 1 + Task 2 commit (husky pre-commit `npm run check` failure: `Found 1 error. Found 670 warnings.`)
- **Issue:** Various pre-existing biome lint/format issues across the codebase (continuing from Plan 55-01's discovery — `WikiRenderer.test.tsx:202-204`, plus a `LazyStore` mock pattern visible in the husky stack trace at ~line 45).
- **Action:** Logged to `deferred-items.md`. Both task commits made with `--no-verify` per the standing approval (`feedback_no_verify_lint.md`).
- **Files I modified introduce 0 new errors** — verified via `biome check` on `Sidebar.tsx`, `sidebar-items.ts`, and `Sidebar.test.tsx`: 10 warnings, all pre-existing (same pre-edit and post-edit).
- **Suggested follow-up:** `cd taskflow && npm run fix` in a cleanup commit/quick task.

---

**Total deviations from plan:** 0
**Impact on plan:** None — plan delivered exactly as specified.

## Issues Encountered

- **Worktree had no `node_modules` on spawn.** Ran `npm install` inside `taskflow/` (background task) to make `tsc`/`vitest` runnable. The installed `node_modules` is gitignored — not staged into any commit.
- **Husky pre-commit hook bypassed twice** (once per task commit) — same pre-existing unrelated biome errors as Plan 55-01. Both task commit messages document the bypass.

## Self-Check

- [x] `taskflow/src/components/app/Sidebar.tsx` exists (modified, committed in `bc27ac5`)
- [x] `taskflow/src/components/app/sidebar-items.ts` exists (modified, committed in `bc27ac5`)
- [x] `taskflow/src/components/app/Sidebar.test.tsx` exists (modified, committed in `71da592`)
- [x] `.planning/phases/55-aio-project-selection-in-settings/55-03-SUMMARY.md` exists (this file)
- [x] Commit `bc27ac5` exists on `worktree-agent-a09d9616ff00a97d8`
- [x] Commit `71da592` exists on `worktree-agent-a09d9616ff00a97d8`
- [x] `grep -c "selectedAioProjectKey" taskflow/src/components/app/Sidebar.tsx` → 4 (≥3 required)
- [x] `grep -cE "const \{[^}]*selectedAioProjectKey[^}]*\} = useSettingsStore\(\)" taskflow/src/components/app/Sidebar.tsx` → 1
- [x] `grep -c "!aioEnabled || !selectedAioProjectKey" taskflow/src/components/app/Sidebar.tsx` → 1
- [x] `grep -c "/aio-project/" taskflow/src/components/app/Sidebar.tsx` → 1
- [x] `grep -c "path: '/aio-projects'" taskflow/src/components/app/sidebar-items.ts` → 0 (old literal removed)
- [x] `grep -c "path: '/aio'" taskflow/src/components/app/sidebar-items.ts` → 1 (new sentinel)
- [x] `grep -c "'aio-projects'" taskflow/src/components/app/sidebar-items.ts` → 3 (unchanged: 1 item id + 2 preset refs)
- [x] `grep -c "mockSelectedAioProjectKey" taskflow/src/components/app/Sidebar.test.tsx` → 3 (≥3 required)
- [x] `grep -c "selectedAioProjectKey" taskflow/src/components/app/Sidebar.test.tsx` → 7 (≥4 required)
- [x] `grep -c "/aio-project/PROJ" taskflow/src/components/app/Sidebar.test.tsx` → 1
- [x] `grep -c "getAttribute('href')" taskflow/src/components/app/Sidebar.test.tsx` → 1
- [x] `cd taskflow && ./node_modules/.bin/vitest run src/components/app/Sidebar.test.tsx` → 5 tests pass (2 prior + 3 new)
- [x] `cd taskflow && ./node_modules/.bin/tsc --noEmit` → exit 0

## Self-Check: PASSED

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **55-04 (route + page deletion):** Plan can now safely delete the `/aio-projects` route entry in `routes.tsx` and the corresponding `AioProjectsPage.tsx` / `AioProjectsSkeleton.tsx` / `AioProjectsPage.test.tsx`. The sidebar no longer references `/aio-projects` (the static path field was rewritten to the `/aio` sentinel in this plan and overridden at render time to `/aio-project/${selectedAioProjectKey}`). After Plan 04 ships, the `/aio` sentinel will never match any real route — clicks from the sidebar always go through the dynamic intercept directly to `/aio-project/:projectKey`.
- No blockers.

---
*Phase: 55-aio-project-selection-in-settings*
*Completed: 2026-05-14*
