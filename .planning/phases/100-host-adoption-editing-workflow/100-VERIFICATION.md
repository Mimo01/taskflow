---
phase: 100-host-adoption-editing-workflow
verified: 2026-11-17T21:15:00Z
status: gaps_found
score: 4/5 roadmap truths verified
overrides_applied: 0
gaps:
  - truth: "An unsent comment or description edit survives closing the peek or modal and restarting the app (drafts keyed per issue, never lost or silently discarded)"
    status: failed
    reason: "CR-01 confirmed. PeekPanel renders IssueDetailView with no key and in-peek links swap issueKey on the same instance. CommentComposer keeps text/seededRef across the swap; IssueDetailView keeps editingCommentId/editText/editBase. After a swap, issue A's unsent text sits in issue B's editor, is persisted under B's draft key (useEditorDraft latestRef already points to B), B's stored draft is never loaded, 'Comment' posts A's text to B, and pruneCommentEdits(B) deletes the carried comment-edit draft (silent discard)."
    artifacts:
      - path: "taskflow/src/routes/dashboard/CommentComposer.tsx"
        issue: "per-issue state (text, seededRef) not reset when issueKey changes"
      - path: "taskflow/src/routes/dashboard/IssueDetailView.tsx"
        issue: "editingCommentId/editText/editBase not reset on issueKey change"
      - path: "taskflow/src/components/app/PeekPanel.tsx"
        issue: "line 90 renders <IssueDetailView> with no key={issueKey}"
    missing:
      - "key={issueKey} on <IssueDetailView> in PeekPanel.tsx (and IssueDetailPage.tsx:68), or key CommentComposer and reset edit state on issueKey change"
      - "Regression test: swap issueKey on a mounted IssueDetailView/CommentComposer and assert text, draft key and post target follow the new issue"
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
  - test: "Draft + issue-to-issue navigation inside the peek (after the CR-01 fix)"
    expected: "Each issue shows only its own draft"
    why_human: "End-to-end confirmation of the fix"
---

# Phase 100: Host Adoption & Editing Workflow Verification Report

**Phase Goal:** Every wiki text box in the app uses the new editor and unsent text is never lost or silently discarded
**Status:** gaps_found (1 blocker, CR-01)
**Re-verification:** No

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Create Epic, Create/Edit Issue, comment composer, comment edit use the new editor (inline description editing dropped, D-01) | VERIFIED | `WikiEditorLazy` is used in CreateEpicDialog, CreateEditIssueModal, CommentComposer and IssueDetailView; no other source file hosts it besides dev-tools EditorTab |
| 2 | Unsent comment/description edit survives closing the peek or modal and restart | FAILED (BLOCKER) | Store, hook and hydration exist (`drafts.store.ts`, `useEditorDraft.ts`, flush on unmount, blur and visibilitychange; `useDraftsAccountGuard` mounted in main.tsx), and the normal path works. CR-01 breaks it for in-peek issue swaps: text is mislabelled under the new issue key, the target issue's draft is not loaded, and a carried comment-edit draft is pruned. |
| 3 | Warn before discard on explicit Cancel/Esc in comment edit and Edit Issue modal; silent keep otherwise | VERIFIED (code) | `DiscardChangesDialog` wired in IssueDetailView:765 and CreateEditIssueModal:758; `onCancel={requestCancel}` only in edit mode. Review warnings WR-01/WR-04 are edge-case defects (stale-draft Discard restores old base; pending debounce can re-create a draft after save). Runtime behaviour is in human items. |
| 4 | Cmd+Enter submits and Esc cancels in every host, deferring to popovers | VERIFIED (code) / human for runtime | `onSubmit`/`onCancel` wired in all four hosts; WikiEditor.tsx:398 and :414 skip when `defaultPrevented`/composing. WR-03: comment-edit Cmd+Enter has no in-flight guard (minor). |
| 5 | Old textarea toolbar and Preview-tab code removed | VERIFIED | `insertAtCursor` absent from src (only the guard test mentions it); `editor-removal.guard.test.ts` exists; the only remaining "Preview" is the new editor's SourceView label |

**Score:** 4/5

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| HOST-01 | SATISFIED | CreateEditIssueModal on WikiEditorLazy |
| HOST-02 | DROPPED (D-01) | REQUIREMENTS.md line 67 marked dropped, traceability "Dropped"; UI-04 likewise. Not a gap. |
| HOST-03 | SATISFIED | CommentComposer and comment edit on WikiEditorLazy |
| HOST-04 | SATISFIED | CreateEpicDialog on WikiEditorLazy with staging |
| HOST-05 | SATISFIED | textarea code deleted, guard test |
| FLOW-01 | BLOCKED by CR-01 | per-issue draft keying leaks across issue swaps in the peek |
| FLOW-02 | SATISFIED (code); WR-01/WR-04 edge defects, runtime human-checked | dialog and silent-keep paths present |
| FLOW-03 | SATISFIED (code); runtime human-checked | handlers wired |

All eight IDs are accounted for; no orphaned requirements. REQUIREMENTS.md checkboxes and traceability for HOST-01/03/04/05 and FLOW-01..03 still show Pending and need updating after closure.

## Behavioral Spot-Checks

| Check | Result | Status |
|-------|--------|--------|
| `npx tsc --noEmit` (taskflow/) | no errors | PASS |
| `npx vitest run` (taskflow/) | 434 files passed, 6585 tests passed | PASS |

The suite passes despite CR-01, so no test covers an issueKey swap on a mounted view.

## Anti-Patterns / Review Findings

| Finding | Severity |
|---------|----------|
| CR-01 state/draft leak across issueKey change | BLOCKER |
| WR-01 Discard on a stale draft restores the old base | Warning |
| WR-02 generic error replaces the real Jira error | Warning |
| WR-03 no in-flight guard on comment-edit Cmd+Enter | Warning |
| WR-04 save success can resurrect the draft via a pending debounce | Warning |
| WR-05 CreateEpicDialog reopen can create a duplicate epic | Warning |
| IN-01 unstable `?? []` attachments defeat the host memo | Info |

## Gaps Summary

One blocker. CR-01 (confirmed by the orchestrator, consistent with the code read here) violates the FLOW-01 contract of drafts keyed per issue and the phase goal "never lost or silently discarded". It can post one issue's comment text to another, and the in-peek link swap is a normal user path. The fix is small (`key={issueKey}` on IssueDetailView at PeekPanel.tsx:90 and IssueDetailPage.tsx:68, plus a regression test). WR-01 and WR-04 are worth folding into the same closure plan since they also threaten draft integrity. After closure, run the human checks above.

_Verifier: Claude (gsd-verifier)_
