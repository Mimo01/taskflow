---
phase: 100
slug: host-adoption-editing-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-17
---

# Phase 100 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4 + jsdom + @testing-library/react (+ user-event) |
| **Config file** | `taskflow/taskflow/vitest.config.ts` (setup `src/test/setup.ts`) |
| **Quick run command** | `cd taskflow/taskflow && npx vitest run src/components/wiki-editor src/stores/drafts.store.test.ts <touched test files>` |
| **Full suite command** | `cd taskflow/taskflow && npm run test && npm run check` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the touched host's test file(s), plus `src/components/wiki-editor` if the editor changed
- **After every plan wave:** Run `npm run test` and `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| HOST-01 | Create/Edit modal uses WikiEditor; description round-trips; staged files uploaded | integration | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx src/routes/dashboard/create-edit-issue` | rewrite W0 | ⬜ pending |
| HOST-03 | Composer posts, clears, keeps focus; comment edit saves | integration | `npx vitest run src/routes/dashboard/CommentComposer.test.tsx src/routes/dashboard/CommentComposer.attachments.test.tsx` | rewrite W0 | ⬜ pending |
| HOST-04 | Create Epic submits description from editor; Cmd+Enter submits | integration | `npx vitest run src/routes/dashboard/CreateEpicDialog.test.tsx` | rewrite | ⬜ pending |
| HOST-05 | Old toolbar/Preview tab and deleted files absent | guard (fs) | `npx vitest run src/routes/dashboard/editor-removal.guard.test.ts` | ❌ W0 | ⬜ pending |
| FLOW-01 | Draft debounce/flush/restore/clear; stale-base notice | unit + integration | `npx vitest run src/stores/drafts.store.test.ts src/hooks/useEditorDraft.test.tsx` | ❌ W0 | ⬜ pending |
| FLOW-02 | Dirty Cancel/Esc → Discard dialog; clean closes; Create Issue never warns | integration | `npx vitest run src/components/ui/discard-changes-dialog.test.tsx src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ W0 | ⬜ pending |
| FLOW-03 | Mod-Enter submits (not IME/popover); Esc order popover > host | unit (real editor) | `npx vitest run src/components/wiki-editor/host-keys.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/drafts.store.test.ts`, `src/hooks/useEditorDraft.test.tsx`: FLOW-01
- [ ] `src/components/ui/discard-changes-dialog.test.tsx`: FLOW-02
- [ ] `src/components/wiki-editor/host-keys.test.tsx`: FLOW-03 (ref handle, placeholder, autoFocus)
- [ ] `src/routes/dashboard/editor-removal.guard.test.ts`: HOST-05
- [ ] Shared `WikiEditorLazy` stub for host tests (`src/test/wiki-editor-stub.tsx`)
- [ ] Move `CommentComposer` cases out of `IssueDetailSheet.test.tsx` before deleting it

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IME composition + Cmd+Enter | FLOW-03 | jsdom has no real IME | Type Japanese/compose in composer, press Cmd+Enter mid-composition: must not send |
| Draft survives app restart | FLOW-01 | Needs Tauri runtime | Type a comment, quit app, relaunch, reopen issue: draft restored |
| Nested Esc over Edit modal | FLOW-02/03 | WKWebView event stacking | Open mention popover in Edit modal, Esc closes popover only; Esc again opens Discard dialog |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
