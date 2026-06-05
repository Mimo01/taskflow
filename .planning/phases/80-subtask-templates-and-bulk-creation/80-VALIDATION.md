---
phase: 80
slug: subtask-templates-and-bulk-creation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 80 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npm run test -- <testfile>` |
| **Full suite command** | `cd taskflow && npm run test` |
| **Estimated runtime** | ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npm run test -- <relevant-test-file>`
- **After every plan wave:** Run `cd taskflow && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| W0 | — | 0 | SUBTPL-02 | — | N/A | unit | `npm run test -- src/stores/subtask-templates.store.test.ts` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | SUBTPL-03 / SUBTPL-05 | — | N/A | unit | `npm run test -- src/routes/dashboard/resolveTemplateFields.test.ts` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | SUBTPL-08 | — | N/A | unit | `npm run test -- src/routes/dashboard/resolveRowPlaceholders.test.ts` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | SUBTPL-06 / SUBTPL-07 | — | N/A | unit | `npm run test -- src/routes/dashboard/BulkCreateSubtasksModal.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Riskiest Behaviors (Nyquist priorities)

1. **Retry-no-duplicate guarantee (SUBTPL-07):** The `status === 'created'` skip guard is the only mechanism preventing duplicate creation on retry. Test: mock `createIssue`, simulate partial failure on row 2, verify created/failed rows are never re-called on retry.
2. **Placeholder resolution correctness (SUBTPL-08):** `@inherit` on a field the parent lacks must resolve empty (D-12), not error/stale. `@current` must use `jiraUsername` (DC `name`), not `jiraUserDisplayName`. Unit-test the resolver in isolation with mock parent + auth store.
3. **Createmeta drop logic (SUBTPL-03 / D-02):** The "N fields skipped" count must count only template custom field IDs absent from the current project's createmeta; core fields never counted. Unit-test exact count against a partial createmeta.
4. **Sequential ordering (SUBTPL-06):** createIssue calls must fire in array order. Mock createIssue with a delay, verify call order.

---

## Wave 0 Requirements

- [ ] `taskflow/src/stores/subtask-templates.store.test.ts` — covers SUBTPL-02 (store add/remove/rename/move persistence)
- [ ] `taskflow/src/routes/dashboard/resolveTemplateFields.test.ts` — covers SUBTPL-03, SUBTPL-05 (field-drop computation; pure function)
- [ ] `taskflow/src/routes/dashboard/resolveRowPlaceholders.test.ts` — covers SUBTPL-08 (placeholder resolver; pure function extractable from modal)
- [ ] `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.test.ts` — covers SUBTPL-06, SUBTPL-07 (retry loop, sequential ordering)

*Vitest infrastructure already exists — Wave 0 only adds the test files/stubs above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings section create/rename/reorder/delete renders and persists across app restart | SUBTPL-01, SUBTPL-02 | Tauri LazyStore persistence + visual ordering | Create 2 templates, reorder, rename one, restart app, confirm order/names persist |
| Bulk modal preview chips show resolved-value hints; inline edit + reorder | SUBTPL-04, SUBTPL-05 | Visual chip rendering + drag interaction | Apply template on a parent with assignee/priority set; confirm `@inherit → Name` hint, edit a row, reorder |
| Per-row pending→creating→created/failed progress + partial-failure "Retry failed" UI | SUBTPL-06, SUBTPL-07 | Live sequential network states | Trigger a real bulk create; force a failure (invalid field), confirm modal stays open, retry re-runs only failed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
