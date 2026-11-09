---
quick_id: 261109-jzm
mode: quick
---

# Quick Task 261109-jzm: Remove rounded selection on My Tasks story rows

## Task 1: Drop `rounded-md` from My Tasks row containers
- **files:** taskflow/src/routes/my-tasks/MyTaskRow.tsx
- **action:** Remove `rounded-md` from the parent (story) row and subtask row container classes so the peek selection (PEEKED_ROW_CLASS tint + inset leading bar) and hover render as square-edged bands, matching other lists.
- **verify:** `npx vitest run src/routes/my-tasks`; grep shows no `rounded-md` on row containers.
- **done:** Selected/hovered My Tasks rows have straight edges.
