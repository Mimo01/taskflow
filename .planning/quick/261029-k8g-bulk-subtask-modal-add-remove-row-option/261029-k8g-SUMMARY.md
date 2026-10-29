---
status: complete
---
# Quick 261029-k8g: Bulk subtask modal remove-row

Root cause: `SubtaskTemplateRow` in `preview` mode (used by BulkCreateSubtasksModal) only rendered a status slot; the X remove button existed only in `settings` mode, though the modal already wired `onRemove`.

Fix: preview mode now shows the X (aria-label "Remove row") for pending/failed rows; hidden while creating/created.

Commit: b54b61bd. Done inline (no planner/executor) — 1-file change. Full vitest suite passed via pre-commit.
