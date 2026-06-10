---
phase: quick-260610-ew2
verified: 2026-06-10T11:01:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
---

# Quick 260610-ew2: Send story to top/bottom of section — Verification Report

**Task Goal:** On backlog view, right-click menu on a story has "Send to top" / "Send to bottom" options that reorder the story to first/last position within its OWN section (sprint or backlog), never changing sprint membership, using the existing optimistic rankMutation.

**Verified:** 2026-06-10T11:01:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Right-clicking a backlog row shows 'Send to top' and 'Send to bottom' items alongside Move-to/Flag | ✓ VERIFIED | `BacklogRow.tsx:375-395` renders a "Reorder" `ContextMenuGroup` after the Move-to/Flag groups, gated on `(onSendToTop \|\| onSendToBottom)`, with a `ContextMenuSeparator` when an earlier group rendered. Menu-render guard at line 300 includes the new callbacks. |
| 2 | Choosing 'Send to top' moves the story to first position of its OWN section and persists via Jira rank | ✓ VERIFIED | `handleSendToEdge` (`BacklogPage.tsx:1016-1032`) resolves section via `findSectionOfKey`, calls `resolveSendToEdge(currentKeys, issueKey, 'top')` and `rankMutation.mutate`. Helper test `top — moves to FIRST position` passes (`['C','A','B','D']`, position `{rankBeforeIssue:'A'}`). |
| 3 | Choosing 'Send to bottom' moves the story to last position of its OWN section and persists via Jira rank | ✓ VERIFIED | Same handler with `edge='bottom'`. Helper test `bottom — moves to LAST position` passes (`['A','C','D','B']`, position `{rankAfterIssue:'D'}`). |
| 4 | The story never changes sprint membership — no addIssuesToSprint / moveIssuesToBacklog called | ✓ VERIFIED | `handleSendToEdge` body (1016-1032) calls only `findSectionOfKey`, `getSectionKeys`/`localOrder`, `resolveSendToEdge`, `rankMutation.mutate`. The `addIssuesToSprint`/`moveIssuesToBacklog` calls (lines 820/851) live in separate move handlers, not on this path. `findSectionOfKey` resolves the row's CURRENT section only. |
| 5 | The reorder is optimistic with rollback-on-error, identical to drag-to-reorder (same rankMutation) | ✓ VERIFIED | Payload at `1024-1031` is byte-identical in shape to `handleDragEnd` at `1001-1008` (issueKey, sectionId, newOrder, previousOrder, rankCustomFieldId, position). Same `rankMutation` instance → same optimistic localOrder override + rollback + invalidate. `previousOrder = currentKeys` gives rollback parity (test `previousOrder equals input keys` passes). |
| 6 | When the story is already at the chosen edge, no API call fires (no-op) | ✓ VERIFIED | `resolveSendToEdge` returns null when `currentKeys.length < 2`, key missing, or synthesised `overKey === activeKey`; `handleSendToEdge` returns early on null (`if (!rank) return`). Tests `already-at-top`, `already-at-bottom`, `missing key`, `single-element` all pass (return null). |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backlogDragHelpers.ts` | `resolveSendToEdge` pure helper | ✓ VERIFIED | Lines 326-355: `SendToEdge` type + `resolveSendToEdge` delegating to `resolveIntraRankFromDrop`. No hand-rolled rank math. |
| `__tests__/backlogDragHelpers.test.ts` | Unit tests for resolveSendToEdge | ✓ VERIFIED | Lines 303-345: 7 cases (top, bottom, two no-ops, missing key, single-element ×2, rollback parity). All pass. |
| `BacklogRow.tsx` | Context-menu items + onSendToTop/onSendToBottom props | ✓ VERIFIED | Props 60/62, destructure 232-233, render guard 300, "Reorder" group 375-395 with lucide icons. |
| `BacklogPage.tsx` | `handleSendToEdge` wired through rankMutation + props threaded | ✓ VERIFIED | Import 92, handler 1016-1032, prop-types 141-142, passthrough 192-193, call-site 1161-1162. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| BacklogRow.tsx | BacklogPage.tsx | onSendToTop/onSendToBottom props via VirtualizedBacklogTable | ✓ WIRED | Declared (141-142), threaded to BacklogRow (192-193), provided at call-site (1161-1162). |
| BacklogPage.tsx | rankMutation | handleSendToEdge → rankMutation.mutate | ✓ WIRED | Line 1024 with full payload. |
| BacklogPage.tsx | backlogDragHelpers.ts | resolveSendToEdge import | ✓ WIRED | Import line 92, used line 1022. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Helper logic correct (top/bottom/no-op/rollback) | `npx vitest run .../backlogDragHelpers.test.ts` | 46/46 passed | ✓ PASS |
| Build/type integrity (baseline GREEN) | `npx tsc --noEmit` | exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EW2-01 | 260610-ew2-PLAN | Send-to-top/bottom context-menu reorder within own section | ✓ SATISFIED | All 6 truths + 4 artifacts verified. |

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/placeholder markers in the new code. The `?? 0` (rankCustomFieldId) and `?? null`-style fallbacks mirror the existing drag path; the `null` returns from `resolveSendToEdge` are the intended no-op contract, not stubs.

### Human Verification Required

None required. The behavior is fully covered by deterministic unit tests (rank math + no-op contract) and the wiring is statically traceable end-to-end. The manual sanity check noted in the plan (right-click → moves within section, membership unchanged) is non-gating and structurally guaranteed: `handleSendToEdge` resolves only the row's current section and routes exclusively through `rankMutation`, with no membership API on the path.

### Gaps Summary

No gaps. The phase goal is fully achieved: context-menu items exist and render, the handler reorders within the row's own section using the localOrder-aware base order, persists via the shared optimistic `rankMutation` (identical payload to drag, so rollback parity holds), never touches sprint membership, and no-ops when already at the chosen edge. Tests (46/46) and `tsc` are GREEN.

---

_Verified: 2026-06-10T11:01:00Z_
_Verifier: Claude (gsd-verifier)_
