---
status: issues_found
depth: quick
critical: 0
warnings: 3
info: 3
---

# Code Review — 261029-oyw (84b7e269..06ce1557)

## Warnings

**WR-01: Sidebar CSS cap and useResizable max disagree → drag dead-zone / phantom persisted width**
`ReleaseDetailSidebar.tsx:289`, `ReleaseDetailPage.tsx:142`. `getStartWidth` fixes only drag start; the hook still clamps to `min..containerWidth*0.5` while CSS caps at `max(12.5rem, min(50%, 100% - 30rem))`. On a narrow body state can grow past the visual cap (reversing drag has a dead zone; `onCommit` persists an unseen width). Min floors also differ (240px vs 200px). Fix: hook `max` = `Math.max(200, Math.min(0.5*W, W-480))`; align min.

**WR-02: getStartWidth may read mid-transition width**
`ReleaseDetailPage.tsx:147`. Sidebar has `transition-all duration-200`; offsetWidth is animated value within 200ms of a cap change. Minor.

**WR-03: Status/Assignee/MR fully dropped at narrow tiers**
`UnifiedTaskTable.tsx:77-82`. Deliberate per plan; BR/MS flags remain without MR context; Status hidden <400px. Confirm at UAT.

## Info

- **IN-01** `UnifiedTaskTable.tsx:1194,1218` — secondary key cell `overflow-hidden` clips multi-key list without ellipsis; add `truncate` to the key text span.
- **IN-02** `UnifiedTaskTable.tsx:675-720` — `hidden … @max-[860px]:inline` relies on variant ordering (fine in Tailwind v4).
- **IN-03** `useResizable.ts:46-47` — ref assigned during render (mirrors existing minRef/maxRef pattern).

## Verified OK
Tailwind v4 `@max-[…px]:` syntax valid; no container styles itself; header strip and rows share COL_* constants; CSS math valid.
