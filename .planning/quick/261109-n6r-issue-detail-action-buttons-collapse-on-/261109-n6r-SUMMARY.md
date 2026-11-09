---
quick_id: 261109-n6r
status: complete
commit: fb7a6b21
---

# Quick 261109-n6r Summary

Issue detail action row is now its own `@container`. Under 600px of row width, Refresh, Pin/Unpin, Log Work, Edit and Clone collapse to square 28px icon buttons; labels stay as sr-only text (accessible names unchanged) and each button has a `title` tooltip. Open in Jira + copy-link segment keeps full size at every width.

- `IssueDetailContent.tsx`: `COMPACT_ACTION_CLASS` (`w-7 px-0 @[600px]:w-auto @[600px]:px-2.5`) + `COMPACT_LABEL_CLASS` (`sr-only @[600px]:not-sr-only`); Edit/Clone gained titles.
- `LogWorkPopover.tsx`: optional `triggerClassName`, `triggerLabelClassName`; trigger has `title`. WorklogCellPopover usage unchanged.

Verification: tsc clean, biome clean on touched files, full vitest suite (pre-commit) 4534 passed. Executed inline (no planner/executor subagents — single-file trivial change). UAT: approved by user 2026-11-09 (600px breakpoint kept).
