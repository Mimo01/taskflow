# Quick 261113-i4u: Unify epic Progress section header and buttons - Summary

Epic Progress is now a plain section with the default sticky SectionHeader, and the Count/SP/Time toggle and zoom presets share one quiet `SectionSegmented` control exported from SectionHeader.tsx.

## Commits
- e1538a45: feat - add SectionSegmented (SectionHeader.tsx + tests)
- 07b83296: feat - Progress section without border band; metric toggle and zoom presets via SectionSegmented (EpicProgressSection.tsx, EpicChartZoom.tsx, EpicProgressSection.test.tsx)

## What changed
- SectionSegmented<T>: role=group + aria-label, one button per option with aria-pressed (all false when value is null). Muted track (bg-muted/60), active item on bg-background with shadow-xs, no font-weight change, no ring-1 borders.
- EpicProgressSection: SECTION_CLASS removed; section has no classes; SectionHeader is a direct child (default sticky, mb-2); everything else is in `div[data-testid=epic-progress-body].space-y-5`. Skeleton mirrors it (h-7 header row, same body wrapper, no border). Dashed "By person" divider kept with an updated comment. Module doc updated. 'use no memo' retained.
- EpicChartZoom ZoomPresets renders SectionSegmented; unused `cn` import removed.
- Tests: border assertions replaced with no-border + sticky/mb-2 direct-child assertions; four SectionSegmented tests added.

## Verification
Full vitest suite (5237 passed, via the pre-commit hook), biome on touched files, tsc --noEmit, and the leftover-class grep were all clean.

## Deviations
- The worktree HEAD was not at the expected base, so I reset it to e68e5e2c per the branch check. I symlinked taskflow/node_modules from the main checkout (ignored by git).
- Biome reformatted two files (--write on touched files only). Nothing else deviated.

## Task 3: human check (not done)
Run the app (npm run tauri dev in taskflow/) and open an epic detail:
1. Progress header matches Description and Stories: same label style and row height, no top/bottom border lines, similar spacing above and below.
2. Count / SP / Time: the active item shows a subtle raised pill, no width shift, no primary colour.
3. Chart zoom presets look identical to the metric toggle (including a dragged custom range, where nothing is highlighted).
4. Tab through both groups: focus ring is visible. Scroll: the Progress header sticks like the others.
5. Light and dark themes. Also check the loading skeleton does not jump into the loaded layout.
