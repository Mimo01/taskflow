---
phase: 42
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 42-01-01 | 01 | 1 | ROUT-01 | integration | `npx vitest run src/__tests__/lazy-routes.test.tsx` | ❌ W0 | ⬜ pending |
| 42-01-02 | 01 | 1 | ROUT-02 | integration | `npx vitest run src/__tests__/lazy-routes.test.tsx` | ❌ W0 | ⬜ pending |
| 42-01-03 | 01 | 1 | ROUT-03 | integration | `npx vitest run src/__tests__/error-boundary.test.tsx` | ❌ W0 | ⬜ pending |
| 42-02-01 | 02 | 1 | ROUT-04 | build | `npx vite build 2>&1 \| grep -i compiler` | ❌ W0 | ⬜ pending |
| 42-02-02 | 02 | 1 | ROUT-04 | grep | `grep -r "React.memo\|useMemo\|useCallback" src/ --include="*.tsx" --include="*.ts"` | ✅ | ⬜ pending |
| 42-03-01 | 03 | 2 | ROUT-05 | build | `ANALYZE=true npx vite build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/lazy-routes.test.tsx` — stubs for ROUT-01, ROUT-02 (lazy loading verified)
- [ ] `src/__tests__/error-boundary.test.tsx` — stubs for ROUT-03 (error boundary renders)
- [ ] Test helpers for simulating chunk load failures

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
