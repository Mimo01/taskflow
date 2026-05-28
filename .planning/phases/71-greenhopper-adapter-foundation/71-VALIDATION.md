---
phase: 71
slug: greenhopper-adapter-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 71 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/services/jira/greenhopper` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (greenhopper subset); full suite per repo baseline |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/services/jira/greenhopper`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30s (subset), full suite per repo baseline

---

## Per-Task Verification Map

> Populated by the planner during PLAN.md generation. One row per executable task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | GH-ADAPT-01/02/03 | — | N/A | unit | `npx vitest run <path>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/jira/greenhopper/__fixtures__/allData.real.json` — anonymized real capture (D-10)
- [ ] `src/services/jira/greenhopper/__fixtures__/data.real.json` — anonymized real capture (D-10)
- [ ] `src/services/jira/greenhopper/__fixtures__/details.real.json` — anonymized real capture (D-10)
- [ ] `src/services/jira/greenhopper/__fixtures__/transitions.real.json` — anonymized real capture (D-10)
- [ ] `src/services/jira/greenhopper/adapter.test.ts` — adapter unit stubs for GH-ADAPT-01/02/03
- [ ] `src/services/jira/greenhopper/entityMaps.test.ts` — resolver miss / fallback-shim stubs (D-07/D-08)
- [ ] `src/services/jira/greenhopper/allData.test.ts` / `data.test.ts` / `details.test.ts` / `transitions.test.ts` — fetcher shape stubs

*Framework already installed (vitest 4.0.18 in package.json).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Capture script (`scripts/capture-greenhopper.*`) produces anonymized fixtures from a real Jira host | GH-ADAPT-03 (fixture authenticity) | Requires live PAT + Jira host; cannot run in CI without secrets | Run script against the user's Jira instance once; verify redaction map applied; commit outputs only |

*All adapter/fetcher behaviors have automated vitest coverage.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for greenhopper subset
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
