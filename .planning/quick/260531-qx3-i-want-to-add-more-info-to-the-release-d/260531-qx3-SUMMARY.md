---
phase: quick-260531-qx3
plan: 01
subsystem: release-detail-ui
tags: [react, jira, gitlab, ui, release]
requires:
  - releaseMrs (milestoneMRs) — already loaded
  - releaseIssues (fixVersionIssues) — already loaded
provides:
  - MR-state distribution (merged/open/closed) on release sidebar
  - Contributor list (unique MR authors) in left column
  - Issue status distribution + conditional story-point effort line
affects:
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
tech-stack:
  added: []
  patterns:
    - "memo-free derived consts recomputed per render (mirrors existing labelMap/labelCoverage)"
    - "graceful-hide guards: gitlabMatch.type !== 'none' && milestoneMRs && length > 0"
    - "Badge tone + CachedAvatar reuse; no new components"
key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
decisions:
  - "Story points read from customfield_10016 added to the issue fetch fields (no new query)"
  - "closed bucket folds 'closed' and 'locked' MR states (exhaustive, no switch)"
  - "tone=muted used for closed MRs (ChipTone has no 'gray')"
metrics:
  duration: ~6m
  completed: 2026-05-31
---

# Quick Task 260531-qx3: Add more info to the release detail page Summary

Surfaced three already-loaded info groups on the release detail page — MR-state distribution, contributor list, and issue status distribution + story-point effort — reusing existing Badge/CachedAvatar/MetaRow patterns, with one fetch-field addition (`customfield_10016`) and no new queries.

## What Was Built

**Task 1 — Data derivations + fetch field (commit 4c27ca0f):**
- Added `customfield_10016` to the `fetchFixVersionIssues` `fields` string so loaded issues carry story points when configured. React Query key (line 297) left untouched — it does not include fields, so the cache change is safe.
- Imported `Users` from lucide-react (alphabetical order preserved).
- Derived four memo-free consts after `labelCoverage`:
  - `mrStateCounts` `{ merged, opened, closed }` — folds `closed`/`locked` into `closed`, exhaustive without a switch.
  - `contributors` — `Map<number, author>` deduped by `author.id`, sorted by name.
  - `issueStatusCounts` `{ new, indeterminate, done }` — buckets by `statusCategory?.key` with `'new'` default for undefined.
  - `storyPoints` `{ total, completed }` + `hasStoryPoints` — sums `customfield_10016` guarded by `typeof === 'number'`; `completed` counts only done-category issues.

**Task 2 — Rendering (commit e0133d2b):**
- **MR-state distribution:** sidebar `MetaRow label="MRs"` (after MR Labels row) with GitMerge icon + Badge counts (`tone=green/blue/muted`). Zero buckets omitted; whole row hidden when `gitlabMatch.type === 'none'` or no MRs (no "—").
- **Contributor list:** left-column `<section>` (after Labels) with `Users` icon, count Badge, and a wrapping row of `CachedAvatar` + name. Guarded by milestone match + `contributors.length > 0`.
- **Issue status distribution + effort:** inside the Issues section under the Progress bar. Status Badges (new/in progress/done, zero buckets omitted) render when `releaseIssues.length > 0`; the "Story points: {completed} / {total}" line renders only when `hasStoryPoints`.

## Verification

- `npm run check` (biome check + tsc --noEmit): clean, exit 0, no warnings or errors.
- MR-state, contributor, and status sections render only under their data guards; effort line only when a positive story-point value exists.
- No new React Query added; only the issue `fields=` string changed.
- Milestone-timeline group not added (explicitly out of scope per CONTEXT).

## Deviations from Plan

None — plan executed exactly as written.

Note on verification environment: this worktree had no `node_modules`. The worktree and main-repo `package-lock.json` are byte-identical, so the main repo's `node_modules` was symlinked into the worktree to run the native `npm run check`. The symlink is gitignored and not committed.

## Known Stubs

None. All new sections are wired to live derived data and render nothing when data is absent.

## Self-Check: PASSED
- FOUND: taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
- FOUND commit 4c27ca0f (Task 1)
- FOUND commit e0133d2b (Task 2)

## Post-Completion Follow-Ups (session, approved)

Adjustments made after the validated run, in response to user feedback:

- **Code-review remediation** (`0d0fb2be`): story points now resolve via the
  instance `storyPointsFieldKey` from settings (requests 10016/10028/resolved key)
  instead of a hardcoded `customfield_10016`; issue-status bucketing made NaN-safe
  (WR-01, WR-02 from the code review).
- **Layout revision** (`a0842383`): removed the Contributors section entirely
  (and its derivation + `Users` icon import); moved the issue status distribution
  and story-point effort out of the main Issues section into the metadata sidebar
  as `MetaRow`s alongside the MRs row.
- **Icon trim** (`c5892eeb`): dropped the `GitMerge` icon from the sidebar MRs row.
- **Status colors** (`3e728aae`): aligned issue status badge tones with the app's
  canonical palette (`statusStyles.ts`): new → muted, in progress → blue, done → green.

Final state: left column keeps descriptions, labels, and the issues table; the
sidebar carries status, release date, milestone, MR-state distribution, issue
status distribution, and story points. `npm run check` clean after each change.
