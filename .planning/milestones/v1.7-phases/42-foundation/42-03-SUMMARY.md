---
phase: 42-foundation
plan: 03
subsystem: ui
tags: [vite, rollup-plugin-visualizer, bundle-analysis, code-splitting, performance, lazy-loading]

# Dependency graph
requires:
  - phase: 42-foundation-01
    provides: "withLazy() helper and ChunkErrorBoundary wrapping pattern for lazy routes"
provides:
  - rollup-plugin-visualizer wired behind ANALYZE=true env flag in vite.config.ts
  - 3 additional detail pages lazified: ReleaseDetailPage, MergeRequestDetailPage, MergeRequestListPage
  - Bundle analysis tooling for ongoing analysis
affects: [43-performance, future-phases-touching-routes]

# Tech tracking
tech-stack:
  added:
    - "rollup-plugin-visualizer@^5.x (dev dependency)"
  patterns:
    - "ANALYZE=true npx vite build generates stats.html for interactive bundle treemap"
    - "All route-level pages should be lazy-loaded via withLazy() unless they are embedded tabs"

key-files:
  created: []
  modified:
    - taskflow/vite.config.ts
    - taskflow/package.json
    - taskflow/src/routes/routes.tsx

key-decisions:
  - "Lazified ReleaseDetailPage, MergeRequestDetailPage, MergeRequestListPage — all were static imports adding 83+ kB to initial bundle"
  - "marked (77.9 kB) pulled in by jira2md as transitive dep — only to_markdown() used but marked always imported; elimination requires replacing jira2md (deferred architectural decision)"
  - "Dashboard tab components (ReleasesTab, MyTasksTab, MrAttentionTab) left as static imports — they render inside Dashboard component, not as standalone routes"

patterns-established:
  - "All standalone route-level pages should use withLazy() — embedded dashboard tabs are exceptions"

requirements-completed:
  - ROUT-05

# Metrics
duration: 25min
completed: 2026-03-29
---

# Phase 42 Plan 03: Bundle Analysis and Dead Code Elimination Summary

**rollup-plugin-visualizer wired behind ANALYZE=true; 3 oversized static route imports (83 kB) lazified, reducing initial bundle from 1,215 kB to 1,175 kB**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-29T20:10:57Z
- **Completed:** 2026-03-29T20:35:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Installed `rollup-plugin-visualizer` and wired it in `vite.config.ts` behind `process.env.ANALYZE === 'true'` guard (with `open`, `gzipSize`, `brotliSize` options)
- Ran `ANALYZE=true npx vite build` to generate `stats.html` interactive treemap — analyzed module composition of all 14 chunks
- Identified 3 pages that were static imports but should have been lazy-loaded: `ReleaseDetailPage` (42.7 kB), `MergeRequestDetailPage` (25.9 kB), `MergeRequestListPage` (14.8 kB)
- Lazified all 3 pages using the established `withLazy()` pattern from Plan 01, removing them from the main bundle
- Main bundle reduced by ~39.6 kB (1,215 kB → 1,175 kB gzip: 372 kB → 364 kB)
- 786 tests pass, TypeScript clean, build succeeds; `stats.html` not generated in non-ANALYZE mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Install visualizer, add to vite config, run analysis, and eliminate dead code** - `e913f1d` (feat)

## Files Created/Modified

- `taskflow/vite.config.ts` — Added `import { visualizer } from "rollup-plugin-visualizer"` and conditional plugin inclusion behind `process.env.ANALYZE === 'true'` guard
- `taskflow/package.json` — Added `"rollup-plugin-visualizer"` to devDependencies
- `taskflow/package-lock.json` — Lock file updated with 7 new packages
- `taskflow/src/routes/routes.tsx` — Converted 3 static imports to `lazy()` + `withLazy()`: `ReleaseDetailPage`, `MergeRequestDetailPage`, `MergeRequestListPage`

## Bundle Analysis Findings

