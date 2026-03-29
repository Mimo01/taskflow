---
phase: 41
slug: ci-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit/integration) + manual CI workflow dispatch |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 0 | CI-01 | manual | Verify placeholder URLs replaced | ⬜ W0 | ⬜ pending |
| 41-02-01 | 02 | 1 | CI-01 | integration | `act -j release` or workflow_dispatch | ❌ W0 | ⬜ pending |
| 41-02-02 | 02 | 1 | CI-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 41-03-01 | 03 | 2 | CI-02 | integration | Manual E2E: tag push → release → updater check | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify `taskflow-releases` repo exists and is accessible
- [ ] Verify Ed25519 signing key pair exists (check `tauri.conf.json` pubkey field)
- [ ] Replace placeholder URLs in `tauri.conf.json` and `useVersionPolicyCheck.ts`
- [ ] Verify `TAURI_SIGNING_PRIVATE_KEY` and `RELEASES_REPO_TOKEN` secrets are configured

*Infrastructure is CI/CD — most validation is manual workflow verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tag push triggers workflow | CI-01 | GitHub Actions trigger requires actual git push | Push semver tag, verify workflow starts |
| Cross-platform builds complete | CI-01 | Requires macOS/Windows/Linux runners | Check all 3 matrix jobs pass |
| Release published to public repo | CI-02 | Cross-repo publish requires PAT + repo access | Verify release appears on taskflow-releases |
| Updater detects new release | CI-02 | End-to-end requires running app instance | Install app, trigger update check after release |
| Artifacts are signed | CI-01 | Signature verification requires actual signing key | Check latest.json has non-empty signature fields |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
