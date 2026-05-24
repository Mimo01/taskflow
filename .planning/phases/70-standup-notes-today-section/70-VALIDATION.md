---
phase: 70
slug: standup-notes-today-section
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 70 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x + @testing-library/react (jsdom) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/standup-notes/ --reporter=verbose` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Build verify** | `cd taskflow && npm run build` (Phase 59 standing rule — not just tsc) |
| **Estimated runtime** | ~15 seconds (scoped); ~60s full suite |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/routes/standup-notes/ --reporter=verbose`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green AND `npm run build` zero errors
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filter helper) | — | 1 | STAND-07 | — | N/A | unit | `npx vitest run src/routes/standup-notes/filterSprintItems.test.ts` | ❌ W0 | ⬜ pending |
| (in-progress split) | — | 1 | STAND-07 | — | In Progress = `statusCategory.key === 'indeterminate'` only | unit | same | ❌ W0 | ⬜ pending |
| (up-next split) | — | 1 | STAND-07 | — | Up Next = `statusCategory.key === 'new'` only; Done excluded | unit | same | ❌ W0 | ⬜ pending |
| (leaf detection) | — | 1 | STAND-07 | — | subtask=leaf; childless task=leaf; task-with-subtasks=not leaf | unit | same | ❌ W0 | ⬜ pending |
| (assignee match) | — | 1 | STAND-07 | — | only items where `assignee.displayName === jiraUserDisplayName` | unit | same | ❌ W0 | ⬜ pending |
| (pinned discrimination) | — | 2 | STAND-08 | — | key in `pinnedCycleMeta` → AIO cycle; else Jira issue | unit | `npx vitest run src/routes/standup-notes/TodayPinnedSection.test.tsx` | ❌ W0 | ⬜ pending |
| (pinned read-only) | — | 2 | STAND-08 | — | no pin/unpin controls rendered | render | same | ❌ W0 | ⬜ pending |
| (log work present) | — | 2 | STAND-09 | — | Log Work trigger present on In Progress + Up Next rows | render | `npx vitest run src/routes/standup-notes/TodayColumn.test.tsx` | ❌ W0 | ⬜ pending |
| (log work no-nav) | — | 2 | STAND-09 | — | Log Work click does NOT trigger row `onIssueClick` (stopPropagation) | interaction | same | ❌ W0 | ⬜ pending |
| (MRs hidden no-gitlab) | — | 2 | MRs (scope) | — | MRs section absent when GitLab not connected | render | same | ❌ W0 | ⬜ pending |
| (review-state label) | — | 2 | MRs (scope) | — | "changes requested" uses amber class; "awaiting review" muted | unit | `npx vitest run src/routes/standup-notes/TodayMrsSection.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders until plans are written; the planner maps each row to a concrete `{N}-{plan}-{task}` ID and wires the `<automated>` block.*

---

## Wave 0 Requirements

- [ ] `src/routes/standup-notes/filterSprintItems.test.ts` — pure-function tests for STAND-07 (leaf detection, status-category split, assignee match). Highest-value target: extract `filterSprintItems(issues, jiraUserDisplayName) => { inProgress, upNext }` as a pure helper.
- [ ] `src/routes/standup-notes/TodayColumn.test.tsx` — render/interaction tests for STAND-09 (Log Work present + stopPropagation) and MRs-hidden-when-disconnected.
- [ ] `src/routes/standup-notes/TodayPinnedSection.test.tsx` — STAND-08 pinned discrimination + read-only assertion.
- [ ] `src/routes/standup-notes/TodayMrsSection.test.tsx` — review-state label class (optional; include if MRs section is non-trivial).

*Existing infrastructure (vitest + jsdom + @testing-library/react) is already configured; Phase 69 established the YesterdayColumn test pattern to mirror. `formatDuration` is already covered by `src/services/jira/duration.test.ts` — no new tests there.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LogWorkPopover opens pre-filled with today's date + correct issue key | STAND-09 | Popover internal state is owned by `LogWorkPopover`; date prefill not observable from TodayColumn's DOM | Open `/standup-notes`, click Log Work on an In Progress row, confirm the date field defaults to today and the issue key matches the row |
| Logged-time chip refreshes after logging work | STAND-09 | Requires live Tempo/Jira worklog round-trip + query invalidation | Log work via popover, confirm the row's logged-time chip updates without a manual refresh |
| AIO cycle pinned row navigates to `/aio-cycle/{projectKey}/{key}` | STAND-08 | Router navigation side effect against live route | Pin an AIO cycle, open `/standup-notes`, click the pinned cycle row, confirm AIO cycle detail loads |
| Real sprint data splits correctly across In Progress / Up Next | STAND-07 | Depends on live Jira sprint board state | Open `/standup-notes` with an active sprint, confirm only my leaf items appear, split correctly by status |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
