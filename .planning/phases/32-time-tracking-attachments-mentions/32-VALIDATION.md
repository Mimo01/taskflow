---
phase: 32
slug: time-tracking-attachments-mentions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | TIME-01 | unit | `cd taskflow && npx vitest run src/services/jira/duration.test.ts -x` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 1 | TIME-01 | unit | `cd taskflow && npx vitest run src/services/jira/worklogs.test.ts -x` | ✅ (expand) | ⬜ pending |
| 32-01-03 | 01 | 1 | TIME-02 | unit | `cd taskflow && npx vitest run src/services/jira/worklogs.test.ts -x` | ✅ (expand) | ⬜ pending |
| 32-01-04 | 01 | 1 | TIME-03 | unit | `cd taskflow && npx vitest run src/services/jira/worklogs.test.ts -x` | ✅ (expand) | ⬜ pending |
| 32-01-05 | 01 | 1 | TIME-04 | unit | `cd taskflow && npx vitest run src/services/jira/worklogs.test.ts -x` | ✅ (expand) | ⬜ pending |
| 32-02-01 | 02 | 2 | TIME-05 | unit | `cd taskflow && npx vitest run src/routes/dashboard/issue-detail/TimeTrackingSummary.test.ts -x` | ❌ W0 | ⬜ pending |
| 32-02-02 | 02 | 2 | TIME-02 | unit | `cd taskflow && npx vitest run src/services/jira-changelog.test.ts -x` | ✅ (expand) | ⬜ pending |
| 32-03-01 | 03 | 2 | DETAIL-06 | unit | `cd taskflow && npx vitest run src/routes/dashboard/issue-detail/AttachmentsSection.test.ts -x` | ❌ W0 | ⬜ pending |
| 32-03-02 | 03 | 2 | DETAIL-08 | unit | `cd taskflow && npx vitest run src/services/jira/attachments.test.ts -x` | ❌ W0 | ⬜ pending |
| 32-04-01 | 04 | 3 | DETAIL-09 | unit | `cd taskflow && npx vitest run src/routes/dashboard/MentionPopover.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/jira/duration.test.ts` — stubs for TIME-01 parser logic
- [ ] `src/services/jira/attachments.test.ts` — stubs for DETAIL-08 upload API
- [ ] Expand `src/services/jira/worklogs.test.ts` — covers TIME-01/02/03/04 CRUD
- [ ] Expand `src/services/jira-changelog.test.ts` — covers worklog timeline merge/filter/count
- [ ] `src/routes/dashboard/issue-detail/TimeTrackingSummary.test.ts` — stubs for TIME-05
- [ ] `src/routes/dashboard/issue-detail/AttachmentsSection.test.ts` — stubs for DETAIL-06
- [ ] `src/routes/dashboard/MentionPopover.test.ts` — stubs for DETAIL-09

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop file upload | DETAIL-06 | Browser drag event simulation unreliable in vitest | Drop a file onto attachments section, verify upload starts |
| Mention popover cursor anchoring | DETAIL-09 | Textarea cursor position measurement requires real DOM | Type "@" mid-sentence, verify popover appears near cursor |
| Image lightbox prev/next navigation | DETAIL-07 | Visual layout verification | Open lightbox, click next/prev, verify image changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
