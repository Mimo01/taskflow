---
phase: 71
slug: greenhopper-adapter-foundation
status: planner-filled
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
updated: 2026-05-28
---

# Phase 71 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | taskflow/vitest.config.ts |
| **Quick run command** | `cd taskflow && npx vitest run src/services/jira/greenhopper` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Lint command** | `cd taskflow && npx biome check src/services/jira.ts src/services/jira/greenhopper` |
| **Estimated runtime** | ~30 seconds (greenhopper subset); full suite per repo baseline |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/services/jira/greenhopper`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green AND biome 0/0
- **Max feedback latency:** ~30s (subset), full suite per repo baseline

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 71-01-T1 | 71-01 | 0 | GH-ADAPT-01/03 | T-71-01, T-71-03 | PAT never logged; HTML replaced with placeholder | static | `node -c taskflow/scripts/capture-greenhopper.mjs` + grep gates | ❌ W0 | ⬜ pending |
| 71-01-T2 | 71-01 | 0 | GH-ADAPT-01/03 | T-71-02 | Redaction map applied; only example.invalid domains in fixtures | manual | human-checkpoint redaction grep + JSON parse | ❌ W0 | ⬜ pending |
| 71-02-T1 | 71-02 | 1 | GH-ADAPT-01 | T-71-04 | source='jira' not 'greenhopper' (Pitfall 8) | unit | `cd taskflow && npx vitest run src/services/jira/greenhopper/client.test.ts` | ❌ W0 | ⬜ pending |
| 71-02-T2 | 71-02 | 1 | GH-ADAPT-01 | T-71-06 | Strong typing across 12 GH interfaces | static | `cd taskflow && npx tsc --noEmit` (no errors in types.ts) | ❌ W0 | ⬜ pending |
| 71-03-T1 | 71-03 | 2 | GH-ADAPT-01 | T-71-08, T-71-09 | 401/403 → ApiError; never throws raw Response | unit | `cd taskflow && npx vitest run src/services/jira/greenhopper/{allData,data}.test.ts` | ❌ W0 | ⬜ pending |
| 71-03-T2 | 71-03 | 2 | GH-ADAPT-01 | T-71-07 | issueKey URL-encoded; transitions returns whole envelope | unit | `cd taskflow && npx vitest run src/services/jira/greenhopper/{details,transitions}.test.ts` | ❌ W0 | ⬜ pending |
| 71-04-T1 | 71-04 | 2 | GH-ADAPT-02 | T-71-10, T-71-11 | Fallback shim + warnOnce per unique id | unit | `cd taskflow && npx vitest run src/services/jira/greenhopper/entityMaps.test.ts` | ❌ W0 | ⬜ pending |
| 71-05-T1 | 71-05 | 3 | GH-ADAPT-03 | T-71-12 | D-02 gate prevents non-storypoints leak | static | `cd taskflow && npx tsc --noEmit` (no errors in adapter.ts) | ❌ W0 | ⬜ pending |
| 71-05-T2 | 71-05 | 3 | GH-ADAPT-03 | T-71-13 | Full-iteration over real capture never throws | unit | `cd taskflow && npx vitest run src/services/jira/greenhopper/adapter.test.ts` | ❌ W0 | ⬜ pending |
| 71-06-T1 | 71-06 | 4 | GH-ADAPT-01/02/03 | T-71-15 | client.ts NOT in barrel (D-06) | static | grep gate on './client' in index.ts | ❌ W0 | ⬜ pending |
| 71-06-T2 | 71-06 | 4 | GH-ADAPT-01/02/03 | T-71-16, T-71-17, T-71-18 | Full suite green; biome 0/0; surface reachable via 'services/jira' | unit+lint | `cd taskflow && npx tsc --noEmit && npx vitest run && npx biome check src/services/jira.ts src/services/jira/greenhopper` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 = Plan 71-01. All other plans depend on its output (fixtures + capture script).

- [ ] `taskflow/scripts/capture-greenhopper.mjs` — committed (Task 71-01-T1)
- [ ] `taskflow/src/services/jira/greenhopper/__fixtures__/allData.real.json` — anonymized real capture (D-10) — Task 71-01-T2
- [ ] `taskflow/src/services/jira/greenhopper/__fixtures__/data.real.json` — Task 71-01-T2
- [ ] `taskflow/src/services/jira/greenhopper/__fixtures__/details.real.json` — Task 71-01-T2
- [ ] `taskflow/src/services/jira/greenhopper/__fixtures__/transitions.real.json` — Task 71-01-T2

Test files are created within plans 71-02..71-05 alongside their source files (vitest auto-discovers via existing `taskflow/vitest.config.ts` — no infrastructure scaffolding needed).

*Framework already installed (vitest 4.0.18 in package.json).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Capture script produces anonymized fixtures from a real Jira host | GH-ADAPT-03 (fixture authenticity) | Requires live PAT + Jira host; cannot run in CI without secrets | Plan 71-01 Task 2 — see acceptance criteria there |

*All adapter/fetcher/entityMaps behaviors have automated vitest coverage.*

---

## Sampling Continuity Check

No 3-consecutive-task stretch without an automated verify:
- 71-01-T1 (static grep) → 71-01-T2 (manual + grep) → 71-02-T1 (vitest) ✓
- 71-02-T2 (tsc) → 71-03-T1 (vitest) → 71-03-T2 (vitest) ✓
- 71-04-T1 (vitest) → 71-05-T1 (tsc) → 71-05-T2 (vitest) ✓
- 71-06-T1 (grep+tsc) → 71-06-T2 (full suite + lint + tsc) ✓

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s for greenhopper subset
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-05-28