| Module | Size in Main Bundle | Action |
|--------|---------------------|--------|
| `react-dom` | 452 kB | Expected — core runtime, not actionable |
| `@dnd-kit/core` | 84 kB | Expected — needed by sprint board (lazy) but pulled into main due to shared imports |
| `marked` (via jira2md) | 78 kB | Deferred — jira2md always imports marked even though only `to_markdown()` is used; fix requires replacing jira2md |
| `hast-util-raw/parse5` | 156 kB | Expected — part of rehype-raw for WikiRenderer HTML support |
| `ReleaseDetailPage` | 43 kB | **Lazified** — removed from initial bundle |
| `MergeRequestDetailPage` | 26 kB | **Lazified** — removed from initial bundle |
| `MergeRequestListPage` | 15 kB | **Lazified** — removed from initial bundle |
| `react-grid-layout` | 49 kB | Expected — widget dashboard grid |

## Decisions Made

- Lazified `ReleaseDetailPage`, `MergeRequestDetailPage`, `MergeRequestListPage` — all were standalone route pages unnecessarily in the initial bundle; the `withLazy()` pattern from Plan 01 made this a one-line change per page
- Dashboard tab components (`ReleasesTab`, `MyTasksTab`, `MrAttentionTab`) left as static imports — they are embedded within `Dashboard` component, not routed independently, so lazifying would require restructuring Dashboard itself
- `marked` (77.9 kB) is brought in by `jira2md` as a transitive dependency. `jira2md` always calls `require('marked')` at module load time even though `WikiRenderer.tsx` only uses `j2m.to_markdown()`. Eliminating this requires replacing `jira2md` with a custom implementation or lighter alternative — deferred to future work

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Lazified 3 additional static route pages found in analysis**
- **Found during:** Task 1 — bundle analysis step
- **Issue:** `ReleaseDetailPage` (42.7 kB), `MergeRequestDetailPage` (25.9 kB), and `MergeRequestListPage` (14.8 kB) were identified as large modules in the main bundle that were static imports. Plan 01 established the `withLazy()` pattern for lazy routes but missed these three pages.
- **Fix:** Converted all three from static imports to `lazy()` + `withLazy()` wrapping in `routes.tsx`
- **Files modified:** `taskflow/src/routes/routes.tsx`
- **Verification:** Build succeeds; all 3 appear as separate chunks in output; tests pass
- **Committed in:** `e913f1d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical performance optimization)
**Impact on plan:** Directly aligned with plan objective of eliminating oversized chunks. The fix is a natural extension of Plan 01's work.

## Issues Encountered

None — analysis was clean, actionable fixes were straightforward.

## Known Stubs

None.

## User Setup Required

None — no external service configuration required. `ANALYZE=true npx vite build` is available for future bundle analysis.

## Deferred Items

- **`marked` (77.9 kB) via `jira2md`**: `jira2md` imports `marked` at module level for `md_to_html()` and `jira_to_html()`, but only `to_markdown()` is used in the codebase. Eliminating this would require replacing `jira2md` with a custom Jira-wiki-to-Markdown converter or a lighter library. This is an architectural decision deferred to a future phase. See: `taskflow/src/routes/dashboard/WikiRenderer.tsx`.

## Next Phase Readiness

- Bundle analysis tooling is ready for future use (`ANALYZE=true npx vite build` → `stats.html`)
- Main bundle: 1,175 kB (gzip: 364 kB) — 9 lazy-loaded route chunks total
- Phase 43 performance work can use `ANALYZE=true` for before/after comparison
- No blockers

---
*Phase: 42-foundation*
*Completed: 2026-03-29*

## Self-Check: PASSED

- FOUND: taskflow/vite.config.ts (contains `visualizer` and `process.env.ANALYZE === 'true'`)
- FOUND: taskflow/package.json (contains `rollup-plugin-visualizer`)
- FOUND: taskflow/src/routes/routes.tsx (contains `ReleaseDetailPage`, `MergeRequestDetailPage`, `MergeRequestListPage` as lazy)
- FOUND: .planning/phases/42-foundation/42-03-SUMMARY.md
- FOUND: commit e913f1d
