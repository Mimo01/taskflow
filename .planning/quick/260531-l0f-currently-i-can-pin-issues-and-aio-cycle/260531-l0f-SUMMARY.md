---
quick_id: 260531-l0f
title: Pin releases (alongside issues & AIO cycles) + Rocket icon unification
date: 2026-05-31
status: complete
branch: feat/pin-releases
---

# Quick Task 260531-l0f — Summary

## What was delivered

Users can now **pin releases** (Jira fix versions) to the pinned-tab strip, exactly like
issues and AIO cycles. The release icon is unified to lucide **`Rocket`** everywhere a
release is identified.

### Functional changes
- **Pin/Unpin button** on the Release detail page header actions (`ReleaseDetailPage.tsx`),
  mirroring the cycle Pin button: pin → `togglePin` + `setPinnedReleaseMeta`; unpin →
  `removePin` + `clearReleaseMeta`.
- **Store** (`pinned-tabs.store.ts`): added `pinnedReleaseMeta: Record<string, {name, versionId, projectKey}>`
  with `setPinnedReleaseMeta` / `clearReleaseMeta`, initialized to `{}`. Persist **version
  bumped 1 → 2** with a migration that defaults `pinnedReleaseMeta = {}` for older snapshots.
  Pins persist globally across project switches and restarts.
- **Collision-safe keys**: releases are keyed `REL-{versionId}`. The previous binary
  issue/cycle discriminator (`!key.includes('-CY-')`) is converted to a **three-way split**
  (release / cycle / issue) at every site in `main.tsx` and `PinnedTabStrip.tsx`. Release
  keys are excluded from the issue summary fetch (`issuePinnedKeys`) so they never hit
  `fetchIssueSummary` or `/issue/:key`.
- **Tab rendering**: new `ReleaseTab` variant in the `PinnedTabStrip` resolved-tab union,
  rendered with the `Rocket` icon + release name.
- **Navigation**: `onTabClick` routes `REL-` keys to `/release/:versionId`; `activeReleaseKey`
  is derived from the `/release/:versionId` URL so the correct tab highlights.

### Icon unification (Rocket)
- Sidebar nav "Releases": `sidebar-items.ts` `iconName: 'Tag'` → `'Rocket'`; `Rocket` added to
  `Sidebar.tsx` `ICON_MAP` + import.
- Releases list empty-state header: `ReleasesTab.tsx` `Package` → `Rocket` (unused `Package`
  import removed).
- Release detail header (next to `v{id}`): `ReleaseDetailPage.tsx` `Package` → `Rocket`
  (unused `Package` import removed).
- The `<Tag>` icon for the **Labels** section in `ReleaseDetailPage.tsx` was intentionally
  left untouched.

## Commits (branch `feat/pin-releases`, off `origin/main`)
- `f2e9f070` feat(quick-260531-l0f): add pinnedReleaseMeta store map + persist v2 migration
- `c29e578c` feat(quick-260531-l0f): three-way pinned-tab split + ReleaseTab render
- `99d23a71` feat(quick-260531-l0f): pin button on release detail + Rocket icon unification
- `5257394e` chore: apply biome formatting to WorklogCellPopover *(incidental — see notes)*

## Verification
- `npm run check` (biome + tsc): **PASS** (407 files, no errors).
- `vitest run pinned-tabs.store.test.ts PinnedTabStrip.test.tsx`: **24 tests pass**.
- Critical correctness self-verified against the committed code: three-way key split with
  `REL-` excluded from issue fetch and checked before `-CY-`; persist `version: 2` migration
  defaults `pinnedReleaseMeta`; `/releases` (list) vs `/release/` (detail) correctly
  distinguished in active-key/nav logic.

## Recovery note (execution deviation)
The `gsd-executor` agent crashed with an API socket error after completing Tasks 1 & 2
(committed) and writing — but not committing — the Task 3 edits. The orchestrator recovered
inline: reviewed the uncommitted Task 3 diff (complete and correct), fixed one residual `tsc`
error in `pinned-tabs.store.test.ts` (a v1→v2 migration test cast a partial persisted snapshot
to the full state type — changed to `Record<string, unknown>`), ran the full check + test
gate, then committed Task 3.

## Notes / incidental
- `WorklogCellPopover.tsx` had **pre-existing** biome format drift on `main` (identical to
  `origin/main`, untouched by this task) that made `npm run check` red. It was auto-formatted
  in a separate `chore:` commit so the branch's CI gate is green. This file is unrelated to
  release pinning — drop the chore commit if you prefer to keep the PR strictly scoped.
