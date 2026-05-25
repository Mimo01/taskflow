---
phase: 65
slug: tech-debt-cleanup
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-23
validated: 2026-05-25
---

# Phase 65 — Validation Strategy

> Per-phase validation contract. Reconstructed retroactively by /gsd:validate-phase on 2026-05-25.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react (jsdom) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/worklogs/WorklogsPage.test.tsx src/components/app/Sidebar.test.tsx src/lib/aioUtils.test.ts src/services/aio/cycles.test.ts src/routes/dashboard/AioCycleDetailPage.test.tsx` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Build verify** | `cd taskflow && npm run build` (Phase 59 standing rule — not just tsc) |
| **Estimated runtime** | ~6 seconds (scoped); ~60s full suite |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above (affected files only)
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green AND `npm run build` zero errors
- **Max feedback latency:** ~6 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 65-01-01 | 01 | 1 | CLEAN-01 | — | N/A | unit | `npx vitest run src/routes/worklogs/WorklogsPage.test.tsx` | ✅ | ✅ green |
| 65-01-01 | 01 | 1 | CLEAN-02 | — | ErrorState renders on network error after cached empty result | unit | same | ✅ | ✅ green |
| 65-01-01 | 01 | 1 | CLEAN-03 | — | No React key warnings in epic/story hierarchy render | unit | same | ✅ | ✅ green |
| 65-01-02 | 01 | 1 | CLEAN-04 | — | N/A (type move) | build | `npx tsc --noEmit && npm run build` | ✅ | ✅ green |
| 65-01-03 | 01 | 1 | CLEAN-05 | — | N/A | unit | `npx vitest run src/components/app/Sidebar.test.tsx` | ✅ | ✅ green |
| 65-02-01 | 02 | 1 | CLEAN-06 | — | testRunStatusID 52 → IN_PROGRESS; 51 → NOT_EXECUTED | unit | `npx vitest run src/services/aio/cycles.test.ts` | ✅ | ✅ green |
| 65-02-02 | 02 | 1 | CLEAN-07 | — | /config failure degrades to all-notRun, no crash | unit | `npx vitest run src/lib/aioUtils.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure (vitest + jsdom + @testing-library/react) covers all phase requirements. No new framework setup needed.

**Audit gap filled (2026-05-25):** CLEAN-06 had no automated verification. Added a
`fetchAioCycleTestCasesWithRuns — TESTCASE_STATUS_MAP (CLEAN-06)` describe block to
`src/services/aio/cycles.test.ts` asserting testRunStatusID 52 → IN_PROGRESS, 51 →
NOT_EXECUTED, and undefined → NOT_EXECUTED fallback.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `DatePreset` type lives in service layer, not route component | CLEAN-04 | A pure type-location refactor has no runtime behavior to assert; correctness is enforced by `tsc`/`npm run build` resolving all imports | Run `npm run build`; confirm zero errors and `grep -rn "DatePreset.*from.*routes/worklogs" src/` returns nothing |

---

## Validation Sign-Off

- [x] All requirements have automated verify or a documented manual-only justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (CLEAN-06 gap filled)
- [x] No watch-mode flags
- [x] Feedback latency < 65s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-25

---

## Validation Audit 2026-05-25

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

CLEAN-06 (TESTCASE_STATUS_MAP 51/52 entries) was MISSING automated coverage — the
runtime fix existed but no test asserted it. Filled inline. CLEAN-04 documented as
manual/build-verified (pure type-location refactor, no runtime behavior).
