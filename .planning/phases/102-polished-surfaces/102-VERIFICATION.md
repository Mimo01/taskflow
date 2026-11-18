---
phase: 102-polished-surfaces
verified: 2026-11-18T14:30:00Z
status: human_needed
score: 2/2 roadmap success criteria verified (code level); 4 runtime items need the real app
human_verification:
  - test: "Click Reply on a notification for an issue comment"
    expected: "Issue opens, composer expands, editor focused"
    why_human: "Real notification flow (useComposerFocus wiring is present in CommentComposer.tsx but not exercised end to end)"
  - test: "Save an epic draft with name and label, close, reopen it"
    expected: "Name, label and sidebar fields restored; stale-field notes after createmeta settles"
    why_human: "Needs real persisted drafts and Jira createmeta"
  - test: "Start a Bulk create subtasks run"
    expected: "Close X disabled and Esc/backdrop ignored while creating"
    why_human: "Needs a Jira write"
  - test: "Open the four modals and the comment composer against real Jira data"
    expected: "Consistent look with real projects, fields and long content"
    why_human: "Visual sign-off was done with headless Chromium and a stub backend"
---

# Phase 102: Polished Surfaces Verification Report

**Phase Goal:** The remaining editing surfaces look and behave consistently with the new modal
**Status:** human_needed (no code gaps found)
**Re-verification:** No, initial

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Comment hosts have an expanding editor and a consistent action row (UI-03) | VERIFIED | `CommentComposer.tsx` uses `useExpandOnFocus` and `CommentActionRow` (lines 12, 14, 63, 146); `IssueDetailView.tsx` comment edit uses the same `CommentActionRow` (line 1123); `useComposerFocus` wired for Reply. Post-plan fixes 82679775 (Attach on empty composer), 6235d4eb (sticky growth), 940a7e48 (destroyed editor) are in history. |
| 2 | Create Epic, Bulk Create Subtasks and Edit Release are larger and consistent with the Issue modal (UI-05) | VERIFIED | `ModalShell` is imported by CreateEditIssueModal, CreateEpicDialog, BulkCreateSubtasksModal and EditReleaseModal. CreateEpicDialog renders `ModalSidebar variant="epic"` and uses `buildEpicCreateFields` with `epicNameFieldKey`. |
| 3 | Edit Release keeps plain-text/Markdown fields | VERIFIED | `EditReleaseModal.tsx` uses `Textarea` and the shared `Switch`, with no WikiEditor reference. |

**Score:** 3/3 truths verified in code.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|-------------|--------|----------|
| UI-03 | 102-02, 102-03, 102-10 | SATISFIED | Truth 1 |
| UI-05 | 102-01, 04, 05, 06, 07, 08, 09, 10 | SATISFIED | Truths 2 and 3 |
| UI-04 | none | DROPPED | Phase 100 D-01, not an orphan |

No orphaned requirements. Note: REQUIREMENTS.md still shows UI-03 and UI-05 as unchecked/Pending; update the traceability table at phase close.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase surfaces' tests | `npx vitest run` on CreateEpicDialog, CommentComposer, EditReleaseModal, BulkCreate, ModalShell | 7 files, 118 tests passed | PASS |
| Full suite and tsc | per orchestrator after final merge | 6857 pass, tsc clean | PASS (not re-run by me) |

## Anti-Patterns

No TBD/FIXME/XXX in the phase's main files. Review findings CR-01, WR-01 and WR-02 are fixed (102-REVIEW-FIX.md). IN-01..IN-07 are info-level and deferred (IN-05 and IN-06 are worth a revisit if users notice them).

## Human Verification Required

See frontmatter. All four items are things the delegated headless-browser sign-off could not exercise. They are not code gaps.

## Gaps Summary

None. Code-level evidence supports both success criteria. Runtime and real-data checks remain with the user.

_Verified: 2026-11-18_
_Verifier: Claude (gsd-verifier)_
