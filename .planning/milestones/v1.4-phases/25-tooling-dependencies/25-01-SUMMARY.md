---
phase: 25-tooling-dependencies
plan: 01
subsystem: tooling
tags: [biome, linter, formatter, code-quality, import-sorting]

requires: []
provides:
  - "Biome linter/formatter configuration (biome.json)"
  - "CI-ready npm scripts: lint, format, format:check, check, fix"
  - "Consistent code style across 162 source files"
affects: [27-type-safety, 28-a11y]

tech-stack:
  added: ["@biomejs/biome ^2.4.8"]
  patterns: ["biome check --write for auto-fix", "biome check + tsc --noEmit as CI gate"]

key-files:
  created: ["taskflow/biome.json"]
  modified: ["taskflow/package.json", "taskflow/src/**/*.ts", "taskflow/src/**/*.tsx"]

key-decisions:
  - "Changed organizeImports level from 'error' to 'on' (Biome assist actions only accept on/off)"
  - "Excluded CSS files from Biome (Tailwind v4 syntax not supported by Biome CSS parser)"
  - "Downgraded a11y rules to warn level to surface issues for Phase 28 without blocking"
  - "Downgraded noArrayIndexKey from error to warn for acceptable static-list patterns"
  - "Added noStaticElementInteractions and useAriaPropsSupportedByRole as warn overrides"

patterns-established:
  - "Biome as single lint+format tool: run `npm run check` for full validation"
  - "Code style: single quotes, 2-space indent, semicolons, trailing commas, 100 char line width"
  - "Import organization: auto-sorted by biome on fix/check --write"

requirements-completed: [TOOL-01, TOOL-02]

duration: 7min
completed: 2026-03-19
---

# Phase 25 Plan 01: Biome Linter/Formatter Setup Summary

**Biome installed and configured as unified linter/formatter with 5 npm scripts, all 162 source files auto-fixed to consistent style**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T20:20:42Z
- **Completed:** 2026-03-19T20:27:56Z
- **Tasks:** 2
- **Files modified:** 154

## Accomplishments
- Installed @biomejs/biome as devDependency with full biome.json configuration
- Added 5 npm scripts: lint, format, format:check, check (CI gate), fix
- Auto-formatted and lint-fixed all 162 source files (150 needed changes)
- Zero Biome errors across entire codebase (398 warnings: a11y, naming conventions, exhaustive deps)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Biome, create config, add npm scripts** - `47edd21` (feat)
2. **Task 2: Auto-fix entire codebase and resolve remaining Biome violations** - `c186b82` (feat)

## Files Created/Modified
- `taskflow/biome.json` - Biome linter/formatter configuration with recommended rules, a11y, naming conventions, import organization
- `taskflow/package.json` - Added @biomejs/biome devDependency and 5 npm scripts
- `taskflow/src/**` - 152 source files reformatted (single quotes, 2-space indent, semicolons, organized imports)

## Decisions Made
- Changed `organizeImports` level from `error` to `on` -- Biome 2.x assist actions only accept `on`/`off`, not severity levels
- Excluded CSS files via `files.includes` filter -- Biome's CSS parser doesn't support Tailwind v4 `@theme` and `@utility` directives
- Downgraded all a11y rules to warn -- surfaces accessibility issues for Phase 28 without blocking current development
- Downgraded `noArrayIndexKey` from error to warn -- 6 instances are acceptable patterns (static step indicators, skeleton loaders)
- Fixed pre-existing TS errors exposed by Biome (initialValues optional chaining, milestoneWindow nullability, stronghold client assertion)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed organizeImports level value**
- **Found during:** Task 2 (auto-fix run)
- **Issue:** Plan specified `"level": "error"` for organizeImports but Biome 2.x assist actions only accept `on` or `off`
- **Fix:** Changed to `"level": "on"`
- **Files modified:** taskflow/biome.json
- **Verification:** `npx biome check ./src` runs without config errors
- **Committed in:** c186b82

**2. [Rule 3 - Blocking] Excluded CSS files from Biome processing**
- **Found during:** Task 2 (auto-fix run)
- **Issue:** Biome reported 40+ parse errors on src/index.css due to Tailwind v4 `@theme`, `@utility`, and custom function syntax
- **Fix:** Added `files.includes` filter limiting Biome to TS/TSX/JS/JSX/JSON files only
- **Files modified:** taskflow/biome.json
- **Verification:** CSS parse errors eliminated, 0 Biome errors
- **Committed in:** c186b82

**3. [Rule 1 - Bug] Fixed forEach callbacks returning values**
- **Found during:** Task 2 (violation resolution)
- **Issue:** 2 forEach callbacks with arrow expressions implicitly returned values, violating useIterableCallbackReturn
- **Fix:** Wrapped arrow bodies in block statements `{ ... }`
- **Files modified:** src/components/UnifiedFilterBar.tsx, src/main.tsx
- **Verification:** `npx biome check ./src` shows 0 errors
- **Committed in:** c186b82

**4. [Rule 1 - Bug] Fixed pre-existing TypeScript errors exposed by formatting**
- **Found during:** Task 2 (tsc --noEmit verification)
- **Issue:** Biome's import reorganization and formatting shifted code, exposing 4 pre-existing TS type issues
- **Fix:** Added optional chaining for initialValues, nullish coalescing for milestoneWindow params, non-null assertion for stronghold client, empty string fallback for parent key
- **Files modified:** CreateEditIssueModal.tsx, IssueDetailSidebar.tsx, ReleasesTab.tsx, stronghold.ts
- **Verification:** `npx tsc --noEmit` reduced to only pre-existing SprintBoardTab.test.tsx type errors and jira.ts unused variable
- **Committed in:** c186b82

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- `npm run check` (biome check + tsc --noEmit) does not exit 0 due to 5 pre-existing TypeScript errors in SprintBoardTab.test.tsx (type mismatch) and jira.ts (unused variable). These exist on the prior commit and are not caused by this plan. Biome check alone exits 0.
- Pre-existing test failures (10 test files, 57 tests) are identical before and after Biome changes -- no regressions introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Biome tooling is operational; all source files pass `biome check` with zero errors
- Phase 27 (type safety) can enable `noExplicitAny` by changing the rule from `off` to `error` in biome.json
- Phase 28 (a11y) has 398 warnings already surfaced by Biome a11y rules at warn level
- Pre-existing TS errors (SprintBoardTab.test.tsx, jira.ts) should be addressed in a separate plan

---
*Phase: 25-tooling-dependencies*
*Completed: 2026-03-19*
