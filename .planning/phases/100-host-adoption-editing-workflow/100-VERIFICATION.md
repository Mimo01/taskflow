---
phase: 100-host-adoption-editing-workflow
verified: 2026-11-17T21:30:00Z
status: human_needed
score: 5/5 roadmap truths verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "CR-01: comment composer and comment-edit state carried across an issueKey swap in the peek (closed by e40ba7e7)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "In the peek, press Esc while the editor is focused, while a mention/suggestion popover is open, and with the comment composer focused"
    expected: "Esc closes the popover first; with no popover, the composer blurs (peek stays) and comment edit/Edit Issue show the discard dialog only when dirty"
    why_human: "Needs the running Tauri app (focus, popover, global Esc handlers)"
  - test: "Cmd+Enter in Create Epic, Create/Edit Issue, comment composer and comment edit (also while a popover is open)"
    expected: "Submits in each host; does nothing while a popover is open"
    why_human: "Real ProseMirror keyboard behaviour and popover deferral"
  - test: "Open Create Epic (max-w-md) and check the editor toolbar"
    expected: "Toolbar fits or wraps/overflows cleanly with no clipping"
    why_human: "Visual layout"
  - test: "Type an unsent comment, close the peek, quit and relaunch the app, reopen the issue"
    expected: "Draft restored (drafts.json persisted); same for an Edit Issue description draft and a comment edit"
    why_human: "Cross-restart persistence in the real Tauri store"
  - test: "Draft + issue-to-issue navigation inside the peek (CR-01 fixed in e40ba7e7)"
    expected: "Each issue shows only its own draft"
    why_human: "End-to-end confirmation of the fix"
---

# Phase 100: Host Adoption & Editing Workflow Verification Report

**Phase Goal:** Every wiki text box in the app uses the new editor and unsent text is never lost or silently discarded
**Status:** human_needed (no blockers; runtime checks remain)
**Re-verification:** Yes, after gap closure (e40ba7e7)

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Create Epic, Create/Edit Issue, comment composer, comment edit use the new editor (inline description editing dropped, D-01) | VERIFIED | `WikiEditorLazy` is used in CreateEpicDialog, CreateEditIssueModal, CommentComposer and IssueDetailView; no other source file hosts it besides dev-tools EditorTab |
| 2 | Unsent comment/description edit survives closing the peek or modal and restart | VERIFIED (code) | Store, hook and hydration exist (`drafts.store.ts`, `useEditorDraft.ts`, flush on unmount, blur and visibilitychange; `useDraftsAccountGuard` in main.tsx). CR-01 closed by e40ba7e7: `CommentComposer` keyed `key={issueKey}` (IssueDetailView.tsx:799) so composer text/seed remount per issue; `editingCommentId/editText/editBase/discardOpen/editError/deleteError` reset during render when `issueKey` changes (lines 367-376, via `editStateIssueKey`). Because the reset happens in the same render, `useEditorDraft` sees key=null before effects run, and its key-change cleanup flushes the pending write under its captured own key (`Pending.key`), so A's draft stays under A. The D-04 reopen ref is per-issue (`reopenedForRef === issueKey`) and the comments query key includes issueKey, so B reopens only B's draft once its comments load; returning to A reopens A's draft. No other issueKey-scoped state remains in the comment-edit path. Runtime confirmation is a human item. |
| 3 | Warn before discard on explicit Cancel/Esc in comment edit and Edit Issue modal; silent keep otherwise | VERIFIED (code) | `DiscardChangesDialog` wired in IssueDetailView:765 and CreateEditIssueModal:758; `onCancel={requestCancel}` only in edit mode. Review warnings WR-01/WR-04 are edge-case defects (stale-draft Discard restores old base; pending debounce can re-create a draft after save). Runtime behaviour is in human items. |
| 4 | Cmd+Enter submits and Esc cancels in every host, deferring to popovers | VERIFIED (code) / human for runtime | `onSubmit`/`onCancel` wired in all four hosts; WikiEditor.tsx:398 and :414 skip when `defaultPrevented`/composing. WR-03: comment-edit Cmd+Enter has no in-flight guard (minor). |
| 5 | Old textarea toolbar and Preview-tab code removed | VERIFIED | `insertAtCursor` absent from src (only the guard test mentions it); `editor-removal.guard.test.ts` exists; the only remaining "Preview" is the new editor's SourceView label |

