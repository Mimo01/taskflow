---
phase: 42
slug: foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | ROUT-01, ROUT-02 | unit | `npx vitest run src/components/ui/route-spinner.test.tsx src/components/ChunkErrorBoundary.test.tsx` | ✅ W0 | ⬜ pending |
| 42-01-02 | 01 | 1 | ROUT-03 | unit | `npx vitest run src/components/ChunkErrorBoundary.test.tsx` | ✅ W0 | ⬜ pending |
| 42-02-01 | 02 | 1 | ROUT-04 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 42-02-02 | 02 | 1 | ROUT-04 | grep | `grep -r "React.memo\|useMemo\|useCallback" src/ --include="*.tsx" --include="*.ts"` | ✅ | ⬜ pending |
| 42-02-03 | 02 | 1 | ROUT-04 | grep | `grep -r "React.memo\|useMemo\|useCallback" src/ --include="*.tsx" --include="*.ts"` | ✅ | ⬜ pending |
| 42-02-04 | 02 | 1 | ROUT-04 | grep | `grep -r "React.memo\|useMemo\|useCallback" src/ --include="*.tsx" --include="*.ts"` | ✅ | ⬜ pending |
| 42-03-01 | 03 | 2 | ROUT-05 | build | `ANALYZE=true npx vite build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Plan 42-01 Task 1 creates both test files as part of its implementation:
- [x] `taskflow/src/components/ui/route-spinner.test.tsx` — RouteSpinner render tests (created in Plan 01 Task 1)
- [x] `taskflow/src/components/ChunkErrorBoundary.test.tsx` — ChunkErrorBoundary error state tests (created in Plan 01 Task 1)

*Test files are co-located with their components per project convention. No separate `src/__tests__/` stubs needed.*

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skeleton fallback visible during load | ROUT-02 | Visual rendering timing | Throttle network in DevTools, navigate to lazy route, confirm skeleton appears |
| Error boundary UI shows retry button | ROUT-03 | Visual + interaction | Block chunk URL in DevTools, navigate, confirm error UI with retry |
| Bundle treemap shows size reduction | ROUT-05 | Requires visual inspection | Run `ANALYZE=true npx vite build`, open treemap, verify heavy routes are separate chunks |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
