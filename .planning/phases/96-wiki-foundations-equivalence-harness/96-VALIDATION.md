---
phase: 96
slug: wiki-foundations-equivalence-harness
status: draft
nyquist_compliant: true
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
| 96-01-01 | 01 | 1 | SAFE-01 | — | verbatim move vs c921736c | unit (existing) | `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` + byte-for-byte check | ✅ | ⬜ pending |
| 96-01-02 | 01 | 1 | SAFE-01 | XSS (sanitize order) | rehype-sanitize after rehype-raw via wikiRehypePlugins | unit (existing) + full suite | `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx && npm run test` | ✅ | ⬜ pending |
| 96-03-01 | 03 | 1 | SAFE-02 | customer-data leak | only example.com hosts in block fixtures | CLI asserts | `git check-attr` + fixture greps | ❌ W0 | ⬜ pending |
| 96-03-02 | 03 | 1 | SAFE-02 | customer-data leak | only example.com hosts in whole tree | CLI asserts | fixture count ≥34 + greps | ❌ W0 | ⬜ pending |
| 96-03-03 | 03 | 1 | SAFE-02 | — | CRLF/nbsp bytes preserved | unit | `npx vitest run src/lib/wiki/corpus-coverage.test.ts` | ❌ W0 | ⬜ pending |
| 96-02-01 | 02 | 2 | SAFE-01 | supply chain | package legitimacy confirmed | manual checkpoint | — | n/a | ⬜ pending |
| 96-02-02 | 02 | 2 | SAFE-01 | — | no editor deps on main | CLI | package.json node check + `npm run test` | ✅ | ⬜ pending |
| 96-02-03 | 02 | 2 | SAFE-01 | XSS | wikiToHtml never injected into DOM | unit | `npx vitest run src/lib/wiki/pipeline.test.tsx` | ❌ W0 | ⬜ pending |
| 96-04-01 | 04 | 3 | SAFE-02 | — | N/A | unit | `npx vitest run src/lib/wiki/normalize.test.ts` | ❌ W0 | ⬜ pending |
| 96-04-02 | 04 | 3 | SAFE-02 | — | mutations reported, controls pass | unit + full suite | `npx vitest run src/lib/wiki && npm run test` | ❌ W0 | ⬜ pending |
| 96-05-01 | 05 | 3 | SAFE-01 | — | no editor deps on main | CLI | worktree/branch + package.json grep | n/a | ⬜ pending |
| 96-05-02 | 05 | 3 | SAFE-01 | — | N/A | manual checkpoint | — (Manual-Only table) | n/a | ⬜ pending |
| 96-05-03 | 05 | 3 | SAFE-01 | — | N/A | CLI | findings-doc heading greps | n/a | ⬜ pending |
| 96-06-01 | 06 | 4 | SAFE-02 | PAT leak | token never committed | manual checkpoint | — (Manual-Only table) | n/a | ⬜ pending |
| 96-06-02 | 06 | 4 | SAFE-02 | PAT leak | no Bearer token / Jira HTML in doc | CLI | findings-doc greps | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/wiki/pipeline.test.tsx`, `normalize.test.ts`, `equivalence.test.ts`, `corpus-coverage.test.ts`
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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
