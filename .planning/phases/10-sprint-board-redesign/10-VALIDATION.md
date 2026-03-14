---
phase: 10
slug: sprint-board-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + React Testing Library 16.3.2 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx src/services/jira.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-W0-01 | W0 | 0 | BOARD-01 | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ❌ W0 | ⬜ pending |
| 10-W0-02 | W0 | 0 | BOARD-03 | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ❌ W0 | ⬜ pending |
| 10-W0-03 | W0 | 0 | BOARD-03 | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ❌ W0 | ⬜ pending |
| 10-W0-04 | W0 | 0 | BOARD-04 | unit | `npx vitest run src/routes/dashboard/QuickCreateInput.test.tsx` | ❌ W0 | ⬜ pending |
| 10-W0-05 | W0 | 0 | service | unit | `npx vitest run src/services/jira.test.ts` | ❌ W0 | ⬜ pending |
| 10-xx-01 | TBD | 1 | BOARD-01 | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ | ⬜ pending |
| 10-xx-02 | TBD | 1 | BOARD-02 | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ | ⬜ pending |
| 10-xx-03 | TBD | 2 | BOARD-03 | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ❌ W0 | ⬜ pending |
| 10-xx-04 | TBD | 2 | BOARD-04 | unit | `npx vitest run src/routes/dashboard/QuickCreateInput.test.tsx` | ❌ W0 | ⬜ pending |
| 10-xx-05 | TBD | 3 | BOARD-05 | unit | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/dashboard/SprintBoardTab.test.tsx` — add stubs for: story-in-multiple-columns, drag rollback via mocked onDragEnd, column-from-workflow-API (BOARD-01, BOARD-03)
- [ ] `src/routes/dashboard/QuickCreateInput.test.tsx` — new file; stubs for show input on click, submit on Enter, hide on Escape (BOARD-04)
- [ ] `src/services/jira.test.ts` — add stubs for `fetchProjectStatuses` (flatten/dedup) and `createIssue` (body format, response parse)
- [ ] `npm install @dnd-kit/core @dnd-kit/utilities` — required before any drag implementation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag card across columns visually | BOARD-03 | jsdom `getBoundingClientRect` returns zeros, breaking dnd-kit collision detection | Open sprint board, drag a subtask card from one column to another, verify optimistic move and API call |
| Card snaps back on failed transition | BOARD-03 | Requires network failure simulation | Mock API error, drag card, verify rollback animation |
| Board creates issue in correct column | BOARD-04 | Two-step create+transition sequence; visual confirmation needed | Click "+" in In Progress column, type issue summary, press Enter, verify card appears in that column |
| All team member cards visible | BOARD-01 | Requires multi-user Jira test data | Login as user with team access, open sprint board, verify other members' issues appear as cards |

---

## Drag Interaction Test Strategy

**Do not simulate drag events in jsdom.** Per dnd-kit maintainers: jsdom's `getBoundingClientRect` returns all zeros, breaking collision detection. Instead:

1. Test board layout (column rendering, card placement) without drag
2. Test the `onDragEnd` handler logic directly by calling it with mock `DragEndEvent` objects
3. Test `postTransition` call and rollback by mocking the service and asserting state

```typescript
// Pattern: test drag result handler without simulating drag
const mockDragEnd: DragEndEvent = {
  active: { id: 'PROJ-2', data: { current: { issueKey: 'PROJ-2', currentStatus: 'To Do' } } },
  over: { id: 'status-id-2', data: { current: { statusName: 'In Progress' } } },
} as unknown as DragEndEvent
```

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
