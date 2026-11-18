---
phase: 102
slug: polished-surfaces
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-11-18
---

# Phase 102 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4 + React Testing Library (jsdom); `@/test/wiki-editor-stub` stubs the lazy editor |
| **Config file** | existing vitest config in `taskflow/taskflow/` (no Wave 0 install) |
| **Quick run command** | `cd taskflow/taskflow && npx vitest run <file>` |
| **Full suite command** | `cd taskflow/taskflow && npm test && npm run check` |
| **Estimated runtime** | ~120 seconds (full); <15 seconds per file |

Biome baseline is non-zero: gate on "no NEW flagged files", never an absolute count.

---

## Sampling Rate

- **After every task commit:** Run the touched surface's test file(s) (pre-commit hook runs the full suite anyway)
- **After every plan wave:** Run `npm test` + `tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green, biome no new flagged files, screenshots reviewed
- **Max feedback latency:** 15 seconds per file

---

## Per-Task Verification Map

Filled in by the planner/executor per task. Requirement → test map from RESEARCH.md:

| Req | Behavior | Test Type | Command | File Exists | Status |
|-----|----------|-----------|---------|-------------|--------|
| UI-03 | Idle composer single-line, no toolbar/action row; focus expands; blur-empty collapses; blur-with-text stays; blur to action-row button doesn't collapse | component | `npx vitest run src/routes/dashboard/CommentComposer.test.tsx` | ✅ | ✅ green |
| UI-03 | composerFocus (Reply) expands then focuses; no Cancel on composer; Esc blurs and keeps text | component | same | ✅ | ✅ green |
| UI-03 | `CommentActionRow` note left, Attach/Cancel/primary right; Attach calls `insertFiles` | unit | `npx vitest run src/routes/dashboard/comment-editor/CommentActionRow.test.tsx` | ✅ | ✅ green |
| UI-03 | Comment edit opens expanded with shared row (Cancel + Save) | component | `npx vitest run src/routes/dashboard/IssueDetailView.comment-edit.test.tsx` | ✅ | ✅ green |
| UI-03 | Attachments path still uploads | component | `npx vitest run src/routes/dashboard/CommentComposer.attachments.test.tsx` | ✅ | ✅ green |
| UI-05 | `ModalShell` title, columns, footer slots; Esc cancel passes `details` | component | `npx vitest run src/routes/dashboard/create-edit-issue/ModalShell.test.tsx` | ✅ | ✅ green |
| UI-05 | Create Epic sidebar fields from Epic createmeta; epic-name excluded from sidebar; values in payload; no Create another | component | `npx vitest run src/routes/dashboard/CreateEpicDialog.test.tsx` | ✅ | ✅ green |
| UI-05 | Epic drafts store/restore sidebar fields; old-shape draft still sanitizes | unit | `npx vitest run src/stores/issue-drafts.store.test.ts src/lib/issue-draft-snapshot.test.ts` | ✅ | ✅ green |
| UI-05 | Bulk: title/parent line, toolbar pinned, only list scrolls, Close + X disabled and Esc ignored while creating (gap filled 2026-11-18) | component | `npx vitest run src/routes/dashboard/BulkCreateSubtasksModal.dom.test.tsx src/routes/dashboard/BulkCreateSubtasksModal.test.ts` | ✅ | ✅ green |
| UI-05 | Edit Release: shared `Switch`, two-column, textareas only (no wiki editor), per-source footer errors, props unchanged | component | `npx vitest run src/routes/dashboard/release-detail/EditReleaseModal.test.tsx` | ✅ | ✅ green |
| D-01 | WikiEditor/Lazy skeleton frame classes match Input surface | unit | `npx vitest run src/components/wiki-editor` | ✅ | ✅ green |
| Regression | Issue modal unchanged by shell adoption | component | `npx vitest run src/routes/dashboard/create-edit-issue` | ✅ | ✅ green |
| Regression | editor-removal guard | guard | `npx vitest run src/routes/dashboard/editor-removal.guard.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `ModalShell.test.tsx`, `CommentActionRow.test.tsx`, `EditReleaseModal.test.tsx` (new)
- [x] Fixtures: Epic createmeta containing the epic-name field, labels, fixVersions, a required custom field
- [x] Confirm draft store/snapshot test files exist before extending
- [x] No framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Field frame surface light + dark | D-01 / UI-05 | Visual | Screenshot Input, Textarea, WikiEditor in both themes |
| Narrow window (720/900px) for two-column modals | UI-05 | Layout | Resize app with Create Epic and Edit Release open |
| Composer expand/collapse doesn't shift activity list | UI-03 | Visual/motion | Focus/blur composer on issue detail |
| Epic createmeta fields on live Jira | UI-05 | Live data (read-only) | Open Create Epic against a real project |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-18

---

## Validation Audit 2026-11-18

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

- Mapped suites run green: 88 files, 995 tests.
- Map correction: comment edit coverage lives in `IssueDetailView.comment-edit.test.tsx`, not `IssueDetailContent.test.tsx`.
- Gap filled: `BulkCreateSubtasksModal.dom.test.tsx` › "disables footer Close and the X, and ignores Escape, until the create run finishes". Mutation check: fails with the `creating` lock removed.
