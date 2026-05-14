---
phase: 55
slug: aio-project-selection-in-settings
status: ready-for-execution
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
updated: 2026-05-14
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (jsdom) + @testing-library/react |
| **Config file** | `taskflow/vite.config.ts` (vitest block) |
| **Quick run command** | `cd taskflow && npm test -- --run <file>` |
| **Full suite command** | `cd taskflow && npm test -- --run` |
| **Estimated runtime** | ~30s full suite (existing) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <changed-test-file>` (~2s)
- **After every plan wave:** Run `npm test -- --run` (~30s)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement / Decision | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|------------------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T-55-01-01 | 55-01 | 1 | D-06, D-07, D-08 | T-55-01 / T-55-02 / T-55-03 | Field defaults null; setter writes; toggle does not clear | unit | `cd taskflow && npm test -- --run src/stores/settings.store.test.ts` | ✅ existing | ⬜ pending |
| T-55-01-02 | 55-01 | 1 | D-06, D-08 (test coverage) | T-55-01 | Field default + setter + D-08 independence + migration smoke | unit | `cd taskflow && npm test -- --run src/stores/settings.store.test.ts` | ✅ existing | ⬜ pending |
| T-55-02-01 | 55-02 | 2 | D-01, D-02, D-03, D-04, D-05, D-14 | T-55-04 / T-55-05 / T-55-06 / T-55-07 | Picker gated on aioEnabled; useQuery enabled-guard on credentials; silent persist | component | `cd taskflow && npm test -- --run src/routes/settings/IntegrationsSection.test.tsx` | ✅ existing | ⬜ pending |
| T-55-02-02 | 55-02 | 2 | D-02, D-03, D-05 (test coverage) | T-55-06 | 6 picker behaviors: hidden / render / change / loading / error / empty | component | `cd taskflow && npm test -- --run src/routes/settings/IntegrationsSection.test.tsx` | ✅ existing | ⬜ pending |
| T-55-03-01 | 55-03 | 2 | D-09, D-10 | T-55-08 / T-55-09 / T-55-10 | Sidebar filter extended; dynamic href; sentinel path | component | `cd taskflow && npm test -- --run src/components/app/Sidebar.test.tsx` | ✅ existing | ⬜ pending |
| T-55-03-02 | 55-03 | 2 | D-09 (test coverage) | T-55-08 | 3 new tests: null-hides / set-shows / dynamic href | component | `cd taskflow && npm test -- --run src/components/app/Sidebar.test.tsx` | ✅ existing | ⬜ pending |
| T-55-04-01 | 55-04 | 3 | D-11 | T-55-14 | Three files deleted; no production import remains | smoke | `test ! -f taskflow/src/routes/dashboard/AioProjectsPage.tsx` + `grep -rn AioProjectsPage taskflow/src/` = 0 | n/a (CLI) | ⬜ pending |
| T-55-04-02 | 55-04 | 3 | D-12 | T-55-11 / T-55-12 | /aio-projects route + AioProjectsPage lazy import removed; downstream AIO routes intact | smoke + suite | `cd taskflow && npx tsc --noEmit && npm test -- --run` | n/a (CLI) | ⬜ pending |
| T-55-04-03 | 55-04 | 3 | D-13 | T-55-13 | AION-02 row points to Phase 55; footer timestamp refreshed | doc | `grep -c "\| AION-02 \| Phase 55 \| Pending \|" .planning/REQUIREMENTS.md` = 1 | n/a (CLI) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> No dedicated Wave 0 plan exists for Phase 55. All test files (`settings.store.test.ts`, `IntegrationsSection.test.tsx`, `Sidebar.test.tsx`) already exist from prior phases — Phase 55 plans EXTEND them in-place rather than creating new files.

Per-plan test-file extension responsibility (each plan extends the mock objects + adds the new test cases inside the same plan that ships the production code change — preventing the "missing field in mock" pitfall, RESEARCH.md Pitfall 4):

- [x] Plan 01 extends `settings.store.test.ts` — Phase 51 `aioEnabled toggle` describe block as analog
- [x] Plan 02 extends `IntegrationsSection.test.tsx` — adds `selectedAioProjectKey` + `setSelectedAioProjectKey` to `mockStore`; adds `vi.mock` for `@/services/stronghold`, `@/services/aio`, `@/stores/auth.store`; adds `QueryClientProvider` wrapper
- [x] Plan 03 extends `Sidebar.test.tsx` — adds `mockSelectedAioProjectKey` variable, extends mock state, extends `renderSidebar` helper, updates 1 existing test (`aioEnabled=true`) to pass `'PROJ'`

This co-located approach avoids the Wave 0 "test scaffolding plan" pattern; each plan is responsible for the test infrastructure it depends on, in the same commit.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual rendering of picker inside Settings → Integrations | D-01, UI-SPEC | jsdom cannot verify shadcn Select dropdown positioning, focus ring, or font rendering | Open Settings → Integrations, toggle AIO on, open the picker, pick a project, verify trigger label updates to the project name, verify sidebar entry appears and deep-links to the project overview |
| Persist hydration across app restart | D-07 (migration) | Stronghold + Tauri runtime not available in vitest | Pick a project, close app, reopen, verify sidebar entry still deep-links to the same project (validates v16 → v17 migration on real Tauri Store) |
| Selecting a project does NOT redirect or toast | D-14 silent persist | jsdom is testable for negative assertions; manual is a sanity check | Pick a project; verify URL stays on `/settings`, no toast appears, no banner appears |
| Old `/aio-projects` deep-link behavior | D-12 + UI-SPEC destructive table | Tauri/Vite dev server route fallback differs from production builds | Paste `taskflow://aio-projects` (or whatever the dev URL is) in the address bar; verify the existing router fallback handles it gracefully (no white screen, no JS error in console) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — all test files exist; mock extensions are inline per-plan)
- [x] No watch-mode flags (`--run` enforced in every command)
- [x] Feedback latency < 30s (each per-file command is ~2s; full suite ~30s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready — populated 2026-05-14 by planner