**Score:** 5/5

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| HOST-01 | SATISFIED | CreateEditIssueModal on WikiEditorLazy |
| HOST-02 | DROPPED (D-01) | REQUIREMENTS.md line 67 marked dropped, traceability "Dropped"; UI-04 likewise. Not a gap. |
| HOST-03 | SATISFIED | CommentComposer and comment edit on WikiEditorLazy |
| HOST-04 | SATISFIED | CreateEpicDialog on WikiEditorLazy with staging |
| HOST-05 | SATISFIED | textarea code deleted, guard test |
| FLOW-01 | SATISFIED (code) | per-issue keying holds across in-peek swaps after e40ba7e7; regression tests `CR-01` x2 in IssueDetailView.comment-edit.test.tsx |
| FLOW-02 | SATISFIED (code); WR-04 fixed, WR-01 unreachable, runtime human-checked | dialog and silent-keep paths present |
| FLOW-03 | SATISFIED (code); runtime human-checked | handlers wired |

All eight IDs are accounted for; no orphaned requirements. REQUIREMENTS.md checkboxes and traceability for HOST-01/03/04/05 and FLOW-01..03 still show Pending and need updating after closure.

## Behavioral Spot-Checks

| Check | Result | Status |
|-------|--------|--------|
| `npx tsc --noEmit` (taskflow/) | no errors | PASS |
| `npx vitest run` (taskflow/) | 434 files passed, 6585 tests passed | PASS |

Re-run after e40ba7e7: `npx vitest run src/routes/dashboard/IssueDetailView.comment-edit.test.tsx src/components/app/PeekPanel.test.tsx` gives 2 files, 30 tests passed. The new tests (CR-01 composer remount, CR-01 edit-state reset, WR-04 save inside debounce) cover the issueKey swap; the orchestrator showed they fail with the production change reverted. PeekPanel.test.tsx (PEEK-04, view stays mounted) still passes. The full-suite/tsc rows above are from the initial run and were not repeated.

## Anti-Patterns / Review Findings

| Finding | Severity | Disposition |
|---------|----------|-------------|
| CR-01 state/draft leak across issueKey change | Blocker | CLOSED (e40ba7e7) |
| WR-01 Discard on a stale draft restores the old base | Warning | Not reachable: `DraftNote` shows Discard only for `state === 'draft'` (draft-note.tsx), i.e. base equals live body (or is unset), so `setEditText(editBase)` restores the live text; the stale state offers only "Use Jira version" |
| WR-02 generic error replaces the real Jira error | Warning | Open, non-blocking |
| WR-03 no in-flight guard on comment-edit Cmd+Enter | Warning | Open, non-blocking |
| WR-04 save success can resurrect the draft via a pending debounce | Warning | FIXED (e40ba7e7: `draft.discard()` in editMutation onSuccess, guarded by `editingCommentId === commentId`; regression test) |
| WR-05 CreateEpicDialog reopen can create a duplicate epic | Warning | Open, non-blocking |
| IN-01 unstable `?? []` attachments defeat the host memo | Info | Open, non-blocking |

## Gaps Summary

No gaps remain. CR-01 is closed in code with regression coverage, and the PEEK-04 constraint (view stays mounted) is respected by keying only the composer and resetting edit state on key change. All five roadmap truths are verified at code level. Remaining items are the human runtime checks listed in the frontmatter (Esc/Cmd+Enter behaviour, toolbar layout, cross-restart persistence, in-peek issue navigation). Open warnings WR-02, WR-03, WR-05 and IN-01 are non-blocking. REQUIREMENTS.md checkboxes and traceability for HOST-01/03/04/05 and FLOW-01..03 still show Pending and should be updated by the orchestrator.

_Re-verified: 2026-11-17T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
