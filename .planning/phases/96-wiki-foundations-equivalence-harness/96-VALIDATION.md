---
phase: 96
slug: wiki-foundations-equivalence-harness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-16
---

# Phase 96 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (jsdom default; `@vitest-environment node` docblock for lib/wiki harness files) |
| **Config file** | `taskflow/vitest.config.ts` (existing) |
| **Quick run command** | `cd taskflow && npx vitest run src/lib/wiki src/routes/dashboard/WikiRenderer.test.tsx` |
| **Full suite command** | `cd taskflow && npm run test` (pre-commit also runs `tsc --noEmit` and biome on staged files) |
| **Estimated runtime** | ~30 seconds quick, full suite longer |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite, `tsc --noEmit` and biome must be green
- **Extraction gate:** `WikiRenderer.test.tsx` green AND `git diff --stat` shows the test file untouched
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 96-TBD | extraction | 1 | SAFE-01 | XSS (sanitize order) | rehype-sanitize stays after rehype-raw in core plugin list | unit (existing) | `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` | ✅ | ⬜ pending |
| 96-TBD | extraction | 1 | SAFE-01 | — | N/A | unit | `npx vitest run src/lib/wiki/pipeline.test.ts` | ❌ W0 | ⬜ pending |
| 96-TBD | harness | 2 | SAFE-02 | — | N/A | unit | `npx vitest run src/lib/wiki/normalize.test.ts` | ❌ W0 | ⬜ pending |
| 96-TBD | harness | 2 | SAFE-02 | — | N/A | unit | `npx vitest run src/lib/wiki/equivalence.test.ts` | ❌ W0 | ⬜ pending |
| 96-TBD | corpus | 2+ | SAFE-02 | customer-data leak | fixtures placeholder-only | unit | `npx vitest run src/lib/wiki/corpus-coverage.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Task IDs are filled in once plans exist.*

---

## Wave 0 Requirements

- [ ] `src/lib/wiki/pipeline.test.ts`, `normalize.test.ts`, `equivalence.test.ts`, `corpus-coverage.test.ts`
- [ ] `src/lib/wiki/__fixtures__/` corpus plus root `.gitattributes` marking it `-text`
- [ ] `npm install rehype-stringify` and direct declarations of `unified`, `remark-parse`, `remark-rehype`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Editor-library spike: caret and IME in WKWebView | D-01/D-02 (spike) | jsdom/Chromium can't show WebKit caret/IME behaviour | Run throwaway prototype in real Tauri app; follow the smoke checklist in 96-RESEARCH.md |
| Live Jira render probe | D-11 | PAT is in the Stronghold vault, unlocked only in the app | Run the placeholder-only curl block from 96-RESEARCH.md; report findings as text only |
| Descriptions/comments look unchanged in the app | SAFE-01 | visual spot check backs up the unit tests | Open an issue with rich wiki text, compare to before |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
