---
phase: 101
slug: issue-drafts-large-create-edit-modal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-17
---

# Phase 101 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 + @testing-library/react (jsdom) |
| **Config file** | `taskflow/vitest.config.ts` (setup `src/test/setup.ts`, in-memory `@tauri-apps/plugin-store` mock) |
| **Quick run command** | `cd taskflow && npx vitest run <touched test file>` |
| **Full suite command** | `cd taskflow && npm test && npm run check` |
| **Estimated runtime** | ~120 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file(s)>` (pre-commit hook also runs the full suite)
- **After every plan wave:** Run `npm test && npm run check`
- **Before `/gsd-verify-work`:** Full suite green plus the manual `tauri dev` restart smoke
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled in by the planner per task; the requirement-to-test map from RESEARCH.md §Validation Architecture is the source:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| UI-01 | Large two-column dialog, sticky footer, no subtasks, UI-SPEC copy | component | `npx vitest run src/routes/dashboard/create-edit-issue/` | ❌ W0 + update existing | ⬜ pending |
| UI-02 | Create another: unticked on open, keeps fields, inline "✓ Created KEY · Open", refocus Summary | component + unit | `npx vitest run src/lib/issue-draft-snapshot.test.ts` + createAnother test | ❌ W0 | ⬜ pending |
| DRAFT-01 | Every close with content saves a draft, no prompt; defaults-only saves none; epic dialog too | component + unit | issueDrafts test + `CreateEpicDialog.test.tsx` | ❌ W0 / extend | ⬜ pending |
| DRAFT-02 | Independent drafts; blank form on open | store | `npx vitest run src/stores/issue-drafts.store.test.ts` | ❌ W0 | ⬜ pending |
| DRAFT-03 | Drafts chip: hidden at 0, count, popover rows newest first | component | `npx vitest run src/components/app/DraftsChip.test.tsx` | ❌ W0 | ⬜ pending |
| DRAFT-04 | Resume restores every field (incl. labels/fix version); stale values cleared with note | component + unit | `npx vitest run src/lib/issue-draft-snapshot.test.ts` | ❌ W0 | ⬜ pending |
| DRAFT-05 | Staged files copied to app data, restored as File, uploaded on create | unit (mocked fs) | `npx vitest run src/lib/issue-draft-files.test.ts` | ❌ W0 | ⬜ pending |
| DRAFT-06 | Drafts rehydrate after restart | store | `npx vitest run src/stores/issue-drafts.store.test.ts` | ❌ W0 | ⬜ pending |
| DRAFT-07 | Discard / create success removes draft + copies; Undo; owner change clears | store + component | DraftsChip + store tests | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/issue-drafts.store.test.ts`
- [ ] `src/lib/issue-draft-snapshot.test.ts` (content gate, kept fields, validate)
- [ ] `src/lib/issue-draft-files.test.ts` (mock `@tauri-apps/plugin-fs`)
- [ ] `src/components/app/DraftsChip.test.tsx`
- [ ] Modal layout / createAnother / issueDrafts component tests
- [ ] Update existing modal test files for the renamed UI-SPEC copy
- [ ] Framework install: none (vitest present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native fs scope + restart persistence + byte round-trip | DRAFT-05, DRAFT-06 | jsdom cannot run the Tauri fs plugin or an app restart | `tauri dev`: stage a file, quit, relaunch, resume from the chip, create; confirm upload and that `$APPDATA/issue-drafts/<id>` is gone |
| Edit mode labels / fix version round-trip | DRAFT-04 (Edit) | Needs live Jira editmeta | Edit an issue with labels + fix version, change one, save, confirm the other values remain |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
