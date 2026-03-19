---
phase: 25
slug: tooling-dependencies
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | TOOL-01 | integration | `cd taskflow && npx biome check --max-diagnostics=5 src/` | ❌ W0 | ⬜ pending |
| 25-01-02 | 01 | 1 | TOOL-01 | script | `cd taskflow && npm run check` | ❌ W0 | ⬜ pending |
| 25-02-01 | 02 | 1 | TOOL-02 | integration | `cd taskflow && npx biome check src/` | ✅ | ⬜ pending |
| 25-03-01 | 03 | 2 | DEPS-01 | build+test | `cd taskflow && npm run build && npx vitest run` | ✅ | ⬜ pending |
| 25-03-02 | 03 | 2 | DEPS-01 | audit | `cd taskflow && npm audit --audit-level=high` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `biome.json` — Biome configuration file at taskflow root
- [ ] `package.json` scripts — `lint`, `format`, `check`, `format:check` scripts added

*Existing vitest infrastructure covers test requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No runtime regressions after dep updates | DEPS-01 | Requires app interaction | Build app, start dev server, verify main features load without console errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
