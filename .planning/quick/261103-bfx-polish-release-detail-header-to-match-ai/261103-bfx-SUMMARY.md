---
status: complete
quick_id: 261103-bfx
---

# Quick 261103-bfx: Release detail header polish — Summary

MR labels and the "N MRs without label" chip now live in a full-width wrapping strip at the bottom of one bordered `release-stats` block (done bar, graphs, strip). The MR cell is ring-only. The header follows CycleHeader geometry.

## Commits
- a8b513ae feat: labels strip, ring-only MR donut (MrLabels, ReleaseMrDonut, page + tests)
- f17b6548 feat: AIO-aligned header, `release-stats` section, skeleton in lockstep
- 32d0a85f test: responsive class contract

## Notes
- Header: pt-3 pb-2, non-wrapping title row (justify-between gap-3), flex-none actions, Refreshed hidden by container query only, single Pin icon (filled when pinned), PropertyStrip mt-1.
- Done bar lost its own border/padding; `release-stats` is `border-y px-6 py-4`; strip is `border-t pt-3` inside it. Skeleton mirrors it, no legend bars.
- Strip has a muted Tag icon + "Labels" caption (sr-only at <=440), chip first, hairline, then all pills (max-w-[16rem] truncate).

## Screenshots (throwaway harness, not committed; real header/done bar/donut/strip components, burnup stubbed as empty box)
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/06548ce5-cfbb-4680-9bf3-fe2f6e86c2fc/scratchpad/bfx-1300.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/06548ce5-cfbb-4680-9bf3-fe2f6e86c2fc/scratchpad/bfx-1000.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/06548ce5-cfbb-4680-9bf3-fe2f6e86c2fc/scratchpad/bfx-600.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/06548ce5-cfbb-4680-9bf3-fe2f6e86c2fc/scratchpad/bfx-400.png
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/06548ce5-cfbb-4680-9bf3-fe2f6e86c2fc/scratchpad/bfx-1300-dark.png

Observed: title truncates on one line with actions icon-only on the same row at 600/400; strip wraps with chip first; 12 labels incl. a very long one, no horizontal overflow; ring centred. 1000/dark shots not individually reviewed. The page-level band layout itself was not rendered (harness used the 2-col layout), band is covered by class tests.

## Deviations
- Visual check used Chrome headless `--screenshot` (no playwright package available); harness put temporarily in worktree `taskflow/shot-tmp/` (vite needs module resolution) and deleted before commit.
- The existing page test asserting `queryByText('Labels')` is null was replaced (the new caption is "Labels").
- Biome `--write` was run on touched files only.
