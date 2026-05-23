---
phase: 51
slug: aio-service-layer
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-12
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (with jsdom environment) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/services/aio/ src/routes/settings/IntegrationsSection.test.tsx --reporter=verbose` |
| **Full suite command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/services/aio/ src/routes/settings/IntegrationsSection.test.tsx --reporter=verbose`
- **After every plan wave:** Run `cd taskflow && npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| store-migration | 02 | 2 | AION-05 | — | N/A | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -t "aioEnabled"` | ❌ W0 | ⬜ pending |
| integrations-section | 02 | 2 | AION-05 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/settings/IntegrationsSection.test.tsx` | ❌ W0 | ⬜ pending |
| aio-client | 03 | 2 | AION-05 | V2 | Bearer PAT via Stronghold | unit | `cd taskflow && npx vitest run src/services/aio/client.test.ts` | ❌ W0 | ⬜ pending |
| aio-projects | 03 | 2 | AION-05 | V5 | Optional chaining on response data | unit | `cd taskflow && npx vitest run src/services/aio/projects.test.ts` | ❌ W0 | ⬜ pending |
| aio-issue-runs | 03 | 2 | AION-05 | V5 | Optional chaining on response data | unit | `cd taskflow && npx vitest run src/services/aio/issue-runs.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files for this phase are new — no existing test infrastructure needs updating:

- [ ] `taskflow/src/stores/settings.store.test.ts` — covers `aioEnabled` default false, `setAioEnabled(true/false)`, migration from v14→v15
- [ ] `taskflow/src/routes/settings/IntegrationsSection.test.tsx` — covers render, checkbox toggle, store update
- [ ] `taskflow/src/services/aio/client.test.ts` — covers `aioFetch` URL construction (AIO_API_PATH prepend, trailing slash handling)
- [ ] `taskflow/src/services/aio/projects.test.ts` — covers `fetchAioProjects` happy path (200), 401 (ApiError), 404 (empty list)
- [ ] `taskflow/src/services/aio/issue-runs.test.ts` — covers `fetchAioRunsForIssue` happy path (200), 401 (ApiError), 404, empty list

No new test infrastructure required — vitest, jsdom, @testing-library/react, and Tauri mocks in `taskflow/src/test/setup.ts` are all already installed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live AIO instance responds to authenticated requests | SC-3 | External curl probe against live instance; no test double possible | Run curl commands for all 3 base path variants with `Authorization: Bearer <jiraPat>` header; confirm 200 response and capture JSON body |
| aioEnabled toggle persists across app restart | SC-1 | Requires Tauri Store persistence layer; no unit-test substitute | Enable toggle in Settings → Integrations, quit and relaunch app, verify toggle remains enabled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
