---
phase: quick-260605-hb4
verified: 2026-06-05T12:45:00Z
status: passed
score: 7/7 must-haves verified
re_verification: # No — initial verification
---

# Quick Task 260605-hb4 Verification Report

**Task Goal:** Make issue clicks from the TopBar NotificationPopover and the Dashboard home In-Progress card always open the full issue page (`/issue/:key`) instead of the PeekPanel quick sidebar. Leave all other surfaces (Sprint Board, Backlog, Standup Notes, Command Palette, issue-detail panels) unchanged. Dashboard full-page open must reset the breadcrumb trail. Preserve markAsRead/onClose and the issue-key-button path.
**Verified:** 2026-06-05T12:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Notification row-body click navigates full-page, not PeekPanel | ✓ VERIFIED | `TopBar.tsx:101-105` — `<NotificationPopover>` receives only `onIssueClick`, `onMRClick`, `onClose`; `onOpenIssue` removed. `NotificationPopover.tsx:280-290` `handleRowClick`: `if (issueKey && onOpenIssue)` is false → falls to `if (issueKey && onIssueClick)` → `onIssueClick(issueKey)` + `onClose?.()`. |
| 2 | Dashboard In-Progress card body click navigates full-page, not PeekPanel | ✓ VERIFIED | `dashboard/index.tsx:111-118` — card receives `onIssueClick={(key) => onIssueClick(key, true)}`, no `onOpenIssue`. `DashboardInProgressCard.tsx:137,141,171,175,210` body handlers use `(onOpenIssue ?? onIssueClick)(key)` → resolves to the full-page wrapper when `onOpenIssue` is undefined. |
| 3 | Dashboard full-page opens reset the breadcrumb trail (resetTrail=true) | ✓ VERIFIED | Card wrapper passes `resetTrail=true`; `main.tsx:353-355` `handleIssueClick(key, true)` → `breadcrumbReset()`. Outlet context type widened to `(key, resetTrail?) => void` at `dashboard/index.tsx:34-37`. |
| 4 | Notification full-page opens still markAsRead + close the popover | ✓ VERIFIED | `NotificationPopover.tsx:276` `markAsRead(item.id)` runs first in `handleRowClick`; fallback branch calls `onClose?.()` (L289). Locked by new test `NotificationPopover.test.tsx:100-131` asserting `readIds` contains item + `onClose` called. |
| 5 | Issue-key button clicks still navigate full-page (no regression) | ✓ VERIFIED | `DashboardInProgressCard.tsx:154-157,190-193,225-228` key buttons `e.stopPropagation(); onIssueClick(key)`. `NotificationPopover.tsx:300-307` `handleIssueKeyClick` → `onIssueClick`. Dashboard test 3 (`:205-207`) asserts key button → `onIssueClick`. |
| 6 | Sprint Board, Backlog, Standup Notes, Command Palette, issue-detail panels keep peek behavior (untouched) | ✓ VERIFIED | grep shows all still forward `onOpenIssue`: SprintBoardTab (`:557,582,724,749,1604`), BacklogPage (`:168,1122`)/BacklogRow (`:264,287`), standup TodayColumn/UpNext/Today sections, CommandPalette (`:171`), IssueDetail* panels. No edits to these files. |
| 7 | `npm run check` (biome + tsc) stays green | ✓ VERIFIED | Ran `npm run check`: "Checked 459 files. No fixes applied." tsc clean. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/components/app/TopBar.tsx` | NotificationPopover no longer receives onOpenIssue | ✓ VERIFIED | L101-105: only onIssueClick/onMRClick/onClose passed. `onOpenIssue` dropped from destructure (L36-42); optional prop kept on `TopBarProps` for main.tsx typing. |
| `src/routes/dashboard/index.tsx` | resetTrail wrapper + no onOpenIssue to card | ✓ VERIFIED | L117: `onIssueClick={(key) => onIssueClick(key, true)}`; no onOpenIssue on card; local context type widened L34-37. |
| `src/routes/dashboard/DashboardInProgressCard.test.tsx` | test 3 asserts body → onIssueClick, no onOpenIssue | ✓ VERIFIED | L189-215: renders without onOpenIssue; key + body both assert `onIssueClick('PROJ-101')`. |
| `src/routes/notifications/NotificationPopover.test.tsx` | row-body → onIssueClick + markAsRead + onClose | ✓ VERIFIED | L100-131: full-page test added; asserts onIssueClick, readIds contains item, onClose called. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| TopBar.tsx | NotificationPopover onIssueClick (= handleIssueClick(key,true)) | onOpenIssue removed → handleRowClick fallback | ✓ WIRED | main.tsx:534 `onIssueClick={(key) => handleIssueClick(key, true)}`. |
| dashboard/index.tsx | handleIssueClick(key, true) from outlet context | onIssueClick wrapper; onOpenIssue removed | ✓ WIRED | main.tsx:575 `onIssueClick: handleIssueClick`; dashboard wraps with `true`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Targeted tests pass | `npx vitest run DashboardInProgressCard.test.tsx NotificationPopover.test.tsx` | 2 files passed, 16 tests passed | ✓ PASS |
| Lint + typecheck green | `npm run check` | 459 files checked, no fixes; tsc clean | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| HB4-01 | 260605-hb4-PLAN | Notifications + Dashboard home open full issue page (not peek); reset trail; preserve markAsRead/onClose/key-button; leave other surfaces unchanged | ✓ SATISFIED | Truths 1-7 above. |

### Anti-Patterns Found

None. No new TODO/FIXME/XXX/placeholder markers in modified files. The `onOpenIssue?` optional members and `(onOpenIssue ?? onIssueClick)` fallbacks are pre-existing intentional design (PEEK-01/05), not stubs introduced by this task.

### Gaps Summary

No gaps. All seven observable truths are verified against the merged code. The two in-scope call sites (TopBar NotificationPopover element, Dashboard InProgressCard element) no longer pass `onOpenIssue`, so leaf-component fallbacks resolve to the full-page `onIssueClick`. Dashboard opens reset the breadcrumb trail via `handleIssueClick(key, true)` → `breadcrumbReset()`. markAsRead/onClose and stopPropagation issue-key paths are intact and test-locked. All out-of-scope surfaces still forward `onOpenIssue` and were not edited. `npm run check` and both targeted test files are green.

---

_Verified: 2026-06-05T12:45:00Z_
_Verifier: Claude (gsd-verifier)_
