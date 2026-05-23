---
phase: quick-260318-td7
verified: 2026-03-18T20:20:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Open app and inspect TopBar"
    expected: "Two separate bell icons visible side by side -- one with orange dot (Jira), one with purple dot (GitLab)"
    why_human: "Visual layout and colored dot indicators cannot be confirmed programmatically"
  - test: "Click Jira bell icon"
    expected: "Popover opens with header 'Jira Notifications' showing only Jira-sourced notifications"
    why_human: "Source filtering at runtime with live data requires visual confirmation"
  - test: "Click GitLab bell icon"
    expected: "Popover opens with header 'GitLab Notifications' showing only GitLab-sourced notifications"
    why_human: "Source filtering at runtime with live data requires visual confirmation"
  - test: "Press Cmd+Shift+N"
    expected: "Jira notification popover toggles open/closed; GitLab popover is unaffected"
    why_human: "Hotkey behavior requires runtime testing"
  - test: "Click 'Mark all as read' in Jira popover"
    expected: "Only Jira notifications are marked read; GitLab popover still shows its unread badges"
    why_human: "Per-source read state isolation requires runtime testing with seeded data"
---

# Quick Task 260318-td7: Split Notifications Verification Report

**Task Goal:** Split gitlab and jira notifications into separate views/icons
**Verified:** 2026-03-18T20:20:00Z
**Status:** human_needed (all automated checks passed)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TopBar shows two separate notification icons -- one for Jira (orange-tinted) and one for GitLab (purple-tinted) | VERIFIED | TopBar.tsx lines 59-96: two Popover blocks, Jira with `bg-orange-500` dot, GitLab with `bg-purple-600` dot |
| 2 | Each icon shows its own unread badge count (Jira-only or GitLab-only) | VERIFIED | TopBar.tsx uses `useJiraUnreadCount()` and `useGitlabUnreadCount()` independently; each badge only renders when its count > 0 |
| 3 | Clicking Jira icon opens a popover showing only Jira notifications | VERIFIED | TopBar.tsx line 74: `<NotificationPopover source="jira" .../>` inside Jira Popover; NotificationPopover.tsx line 71 filters `items.filter((i) => i.source === source)` |
| 4 | Clicking GitLab icon opens a popover showing only GitLab notifications | VERIFIED | TopBar.tsx line 94: `<NotificationPopover source="gitlab" .../>` inside GitLab Popover; same source-filter logic |
| 5 | Cmd+Shift+N still opens one of the popovers (Jira by default) | VERIFIED | main.tsx line 154: `useHotkeys('mod+shift+n', () => setJiraNotifOpen((prev) => !prev))` |
| 6 | Mark all read in one popover only marks that source's items as read | VERIFIED | NotificationPopover.tsx line 109: calls `markAllReadBySource(source)`; store implementation (line 115-118) filters by source before extending readIds |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/stores/notifications.store.ts` | Source-specific unread count selectors | VERIFIED | Exports `useJiraUnreadCount` (line 167), `useGitlabUnreadCount` (line 173), and `markAllReadBySource` action (line 115). Original `useUnreadCount` and `markAllRead` retained for backward compatibility. |
| `taskflow/src/components/app/TopBar.tsx` | Two separate notification icons with independent popovers | VERIFIED | Props split into `jiraNotifOpen/onJiraNotifChange` and `gitlabNotifOpen/onGitlabNotifChange`. Two full Popover blocks with source-specific indicators and badge counts. |
| `taskflow/src/routes/notifications/NotificationPopover.tsx` | Source-filtered notification feed | VERIFIED | `source: 'jira' | 'gitlab'` required prop. Filters via `items.filter((i) => i.source === source)`. Header dynamically shows 'Jira Notifications' or 'GitLab Notifications'. No dual-source grouping logic remains. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TopBar.tsx` | `notifications.store.ts` | `useJiraUnreadCount` and `useGitlabUnreadCount` | WIRED | Line 13: `import { useJiraUnreadCount, useGitlabUnreadCount } from '../../stores/notifications.store'`; line 37-38: both hooks called and results used in badge rendering |
| `TopBar.tsx` | `NotificationPopover.tsx` | `source="jira"` and `source="gitlab"` props | WIRED | Line 74: `source="jira"` passed to Jira popover content; line 94: `source="gitlab"` passed to GitLab popover content |
| `main.tsx` | `TopBar.tsx` | `jiraNotifOpen/gitlabNotifOpen` state pairs | WIRED | Lines 103-104: two `useState` declarations; lines 379-382: all four props passed to TopBar correctly |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| QUICK-TD7 | Split gitlab and jira notifications into separate views/icons | SATISFIED | Two-icon TopBar with source-filtered popovers, independent unread counts, per-source mark-as-read, Cmd+Shift+N toggling Jira popover |

### Anti-Patterns Found

No anti-patterns detected in the modified files. No TODOs, placeholder returns, empty handlers, or stub implementations found.

### TypeScript Compilation

`npx tsc --noEmit` produces 6 pre-existing errors in unrelated files (`SprintBoardTab.test.tsx`, `EpicDetailSheet.test.tsx`, `jira.ts`). Zero errors in any of the four files modified by this task.

### Commit Verification

Both task commits confirmed in git log:
- `dceea4e` — Task 1: source-specific selectors + source-filtered NotificationPopover
- `a7ba1b5` — Task 2: dual-icon TopBar + dual popover state in main.tsx

### Human Verification Required

#### 1. Two-icon visual layout

**Test:** Open the app and look at the TopBar (top-right area).
**Expected:** Two bell icons visible side by side. Left bell has a small orange dot at bottom-right. Right bell has a small purple dot at bottom-right.
**Why human:** CSS visual rendering and icon placement cannot be confirmed programmatically.

#### 2. Jira popover source filtering

**Test:** Click the bell with the orange dot.
**Expected:** Popover opens titled "Jira Notifications" containing only Jira items (no GitLab MR notes, pipeline failures, etc.).
**Why human:** Runtime filtering with live data requires visual confirmation.

#### 3. GitLab popover source filtering

**Test:** Click the bell with the purple dot.
**Expected:** Popover opens titled "GitLab Notifications" containing only GitLab items (no Jira comments, issue-assignment, etc.).
**Why human:** Runtime filtering with live data requires visual confirmation.

#### 4. Keyboard shortcut

**Test:** Press Cmd+Shift+N while no popover is open.
**Expected:** The Jira (orange) notification popover opens. GitLab popover remains closed.
**Why human:** Hotkey behavior requires runtime testing.

#### 5. Per-source mark-as-read isolation

**Test:** With unread notifications in both sources, open the Jira popover and click "Mark all as read."
**Expected:** Jira badge clears to 0. GitLab badge still shows its unread count and its items remain unread.
**Why human:** Per-source read state isolation requires seeded data and runtime observation.

### Gaps Summary

No gaps found. All six truths are verified by concrete code evidence. Implementation is substantive (no stubs), fully wired (imports consumed, props used, store actions called), and TypeScript-clean in the modified files.

---

_Verified: 2026-03-18T20:20:00Z_
_Verifier: Claude (gsd-verifier)_
