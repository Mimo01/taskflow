---
phase: 100-host-adoption-editing-workflow
plan: 07
subsystem: ui
tags: [drafts, create-edit-issue, discard-guard, FLOW-01, FLOW-02, FLOW-03, HOST-01]
requires: [100-02, 100-03, 100-05]
provides:
  - fetchIssueDescription (live description read, null on 404)
  - Edit Issue description drafts with stale check
  - Reason-aware close handling and discard guard in Edit Issue
key-files:
  modified:
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
    - taskflow/src/services/jira.ts
  created:
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.drafts.test.tsx
key-decisions:
  - "Draft restored through RESET (descriptionOverride read non-reactively in the open effect); late hydration restores once only if the user has not typed"
  - "Stale check uses a separate live query key ['jira-issue-description', key, baseUrl], staleTime 0"
  - "Esc: Base UI escape-key is cancelled and routed to requestCancel unless the editor already preventDefault'd it (single path)"
metrics:
  tasks: 2
  completed: 2026-11-17
---

# Phase 100 Plan 07: Edit Issue drafts and discard guard Summary

Edit Issue keeps an unsaved description as a persisted draft (restored through the RESET, stale-checked against a live Jira read), and only Cancel/Esc with changes asks "Discard changes?"; X and backdrop close silently and keep the draft. Create mode is untouched.

## Tasks

Both tasks edit the same files and share one test file, and the pre-commit hook runs the full suite, so they were committed together: cc1203c8.

1. Draft seeding, write (500 ms, base = opening description), DraftNote (Draft saved / stale), Use Jira version, Discard, clear on save, keep on failed save with the UI-SPEC copy, clear issue drafts on live 404.
2. requestCancel/closeSilently, onOpenChange branching on details.reason with details.cancel(), editor onCancel (edit only), Cancel tooltip with Esc keycap, DiscardChangesDialog nested inside Dialog.Popup.

## Deviations from Plan

- Worktree HEAD was not on the expected base; ran the sanctioned reset to fe203089 at startup.
- The failed-save copy is shown only when the description is dirty; otherwise the server error message is kept.
- Assumption A3 is proven behaviourally (Esc on summary opens the guard without closing; X and backdrop close silently), not by reading the reason value directly.
- Added a biome-ignore for the focusout wrapper div (flush on blur).

## Known Stubs

None.

## Threat Flags

None. T-100-22..25 mitigations implemented (text only passed as editor value, 404 clears drafts, X/backdrop flush and keep draft).

Manual UAT (WKWebView) for popover-open Esc stacking remains per 100-VALIDATION.md.

## Self-Check: PASSED
