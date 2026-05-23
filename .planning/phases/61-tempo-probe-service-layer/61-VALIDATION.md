---
phase: 61
slug: tempo-probe-service-layer
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
audited: 2026-05-23
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npm test -- --reporter=verbose src/services/tempo/` |
| **Full suite command** | `cd taskflow && npm test` |
| **Estimated runtime** | ~30 seconds (quick), ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npm test -- src/services/tempo/ src/routes/settings/IntegrationsSection.test.tsx`
- **After every plan wave:** Run `cd taskflow && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 61-probe | 01 | 0 | TEMPO-06 | — | Bearer PAT never logged | manual | `curl -H "Authorization: Bearer $PAT" $JIRA_URL/rest/tempo-timesheets/3/worklogs?username=$USER&dateFrom=2026-05-01&dateTo=2026-05-01` | ✅ | ✅ green (manual — PROBE-RESULT.md: 200 OK) |
| 61-client | 02 | 1 | TEMPO-06 | T-61-01, T-61-03 | `apiFetch('aio', ...)` source prevents false Jira disconnect | unit | `npm test -- src/services/tempo/client.test.ts` | ✅ | ✅ green (7/7) |
| 61-types | 02 | 1 | TEMPO-06 | — | N/A | compile | `cd taskflow && npx tsc --noEmit` | ✅ | ✅ green |
| 61-worklogs | 02 | 1 | TEMPO-06 | T-61-02 | `dateStarted.slice(0, 10)` guards against timezone shift | unit | `npm test -- src/services/tempo/worklogs.test.ts` | ✅ | ✅ green (8/8) |
| 61-store | 03 | 1 | TEMPO-06 | T-61-05 | `tempoEnabled: false` default; v20 migration guard additive-only | unit | `npm test -- src/stores/settings.store.test.ts` | ✅ | ✅ green (33/33) |
| 61-toggle | 04 | 2 | TEMPO-06 | T-61-07 | Controlled-input pattern; setter is sole mutation path | unit | `npm test -- src/routes/settings/IntegrationsSection.test.tsx` | ✅ | ✅ green (18/18) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/services/tempo/client.test.ts` — covers URL construction, Bearer header injection, `'aio'` source label, operation forwarding, apiPath override (D-04, D-06)
- [x] `src/services/tempo/worklogs.test.ts` — covers single-fetch flat-array return (probe-confirmed v3 shape), date normalization via `.slice(0, 10)`, 401/404 error paths (D-07, D-10)
- [x] `src/stores/settings.store.test.ts` — extended with `tempoEnabled` default, setter, and v20 migration smoke (D-13)

*Wave 0 was implemented via TDD-RED/GREEN within Wave 1 commits — tests authored alongside impl files in plan 02 (client/worklogs) and plan 03 (store). All requirements have automated verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Tempo curl probe returns 200 | TEMPO-06 (success criterion 1) | Requires live Jira DC instance + Bearer PAT in user's Stronghold; cannot be automated in CI | `curl -H "Authorization: Bearer $PAT" "$JIRA_URL/rest/tempo-timesheets/3/worklogs?username=$USER&dateFrom=2026-05-01&dateTo=2026-05-01"` — expect HTTP 200 and JSON array body. **Status:** ✅ confirmed 2026-05-21 (see `61-PROBE-RESULT.md`) |
| `tempoEnabled` persists across app restart | TEMPO-06 (success criterion 3) | Requires Tauri app restart with persistent disk storage; cannot be automated without a Tauri harness | Toggle on in Settings → Integrations, quit app (Cmd+Q), relaunch, verify toggle is still on. **Status:** ✅ confirmed 2026-05-21 (see `61-04-SUMMARY.md` Task 3 Human Verification) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ compliant — 2026-05-23

---

## Validation Audit 2026-05-23

Retroactive audit by `/gsd:validate-phase 61`.

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tasks COVERED | 6/6 (5 automated + 1 manual-only documented) |
| Tasks PARTIAL | 0 |
| Tasks MISSING | 0 |

**Test counts (run at audit time):**

| File | Tests | Result |
|------|-------|--------|
| `src/services/tempo/client.test.ts` | 7 | ✅ all pass |
| `src/services/tempo/worklogs.test.ts` | 8 | ✅ all pass |
| `src/stores/settings.store.test.ts` | 33 | ✅ all pass (4 new Phase 61 tempo tests) |
| `src/routes/settings/IntegrationsSection.test.tsx` | 18 | ✅ all pass (4 new Phase 61 tempo tests) |
| `npx tsc --noEmit` | — | ✅ clean |
| **Total automated** | **66** | **all green** |

**Findings:**
- Original VALIDATION.md was authored 2026-05-21 *before* Wave 1 execution — all "File Exists ❌ W0" markers were correct at that moment but now resolve to ✅ since plans 02–04 created the files.
- Statuses promoted from ⬜ pending → ✅ green based on test runs at audit time.
- Manual-only items both have confirmed outcomes recorded in artifact files (PROBE-RESULT.md and 61-04-SUMMARY.md Task 3).
- Phase is Nyquist-compliant: every requirement either has an automated test or is documented as manual-only with a recorded confirmation.

No remediation required.
