---
phase: 55-aio-project-selection-in-settings
plan: 02
subsystem: settings-ui
tags: [settings-ui, picker, shadcn-select, react-query, aio, base-ui]

# Dependency graph
requires:
  - phase: 55-01
    provides: selectedAioProjectKey field + setSelectedAioProjectKey setter + v17 migration on useSettingsStore
  - phase: 51-aio-service-layer
    provides: fetchAioProjects service (used by the picker's useQuery), AioProject shape ({id, projectKey, name}), aioEnabled toggle (unchanged in this plan)
  - phase: 52-aio-navigation-project-pages
    provides: /aio-project/:projectKey route (Plan 55-03 will deep-link to it; 55-02 itself does not navigate)
provides:
  - AIO project picker inside IntegrationsSection.tsx — gated on aioEnabled === true (D-02)
  - useQuery wiring with key ['aio', jiraBaseUrl, 'projects'] (D-04) and enabled guard !!jiraBaseUrl && !!token (Pitfall 1)
  - Credential loader pattern mirrored from the (about-to-be-deleted) AioProjectsPage — readSecret('jira-pat') in useEffect with [jiraBaseUrl] dependency
  - Picker states (loading / error / empty / loaded) rendered verbatim per UI-SPEC color matrix and copywriting contract
  - Pitfall 3 fix: trigger label uses projects.find(p => p.projectKey === selectedAioProjectKey) so the project NAME (not the key) shows in the trigger
  - Component test surface: 6 new picker tests + extended setup of existing 5 toggle tests; all 11 pass
affects:
  - 55-03 (Sidebar: reads selectedAioProjectKey set by this picker to compute /aio-project/${...} deep-link; the visible side of the picker change must not break Sidebar tests)
  - 55-04 (route/file deletion: AioProjectsPage.tsx + AioProjectsPage.test.tsx + AioProjectsSkeleton.tsx + /aio-projects route; this plan absorbed the deleted page's selection surface so 55-04 can delete without functional regression)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings-section credential loader + useQuery: mounting-side useEffect → readSecret(key) → setToken; useQuery enabled-gate on !!baseUrl && !!token (Pitfall 1) — identical to the AioProjectsPage pattern, now anchored inside a settings sub-control"
    - "Selected-value display lookup (Pitfall 3): `const selectedX = data?.find(x => x.key === storedKey)`; trigger renders `selectedX ? selectedX.name : placeholder` — prevents the blank-trigger bug when the stored key arrives before the data"
    - "Sub-control gated render inside a settings subsection: `{aioEnabled && (...)}` placed as a sibling of the toggle inside `<div className=\"flex flex-col gap-4\">` keeps spacing consistent with UI-SPEC rule 1"
    - "Inline icon-text status rows with `gap-1.5` (E-01) — Loader2 + 'Loading…' (text-muted-foreground), XCircle + 'Couldn't load…' (text-destructive, role='alert'); copied verbatim from ConnectionsSection.tsx"
    - "Test pattern: mock the `@/components/ui/select` shadcn/base-ui primitive with a deterministic native `<select>+<option>` stand-in so portal-positioner failures in jsdom don't block change-handler tests — keeps the prop API (value, onValueChange) identical so the test exercises the IntegrationsSection wiring, not the picker primitive"
    - "Test re-arm of vi.clearAllMocks-cleared factory mocks: re-set `vi.mocked(readSecret).mockResolvedValue(...)` inside each beforeEach so the useEffect token resolution still gates the query"

key-files:
  created: []
  modified:
    - taskflow/src/routes/settings/IntegrationsSection.tsx
    - taskflow/src/routes/settings/IntegrationsSection.test.tsx
    - .planning/phases/55-aio-project-selection-in-settings/deferred-items.md

key-decisions:
  - "Plan-order TDD over strict RED-first (matches Plan 55-01's recorded decision) — Task 1 implementation then Task 2 tests; both committed with tdd=\"true\" on the plan tasks"
  - "Replace @/components/ui/select with an in-test vi.mock stand-in: base-ui Select's portal positioner does not lay out in jsdom (trigger click opens listbox but options never mount), making the change-handler test untestable through the UI surface. Test boundary chosen at the picker primitive — IntegrationsSection wiring is what this plan owns, not the primitive's portal behavior"
  - "Existing toggle tests' beforeEach extended (not rewritten) — fetchAioProjects default reset + readSecret re-arm + clearAllMocks. The component now always calls useQuery (unconditional hook); without a QueryClient wrapper, the existing tests crashed (Rule 3 blocking-fix scenario)"

patterns-established:
  - "When a Settings sub-control conditionally renders data-fetching UI inside an always-mounted parent, hooks (useEffect, useQuery, useState) MUST live in the parent's top-level scope; gating is via render output only — `{flag && (...)}`. This keeps React's Rules of Hooks intact (verified by no warnings in tests)."
  - "Tests for components using `@/components/ui/select` (base-ui underneath) should mock the primitive when asserting onValueChange wiring; portal-positioner DOM is not reliable in jsdom"

requirements-completed: []  # Plan frontmatter declares no requirements; AION-02 traceability is re-pointed to Phase 55 by Plan 55-04, not here.

# Metrics
duration: ~22min
completed: 2026-05-14
---

# Phase 55 Plan 02: AIO Project Picker in Settings Summary

**Adds the shadcn `<Select>` AIO project picker inside `IntegrationsSection.tsx` (gated on `aioEnabled === true`, D-02), wired to `selectedAioProjectKey` from Plan 55-01 and fetching via `fetchAioProjects` with key `['aio', jiraBaseUrl, 'projects']` — replaces the deleted `/aio-projects` list page as the single selection surface, with all four UI-SPEC states (loading / error / empty / loaded) rendered verbatim and silent-persist behavior (D-14).**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-05-14T15:27:00Z (approx — worktree spawn)
- **Completed:** 2026-05-14T15:49:19Z
- **Tasks:** 2
- **Files modified:** 3 (2 source + 1 deferred-items log)

## Accomplishments
- Picker block added under the existing `aioEnabled` toggle inside the same `AIO Test Management` subsection — visible only when `aioEnabled === true`, hidden cleanly otherwise.
- Credential loader (`readSecret('jira-pat')` in `useEffect`, dependency `[jiraBaseUrl]`) + `useQuery` with cache key `['aio', jiraBaseUrl, 'projects']` and `enabled: !!jiraBaseUrl && !!token` guard (Pitfall 1).
- Pitfall 3 lookup: `selectedProject = projects?.find(p => p.projectKey === selectedAioProjectKey)` so the trigger displays the project NAME (not the stored projectKey) once data lands.
- All 4 UI-SPEC states rendered verbatim:
  - Loading — `<Loader2 className="h-4 w-4 animate-spin" />` + `Loading projects…` (text-muted-foreground)
  - Error — `<XCircle />` + `Couldn't load AIO projects.` + inline `Retry` button bound to `refetch()` (text-destructive, `role="alert"`)
  - Empty — `<Select disabled value="">` with placeholder `No AIO projects available`
  - Loaded — full enabled Select with `<SelectItem value=projectKey>{name}</SelectItem>` per project; placeholder `Choose a project...` when nothing selected
- Selection is silent-persist (D-14): `onValueChange` calls `setSelectedAioProjectKey(projectKey)` — no toast, no banner, no navigate, no useEffect-on-value-change. No `useNavigate` / `useNavigation` imports in the file.
- 6 new picker tests added (gate-hidden, data-loaded with name lookup, change-handler wiring, loading, error + Retry, disabled-empty); existing 5 toggle tests extended to cooperate with the new always-mounted hooks. 11/11 tests pass.
- Full test suite green: 1046 passed / 2 skipped / 39 todo across 108 files (no unrelated regressions).
- TypeScript: `tsc --noEmit` exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AIO project picker block to IntegrationsSection.tsx** — `17f8429` (feat)
2. **Task 2: Extend IntegrationsSection.test.tsx with picker tests** — `e22a3ef` (test)

**Plan metadata:** committed alongside this SUMMARY.md (docs) by the orchestrator's wave-merge step.

_Note: This plan declares `tdd="true"` on both tasks; per Plan 55-01's recorded decision (line-for-line analog), the plan was executed in plan-order (implementation first, tests second). Both commits are single-step commits — no separate RED→GREEN→REFACTOR commits for the implementation task, because the per-task `<verify>` step relies on Task 2's tests existing._

## Files Created/Modified

- **`taskflow/src/routes/settings/IntegrationsSection.tsx`** — 8 new imports (useQuery, Loader2, XCircle, useEffect, useState, Label, Select primitives, fetchAioProjects, readSecret, useAuthStore), extended `useSettingsStore` destructure with `selectedAioProjectKey` + `setSelectedAioProjectKey`, added credential loader + useQuery, `selectedProject` lookup (line 35), and the gated picker block (lines 59–113). Existing toggle row unchanged (lines 44–58). Final size: 118 lines.
- **`taskflow/src/routes/settings/IntegrationsSection.test.tsx`** — extended `mockStore` literal with `selectedAioProjectKey` + `setSelectedAioProjectKey`, added factory mocks for `@/services/stronghold`, `@/services/aio`, `@/stores/auth.store`, added in-test `vi.mock` for `@/components/ui/select` (deterministic native `<select>` stand-in to work around base-ui portal-positioner unreliability in jsdom), added `makeClient()` + `renderWithClient()` helpers, extended both `beforeEach` blocks to re-arm `vi.mocked(readSecret)` after `vi.clearAllMocks()`, added 6-test `describe('IntegrationsSection — AIO project picker', ...)` block. Final size: 251 lines.
- **`.planning/phases/55-aio-project-selection-in-settings/deferred-items.md`** — appended a second entry documenting that Task 1 and Task 2 commits used `--no-verify` due to pre-existing biome errors in unrelated files (per the standing user feedback memory `feedback_no_verify_lint.md`).

## Line-Number Traceability (for 55-04 cross-reference)

For future-phase reference into `taskflow/src/routes/settings/IntegrationsSection.tsx`:

| Anchor | Line(s) | Content |
| --- | --- | --- |
| Import block (new) | 1–9 | Adds: `useQuery`, `Loader2`, `XCircle`, `useEffect`/`useState`, `Label`, `Select`+`SelectContent`+`SelectItem`+`SelectTrigger`, `fetchAioProjects`, `readSecret`, `useAuthStore`; preserves: `useSettingsStore` from `../../stores/settings.store` |
| Store destructure | 12–13 | `{ aioEnabled, setAioEnabled, selectedAioProjectKey, setSelectedAioProjectKey } = useSettingsStore();` |
| Credential loader | 15–22 | `useAuthStore()` + `useState<string|null>` + `useEffect` w/ dep `[jiraBaseUrl]` |
| useQuery | 24–33 | Key `['aio', jiraBaseUrl, 'projects']`, enabled guard `!!jiraBaseUrl && !!token` |
| Pitfall 3 lookup | 35 | `selectedProject = projects?.find((p) => p.projectKey === selectedAioProjectKey)` |
| Picker block gate | 59–113 | `{aioEnabled && (...)}` — `<Label>`, branch on `isLoading` → `isError` → `projects.length===0` → loaded `<Select>`, helper text |
| Helper text | 110–112 | `Pick the AIO Test Management project this app shows.` |

## Decisions Made

- **Plan-order TDD** — Plan declares `tdd="true"` on both tasks; following Plan 55-01's recorded decision (line-for-line analog), executed in plan order (implementation first, then tests). The verify step on Task 1 depends on Task 2's tests existing, so strict RED-first would have meant writing tests that fail because of import errors (no Select wiring yet) rather than meaningful behavioral failures. Plan order delivered semantically equivalent coverage with cleaner commit history.
- **Mock the Select primitive in tests** — Plan-level Constraint says "use `userEvent.setup()` API for clicks (matches modern React Testing Library convention)"; however, base-ui Select's portal positioner does not lay out reliably in jsdom (trigger click opens listbox but `<SelectItem>`s never mount as `role="option"` in the test DOM — verified by experimentation). Chose the test boundary at the picker primitive: replace `@/components/ui/select` with a deterministic native `<select>+<option>` stand-in via `vi.mock`. The mock keeps the public prop API (`value`, `onValueChange`, `disabled`) identical, so the test exercises IntegrationsSection's wiring rather than the primitive's portal behavior. Plan acknowledges this fallback in `<action>` step 7: "If the repo's existing pattern uses `fireEvent`, fall back to that — read the existing test file to confirm."
- **Existing toggle tests extended** — The new picker block uses hooks unconditionally (Rules of Hooks), so the existing 5 toggle tests crashed without a `QueryClient` wrapper after Task 1. Extended both `beforeEach` blocks to default-mock `fetchAioProjects` and re-arm `readSecret` (cleared by `vi.clearAllMocks()`). This is a Rule 3 (blocking) auto-fix — the existing tests would not run otherwise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing toggle tests crashed after Task 1 component changes**
- **Found during:** Task 1 verification (`npm test -- --run src/routes/settings/IntegrationsSection.test.tsx`)
- **Issue:** The Plan's `<action>` step 8 says "the existing tests remain valid because `mockStore.aioEnabled = false` is reset in the new picker block's `beforeEach`." But the new component calls `useQuery` UNCONDITIONALLY (Rules of Hooks — hooks must run on every render). Without a `<QueryClientProvider>` wrapper, every existing toggle test crashed with `No QueryClient set`.
- **Fix:** Wrapped the existing tests' renders with `renderWithClient(...)` (which provides a `QueryClient` with `retry: false`), default-mocked `fetchAioProjects` to `[]` in the toggle suite's `beforeEach`, and re-armed `vi.mocked(readSecret).mockResolvedValue('test-jira-token')` after `vi.clearAllMocks()` so the credential-loader `useEffect` still works.
- **Files modified:** `taskflow/src/routes/settings/IntegrationsSection.test.tsx` (existing `describe('IntegrationsSection', ...)` block beforeEach extended; the 5 existing `it(...)` tests re-routed through `renderWithClient`).
- **Verification:** 11/11 tests pass (5 original toggle + 6 new picker).
- **Committed in:** `e22a3ef` (Task 2 commit — extending the test file)

**2. [Rule 3 - Blocking] base-ui Select portal does not render options in jsdom**
- **Found during:** Task 2 implementation (writing the change-handler test)
- **Issue:** `userEvent.click(trigger)` opens the listbox (aria-expanded toggled, hidden `<input>` mounts) but `<SelectItem>` children are never rendered into the DOM as `role="option"` elements. base-ui Select uses floating-ui's positioner which depends on layout APIs (`getBoundingClientRect`, scroll metrics) that return zeros in jsdom. Tried: `findByRole('option')` (times out), `fireEvent.change` on the hidden form input (base-ui ignores it), `userEvent.click` followed by `findByText` (text never appears). Three attempts hit the 5-second waitFor timeout.
- **Fix:** Added a `vi.mock('@/components/ui/select', ...)` factory that returns a deterministic stand-in: `Select` wraps a React context; `SelectTrigger` renders `<button disabled={ctx.disabled} {...rest}>{children}</button>`; `SelectContent` renders `<select data-testid="aio-project-select" value={ctx.value} onChange={(e) => ctx.onValueChange(e.target.value)}>{children}</select>`; `SelectItem` renders `<option value={value}>{children}</option>`. Same prop API, deterministic in jsdom.
- **Files modified:** `taskflow/src/routes/settings/IntegrationsSection.test.tsx` (lines 37–98 — vi.mock factory)
- **Verification:** All 6 picker tests pass; the change-handler test deterministically asserts `setSelectedAioProjectKey` was called with `'PROJ2'` after a `fireEvent.change` on the mocked native select.
- **Committed in:** `e22a3ef` (Task 2 commit)

**3. [Out-of-scope] Pre-existing biome errors in unrelated files**
- **Found during:** Task 1 and Task 2 commits (husky pre-commit `npm run check`)
- **Issue:** Project-wide biome run reports 2 errors + 673 warnings across the codebase (not in files modified by 55-02). Files modified by 55-02 themselves pass biome cleanly (warnings only, no errors).
- **Action:** Both commits made with `--no-verify` per the standing user feedback memory (`feedback_no_verify_lint.md`). Logged to `.planning/phases/55-aio-project-selection-in-settings/deferred-items.md` (second entry).
- **Suggested follow-up:** `cd taskflow && npm run fix` in a cleanup quick task.

---

**Total deviations:** 2 Rule 3 (blocking) auto-fixes inside plan scope, 1 out-of-scope item deferred.
**Impact on plan:** Plan delivered exactly as specified at the behavioral level. The two blocking fixes were necessary to make the planned tests run; both are well-scoped to the test file and don't change any production behavior.

## Issues Encountered

- **No `node_modules` in worktree on spawn.** Ran `cd taskflow && npm install` (gitignored — not staged).
- **jsdom can't run base-ui Select's portal positioner.** Resolved via in-test `vi.mock` of the primitive — see Deviation #2.
- **Husky pre-commit hook bypassed twice** (once per task) — pre-existing unrelated biome errors. Both task commits include the bypass note in the commit message body.

## Self-Check

- [x] `taskflow/src/routes/settings/IntegrationsSection.tsx` exists (verified; modified)
- [x] `taskflow/src/routes/settings/IntegrationsSection.test.tsx` exists (verified; modified)
- [x] `.planning/phases/55-aio-project-selection-in-settings/deferred-items.md` exists (verified; appended)
- [x] Commit `17f8429` exists on `worktree-agent-abeab45f5aec94f77` (verified via `git log --oneline -3`)
- [x] Commit `e22a3ef` exists on `worktree-agent-abeab45f5aec94f77` (verified via `git log --oneline -3`)
- [x] `grep -c "fetchAioProjects" taskflow/src/routes/settings/IntegrationsSection.tsx` ≥ 2 → 2
- [x] `grep -c "readSecret('jira-pat')" taskflow/src/routes/settings/IntegrationsSection.tsx` → 1
- [x] `grep -c "'aio', jiraBaseUrl, 'projects'" taskflow/src/routes/settings/IntegrationsSection.tsx` → 1
- [x] `grep -c "enabled: !!jiraBaseUrl && !!token" taskflow/src/routes/settings/IntegrationsSection.tsx` → 1
- [x] `grep -c "setSelectedAioProjectKey" taskflow/src/routes/settings/IntegrationsSection.tsx` ≥ 2 → 2
- [x] `grep -c "selectedProject" taskflow/src/routes/settings/IntegrationsSection.tsx` ≥ 1 → 3
- [x] `grep -c 'AIO Project' taskflow/src/routes/settings/IntegrationsSection.tsx` ≥ 1 → 1
- [x] `grep -F "Pick the AIO Test Management project this app shows." taskflow/src/routes/settings/IntegrationsSection.tsx | wc -l` → 1
- [x] `grep -F "Choose a project..." taskflow/src/routes/settings/IntegrationsSection.tsx | wc -l` → 1
- [x] `grep -F "Loading projects" taskflow/src/routes/settings/IntegrationsSection.tsx | wc -l` → 1
- [x] `grep -F "Couldn't load AIO projects." taskflow/src/routes/settings/IntegrationsSection.tsx | wc -l` → 1
- [x] `grep -F "No AIO projects available" taskflow/src/routes/settings/IntegrationsSection.tsx | wc -l` → 1
- [x] `grep -c 'htmlFor="aio-project"' taskflow/src/routes/settings/IntegrationsSection.tsx` → 1
- [x] `grep -c 'id="aio-project"' taskflow/src/routes/settings/IntegrationsSection.tsx` → 2 (empty-state + loaded-state branches)
- [x] `grep -c "useNavigate\|useNavigation" taskflow/src/routes/settings/IntegrationsSection.tsx` → 0 (D-14)
- [x] `grep -c "toast" taskflow/src/routes/settings/IntegrationsSection.tsx` → 0 (D-14)
- [x] `grep -c 'role="alert"' taskflow/src/routes/settings/IntegrationsSection.tsx` → 1
- [x] `grep -c "AIO project picker" taskflow/src/routes/settings/IntegrationsSection.test.tsx` → 1
- [x] `grep -c "fetchAioProjects" taskflow/src/routes/settings/IntegrationsSection.test.tsx` ≥ 2 → 10
- [x] `grep -c "setSelectedAioProjectKey: vi.fn()" taskflow/src/routes/settings/IntegrationsSection.test.tsx` → 1
- [x] `grep -c "QueryClientProvider" taskflow/src/routes/settings/IntegrationsSection.test.tsx` → 2
- [x] `cd taskflow && npm test -- --run src/routes/settings/IntegrationsSection.test.tsx` → 11 tests pass
- [x] `cd taskflow && ./node_modules/.bin/tsc --noEmit` → exit 0
- [x] Full suite `cd taskflow && npm test -- --run` → 1046 pass / 2 skipped / 39 todo (no unrelated regressions)

## Self-Check: PASSED

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **55-03 (Sidebar deep-link gating):** Picker now writes `selectedAioProjectKey` via the wired `setSelectedAioProjectKey`. Sidebar can subscribe to `selectedAioProjectKey` and compute `to={`/aio-project/${selectedAioProjectKey}`}` — RESEARCH.md Option B (`path: '/aio'` sentinel + `Sidebar.tsx` id-based intercept) is the recommended approach.
- **55-04 (route/file deletion):** The picker now subsumes the deleted list page's selection role. `AioProjectsPage.tsx`, `AioProjectsPage.test.tsx`, `AioProjectsSkeleton.tsx`, and the `/aio-projects` route entry in `routes.tsx:52` are safe to delete. The picker's import-list is the cross-reference Plan 04's planner should consult (lines 1–9 of `IntegrationsSection.tsx`) to confirm no surviving consumer of the deleted files.
- No blockers.

---
*Phase: 55-aio-project-selection-in-settings*
*Completed: 2026-05-14*
