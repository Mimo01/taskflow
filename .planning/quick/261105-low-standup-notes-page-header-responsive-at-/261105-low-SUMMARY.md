# Quick 261105-low: Standup header responsive, shared PageHeader

Shared `PageHeader` primitive (`components/ui/page-header.tsx`) with container-query compaction stages; Standup header rewritten on it and six more pages migrated.

## Commits
- Task 1: feat PageHeader + Standup header (1e1d1d32)
- Task 2: refactor Releases + My Tasks headers
- Task 3: refactor Epics, Worklogs, Test cycles, Backlog headers

## Behaviour
- Stages (measured on the header's own width): `@[52rem]` secondary text, `@[44rem]` action labels, `@[30rem]` picker "Showing:" prefix and wider name cap; below that actions wrap under the title.
- Refresh / Copy markdown keep aria-label and title when icon-only; Refresh title carries "synced Nm ago".
- Title sizes unchanged (3xl: My Tasks, Standup, Releases; 2xl: others).

## Deviations
- ReleasesHero.test.tsx: the "standard page header bar" test asserted exact old classes (`title.className === 'text-3xl font-semibold'`, `px-6 py-4` on the header). Updated to `toContain` and to check padding on the header's inner row, since PageHeader puts padding there (container queries measure the content box). Production code was not bent.
- Intentional visual changes: My Tasks moves from pt-5/pb-5 + border-border/50 to py-4 + border-border; Backlog moves from px-4 py-3 to px-6 py-4. Scope buttons in My Tasks use a tighter px-2 py-1 text-xs below `@[44rem]`.
- Releases: summary `<p>` no longer wraps (whitespace-nowrap, truncated by the subtitle wrapper); subtitle only passed when summary or loading.
- Worktree base was reset to 34c962e7 as instructed; node_modules symlinked.
- Not run: visual resize check (no browser run).

## Excluded (structurally different)
- MergeRequestListPage: title then a second row of tabs and filters (space-y-3).
- SprintBoardHeader: bespoke flex-col banner (role="banner"), max-w-[60%] sprint name, px-4 py-3; tests depend on the role.
- Settings: no header by convention.

## Self-Check: PASSED
Full vitest suite, biome (touched files) and tsc green on each commit.
