---
phase: 100-host-adoption-editing-workflow
plan: 04
subsystem: ui
tags: [wiki-editor, create-epic, attachments, shortcuts]
requires: [100-01, 100-03]
provides:
  - Create Epic host on WikiEditorLazy (full preset) with staged attachments and Cmd+Enter submit
affects: [100-05, 100-06]
key-files:
  modified:
    - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
    - taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx
    - taskflow/src/test/wiki-editor-stub.tsx
key-decisions:
  - "Submit guard (canSubmit) shared by button disabled state, form submit, and Cmd+Enter"
requirements-completed: [HOST-04, FLOW-03]
metrics:
  completed: 2026-11-17
---

# Phase 100 Plan 04: Create Epic host Summary

Create Epic description is now the full-toolbar WikiEditor. Pasted, dropped, or attached files are staged and uploaded to the new epic after createIssue. Cmd/Ctrl+Enter submits from the name field or the editor under the same guard as the button, and the button tooltip shows "Create Epic" with keycaps.

## Tasks

1. Editor swap, staging, upload, created-with-error handling (commit 1 of 2, "feat(100-04): Create Epic description on WikiEditorLazy...").
2. Cmd+Enter, flushSync of latest editor text, keycap tooltip (commit 2 of 2, "feat(100-04): Create Epic Cmd+Enter submit and keycap tooltip").

## Deviations from Plan

**1. [Rule 1 - Bug in test stub] wiki-editor-stub did not stop propagation of Cmd+Enter**
- The real editor stops propagation when it handles Cmd+Enter (plan states this); the stub let it bubble to the form, causing a double submit in tests. Stub now calls stopPropagation when onSubmit is provided. Production code unchanged.

## Notes

- Dialog kept at max-w-md. Whether the full toolbar overflows at 400px was not checked visually; flag as a Phase 102 UAT item.

## Known Stubs

None.

## Self-Check: PASSED
