---
phase: quick-261118-l2f
plan: 01
subsystem: app-shell
tags: [sidebar, layout, responsive]
key-files:
  created:
    - taskflow/src/lib/sidebar-layout.ts
    - taskflow/src/lib/sidebar-layout.test.ts
    - taskflow/src/hooks/useSidebarAutoRail.ts
    - taskflow/src/stores/sidebar-overlay.store.ts
  modified:
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/components/app/Sidebar.test.tsx
    - taskflow/src/components/app/PeekPanel.tsx
    - taskflow/src/main.tsx
    - taskflow/src/routes/my-tasks/MyTasksPage.tsx
decisions:
  - Auto-rail decision uses the expanded sidebar width to avoid oscillation
  - Overlay state is non-persisted; sidebarCollapsed is never touched by auto-rail
metrics:
  completed: 2026-11-18
---

# Quick 261118-l2f: Sidebar auto-rail at narrow widths

The sidebar now drops to the 64px icon rail automatically when the window can't fit the expanded sidebar plus the peek panel and still leave 720px for main content. It expands as an overlay on demand.

## Commits
- ef1edccf: helper, hook, overlay store, shared PEEK_PANEL_DEFAULT_WIDTH constant
- e88544b0: Sidebar/main.tsx wiring, Sidebar tests, My Tasks tile grid moved to `@[40rem]:grid-cols-3`

## Behaviour
- Overlay: 64px in-flow placeholder keeps main's width fixed; aside is absolute z-40 with shadow. Closes on Esc, outside pointerdown, nav click, or widening out of auto-rail.
- Chevron and Cmd+B toggle the overlay in auto-rail mode, else the persisted flag as before.

## Deviations from Plan
- Wrapper div uses `contents` outside overlay mode so non-overlay rendering is unchanged.
- Biome reformatted Sidebar.tsx (reindent from the new wrapper), so its diff is large.
- Worktree HEAD was reset to the plan base commit bf3417fc at start (merge-base differed).
- The pre-commit hook reported "no TypeScript changes staged" (path-based detection from the worktree root); tsc, vitest and biome were run manually and pass.

## Human verification pending
Run `npm run tauri dev` in taskflow/taskflow, open My Tasks:
1. About 1100px wide: sidebar stays expanded.
2. Open a peek panel: sidebar drops to the rail; closing peek restores it.
3. About 900px: rail shows. Cmd+B or the chevron overlays the full sidebar without reflowing rows. Esc, outside click, or nav click closes it.
4. About 1400px: expanded sidebar returns; Cmd+B collapses/expands persistently.

## Self-Check: PASSED
Tests (58) pass, tsc clean, biome clean on touched files (pre-existing warnings only).

## Orchestrator follow-up

- `e939a13d` fix: with the persisted `sidebarCollapsed=true` at a narrow width, the overlay opened as a 64px rail (`effectiveCollapsed = sidebarCollapsed || …`). Now `effectiveCollapsed = autoRail ? !overlayOpen : sidebarCollapsed`; regression test added (failed before the fix).
- The pre-commit hook skipped tsc/tests for the executor's commits inside the agent worktree ("no TypeScript changes staged"); checks were run manually there and the hook ran normally on main.

## Rework after user review (supersedes the auto-rail above)

User rejected the sidebar auto-collapsing. `8c649f00` reverts ef1edccf/e88544b0/e939a13d (auto-rail, overlay store, Sidebar changes). `e3be8004` makes My Tasks itself adapt, verified by rendering the real page in headless WebKit at 396/452/576/676px content widths:
- Stat tiles always 3 across; below 40rem compact (smaller padding/number, no watermark). The earlier `@[40rem]:grid-cols-3` stacked them into a ~330px column with peek open — worse.
- Status pill capped at 6.5rem below 45rem ("Selected for Development" ellipsizes, full name in title).
- Below 32rem: issue key hidden (row click still opens peek), subtask indent ml-9 → ml-5.
