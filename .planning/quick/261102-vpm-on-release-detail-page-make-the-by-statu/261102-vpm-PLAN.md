---
quick_id: 261102-vpm
type: quick
---
# Quick 261102-vpm: compact release detail By status rows

User choice (asked): **shorter rows** only — no change to row cap, width, or the "+N more" line.

## Task 1
- files: taskflow/src/routes/dashboard/release-detail/graphs/ReleaseStatusRows.tsx
- action: compact row height 24px → 20px via a `COMPACT_ROW_HEIGHT` const; update the `compact` prop doc.
- verify: release-detail vitest suite green; biome clean on the file.
- done: By status rows render at 20px in every release detail layout (all pass `compact`).
