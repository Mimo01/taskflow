---
phase: 61
slug: tempo-probe-service-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
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
| 61-probe | 01 | 0 | TEMPO-06 | — | Bearer PAT never logged | manual | `curl -H "Authorization: Bearer $PAT" $JIRA_URL/rest/tempo-timesheets/4/worklogs?worker=$USER&from=2026-05-01&to=2026-05-01` | ✅ | ⬜ pending |
| 61-client | 02 | 1 | TEMPO-06 | T-61-01 | `apiFetch('aio', ...)` source prevents false Jira disconnect | unit | `npm test -- src/services/tempo/client.test.ts` | ❌ W0 | ⬜ pending |
| 61-types | 02 | 1 | TEMPO-06 | — | N/A | compile | `cd taskflow && npx tsc --noEmit` | ✅ | ⬜ pending |
| 61-worklogs | 02 | 1 | TEMPO-06 | T-61-02 | Pagination bounded by `items.length < limit` | unit | `npm test -- src/services/tempo/worklogs.test.ts` | ❌ W0 | ⬜ pending |
| 61-store | 03 | 1 | TEMPO-06 | — | `tempoEnabled: false` default; v20 migration guard | unit | `npm test -- src/stores/settings.store.test.ts` | ❌ W0 | ⬜ pending |
| 61-toggle | 04 | 2 | TEMPO-06 | — | Toggle renders in IntegrationsSection, persists on restart | unit | `npm test -- src/routes/settings/IntegrationsSection.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/tempo/client.test.ts` — covers URL construction and Bearer header injection (D-04)
- [ ] `src/services/tempo/worklogs.test.ts` — covers pagination exhaustion (D-07) and timezone bucketing (D-10)
- [ ] `src/stores/settings.store.test.ts` — covers v20 migration guard and `tempoEnabled: false` default (extend if file exists; create if not)

*Wave 0 runs before service implementation so tests are RED before going GREEN.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Tempo curl probe returns 200 | TEMPO-06 (success criterion 1) | Requires live Jira instance + PAT; cannot be automated in CI | `curl -H "Authorization: Bearer $PAT" "$JIRA_URL/rest/tempo-timesheets/4/worklogs?worker=$USER&from=2026-05-01&to=2026-05-01"` — expect HTTP 200 and JSON body |
| `tempoEnabled` persists across app restart | TEMPO-06 (success criterion 3) | Requires Tauri app restart; cannot be automated | Toggle on in Settings → Integrations, quit app, relaunch, verify toggle is still on |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
