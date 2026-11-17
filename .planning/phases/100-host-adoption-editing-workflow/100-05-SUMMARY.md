---
phase: 100-host-adoption-editing-workflow
plan: 05
subsystem: ui
tags: [wiki-editor, create-edit-issue, attachments, shortcuts]
requires: [100-01, 100-03]
provides:
  - Create/Edit Issue description on WikiEditorLazy (HOST-01)
  - Form-wide Cmd+Enter submit with button-equal guard (FLOW-03, D-14)
  - Primary button keycap tooltip (D-15)
affects: [100-07, 100-09]
key-files:
  modified:
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
    - taskflow/src/routes/dashboard/CreateEditIssueModal.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.attachments.test.tsx
    - taskflow/src/test/wiki-editor-stub.tsx
key-decisions:
  - "Single canSubmit predicate drives both the button disabled state and trySubmit, so Cmd+Enter cannot duplicate-create (T-100-15)"
  - "Create and clone always use the staged host; only edit mode with an issue key gets the live host (T-100-16)"
metrics:
  completed: 2026-11-17
---

# Phase 100 Plan 05: Create/Edit Issue host Summary

The Create/Edit Issue description now uses WikiEditorLazy (full preset) with a staged host in create/clone and useIssueEditorHost in edit; Cmd/Ctrl+Enter from any field submits through the same guard as the primary button, which gets a label plus keycap tooltip.

## Tasks

Both tasks touch the same files and the pre-commit hook runs the full suite, so they were committed together: 4aba6489.

1. Host swap: removed DescriptionEditor, the live uploadMutation and inline upload error state; added editorRef, StagedFilesStrip, useMentionUserMap, liveHost/stagedHost. Attach button supports multiple files via editor insertFiles. useIssueMutations uses uploadStagedFiles.
2. Cmd+Enter: formRef/summaryRef, canSubmit, trySubmit (focuses an empty summary), form onKeyDown, editor onSubmit with flushSync, Tooltip with Keycap on the primary button. No onCancel is passed and onOpenChange is unchanged (100-07 owns that).

## Deviations from Plan

**1. [Rule 1 - Bug in shared test stub] Stub did not stop Cmd+Enter propagation**
- The real editor stops propagation; the stub let the event reach the form, causing a double submit in tests.
- Fix: e.stopPropagation() in taskflow/src/test/wiki-editor-stub.tsx.

**2. Mock fix:** the auth.store mock in the attachments test now supports selectors, since useIssueEditorHost calls useAuthStore(selector).

**3. Edit-mode upload error:** the old inline "Failed to upload X" text is gone; upload errors are now surfaced by the editor itself (Phase 99 host path). The epic-story test needed no change.

## Known Stubs

None.

## Self-Check: PASSED
