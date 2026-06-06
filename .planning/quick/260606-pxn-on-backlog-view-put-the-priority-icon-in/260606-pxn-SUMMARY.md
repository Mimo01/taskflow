---
quick_id: 260606-pxn
description: On backlog view, put the priority icon into the task rows
date: 2026-06-06
status: complete
---

# Quick Task 260606-pxn — Summary

**Goal:** Show the Jira priority icon in each Backlog view task row.

## What changed

`taskflow/src/routes/dashboard/BacklogRow.tsx` — the existing `PriorityIcon`
component (`@/components/ui/priority-icon`, reused — not reinvented) now renders
in a **dedicated priority column** between the key cell and the summary cell,
giving each row the sprint-board swimlane order: **key → priority → title**.

## Commits

| Commit | What |
|--------|------|
| `41132d74` | Initial: render PriorityIcon leading the summary cell |
| `f686edd7` | UAT refinement: move icon to its own column; explicit-px wrapper; px-0 padding |

## UAT iterations (notable)

The change was driven through live UAT against the running app. Key finding:

- A **standalone narrow `<td>` collapsed to 0 width** in the Backlog table.
  Root cause: the table is **row-virtualized** with `position: absolute` on each
  `<tr>`, which breaks CSS table column sizing in the WebKit/WKWebView (Tauri)
  renderer. Content sized via Tailwind classes (e.g. `w-3.5`) contributes **0
  min-content**, so the column collapses.
- **Fix:** size the cell's inner wrapper with an **explicit pixel** size
  (`style={{ width: 18, height: 18 }}`) — the same technique `CachedAvatar` uses
  to keep the avatar column from collapsing. The column then holds width reliably.
- Final padding tuned to `px-0` per user preference.

## Verification

- `npm run check` (biome + tsc, 462 files) — GREEN
- Live UAT — user confirmed: icon renders in its own aligned column; correct
  per-priority icons; no broken-image for priority-less issues; row
  click/peek/navigate/drag-to-rank/context-menu unaffected.

## Notes

- Executor ran in worktree isolation and paused at a `human-verify` checkpoint;
  the orchestrator merged the worktree branch to `main` (ff) so the change was
  visible in the running dev server, then applied the UAT refinements inline.
- No ROADMAP.md changes (quick task).
