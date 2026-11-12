---
phase: quick-261112-spn
plan: 01
subsystem: updates / release tooling
tags: [release-notes, updater, settings, lint]
requires: []
provides:
  - parseReleaseNotes / summarizeNotes / lintReleaseNotes (src/lib/release-notes)
  - fetchAllReleases / selectRollup / useReleaseHistory
  - ReleaseNotesBody / ReleaseRollup shared components
affects: [UpdateDialog, WhatsNewDialog, UpdatesSection, Settings, release.sh, bump-version.mjs]
key-files:
  created:
    - taskflow/src/lib/release-notes/parse.ts
    - taskflow/src/lib/release-notes/lint.ts
    - taskflow/src/lib/release-notes/__fixtures__/samples.ts
    - taskflow/scripts/lint-release-notes.mjs
    - taskflow/docs/RELEASE-NOTES.md
    - taskflow/src/services/releases.ts
    - taskflow/src/hooks/useReleaseHistory.ts
    - taskflow/src/components/update/ReleaseNotesBody.tsx
    - taskflow/src/components/update/ReleaseRollup.tsx
  modified:
    - taskflow/scripts/bump-version.mjs
    - taskflow/scripts/release.sh
    - taskflow/src/components/update/UpdateDialog.tsx
    - taskflow/src/components/update/WhatsNewDialog.tsx
    - taskflow/src/routes/settings/UpdatesSection.tsx
    - taskflow/src/routes/settings/Settings.tsx
decisions:
  - "Stop Download removed; downloading shows progress in place of the footer, not dismissable"
  - "Prereleases/drafts/non-semver tags excluded from history and roll-ups"
  - "New notes use ### New / Improved / Fixed; parser also accepts Added/Changed and more"
  - "Lint limits: headline 120, bold title 50, bold detail 70, plain bullet 90, 6 per section, 3 Fixed, 14 total"
metrics:
  tasks: 3
  completed: 2026-11-12
---

# Phase quick-261112-spn Plan 01: Update display redesign and concise changelogs Summary

Short "headline + titles" release notes, enforced by a lint in the release scripts, rendered by one shared parser/body in the redesigned Update available and What's new modals and a Settings history that loads all releases grouped by minor version.

## Commits

- f4f17c43 Task 1: parser, lint, fixtures, script guard, docs
- 0a737fa5 Task 2: releases service/hook, ReleaseNotesBody/Rollup, UpdateDialog, WhatsNewDialog
- 76af80f9 Task 3: Settings history (grouping, search, chips) and ?section= deep link

## What was built

- Parser handles variants V1-V16 (fixtures are hand-written placeholders); the approved example parses to headline plus three sections and lints with zero errors. `legacy-render.test.tsx` proves old clients (ReactMarkdown + remarkGfm) render the new format.
- `bump-version.mjs` lints before any write and exits 1 with the tree untouched (verified with `printf x | bump-version.mjs 9.9.9`); `release.sh` lints in pre-flight, forwards `--allow-wordy-notes`, and only warns for `--skip-bump`. `lint-release-notes.mjs` CLI added. CHANGELOG.md and CI untouched.
- `fetchAllReleases` follows the Link header (cap 10 pages), `selectRollup` is exclusive on both ends; one shared query `['github-releases','all']`.
- UpdateDialog: "Update available", `current → new · date (N releases)`, shared notes body plus skipped-releases roll-up, Later / Update now; raw changelog string still persisted before restart. WhatsNewDialog: check icon, "Updated to X", "from Y", roll-up, "See all updates" (navigates to `/settings?section=updates`) and "Got it".
- Settings → Updates: all releases, collapsible minor groups, Installed badge, search (auto-expands groups, highlights matches), All/New/Improved/Fixed chips, compact EmptyState for error/no match.
- Settings reads `?section=`, including when already mounted; the param is cleared on manual nav.

## Deviations from Plan

None of substance. Notes:

- Worktree base: the HEAD was at d1b94da9, so per the branch check it was reset to 6ae128d2 (the dispatch commit with the plan).
- Settings render sites re-grepped: only `routes.tsx` and `Settings.test.tsx`; the MemoryRouter wrapper was added to the test helper only.
- In the history, the search `highlight` marks matching bullets (background tint, auto-expand when the match is in the detail) instead of wrapping text in `<mark>`.
- Tests use accessible-name regexes `(?!\d)` for release rows because inline children concatenate without spaces in jsdom.

## Known Stubs

None.

## Self-Check: PASSED

All created files exist and the three commits are on the branch; full vitest suite (5198 tests), tsc and biome pass.

## Follow-up iterations (UAT, 2026-11-12)

| Commit | Change |
|--------|--------|
| 740688cd | Code review fixes (release.sh flags/stdin, fetch timeout, rate-limit retry, dedupe, section param, http-only links) |
| ac15c433, d4265500 | Calm release-history list; top Updates controls restored to app-consistent layout (kept Select `items` label fix) |
| 2614532f | CHANGELOG bundled into the app (`lib/release-notes/bundled.ts`); history/roll-up/What's new prefer it over wordy GitHub bodies |
| 45faac2a | Search + type filter removed; one-line note items |
| 3077ace4, 5d0566a5, 7a2d2a4d, bdb07a1d | Opened release as one block on the row grid; section labels with kind icons tinted in the chip-tone palette (badges tried and rejected) |
| deee3338 | Changelog as plain short sentences; lint plainBullet 70, Fixed ≤5 |
| 214ea200 | Opened title outweighs its muted note items |
| 1ec6f92e | Engaging, user-benefit changelog (57 sections, headers/dates unchanged); hairline dividers + bordered card for opened releases; [1.6]→[1.6.0], added [0.1.0] earlier in 7a2d2a4d |

Backwards compatibility unchanged: GitHub release bodies, tags and latest.json untouched; notes stay plain markdown.
