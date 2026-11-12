---
phase: quick-261112-spn
verified: 2026-11-12T21:10:00Z
status: human_needed
score: 7/7 must-haves verified (automated)
human_verification:
  - test: "Open Update available modal, What's new modal and Settings -> Updates in the running app (dark and light, narrow and wide)"
    expected: "Compact card, small-caps groups, one-line expandable bullets, roll-up rows, Installed badge, chips and search all look right with no layout shift"
    why_human: "Visual design and interaction feel cannot be verified by grep or jsdom"
  - test: "Check the live GitHub rate-limit and pagination behaviour against the real releases repo"
    expected: "All releases load grouped by minor, with a graceful fallback offline"
    why_human: "Needs network and the real API"
---

# Quick 261112-spn Verification

**Goal:** Redesign update display, 100% backwards compatible: concise notes (script plus docs), redesigned modals, Settings history with load-all and roll-up.
**Status:** human_needed (all automated checks pass; visual design is left to human review)

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All historical variants render (parser, raw fallback, empty state) | VERIFIED | parse.ts and the fixtures exist; parse tests pass (17 files, 166 tests green across the touched areas) |
| 2 | Old clients render new notes (legacy-render test, CI untouched, raw string persisted) | VERIFIED | legacy-render.test.tsx passes. The diff of CHANGELOG.md and .github between 6ae128d2 and HEAD is empty. UpdateDialog.tsx line 92 still calls persistChangelogBeforeRestart(changelog) |
| 3 | The approved example lints with zero errors | VERIFIED | I ran the CLI on the verbatim example and it exited 0 |
| 4 | Scripts reject wordy notes before writing, with an override flag; --skip-bump only warns | VERIFIED | `printf x \| bump-version.mjs 9.9.9` exited 1, said "No files were changed", and git status for package.json, CHANGELOG.md and tauri.conf.json was clean. release.sh lints in pre-flight (line 76), uses `--warn-only` for skip-bump (line 83), forwards `--allow-wordy-notes` (line 109), and passes `bash -n`. The CLI exits 1 on bad input, and exits 0 with `--warn-only` |
| 5 | Update modal: new header and roll-up, no Stop Download, progress replaces the footer | VERIFIED (code) | UpdateDialog.tsx uses ReleaseNotesBody and the gated useReleaseHistory/selectRollup (`-dev` guard). grep for "Stop" finds nothing. Its tests pass |
| 6 | What's new modal: header, from-version, roll-up, See all updates deep link | VERIFIED (code) | WhatsNewDialog.tsx navigates to `/settings?section=updates` and uses selectRollup and ReleaseNotesBody |
| 7 | Settings history loads all releases, groups by minor, has search and chips, highlights the installed version | VERIFIED (code) | UpdatesSection.tsx uses useReleaseHistory, with aria-expanded groups, aria-pressed chips and the Installed badge. releases.ts follows rel="next" and drops drafts and prereleases. Settings.tsx uses useSearchParams |

## Checks run

- vitest on release-notes, services/releases, components/update and routes/settings: 17 files, 166 tests passed.
- `tsc --noEmit`: clean.
- `biome check` on the touched paths: clean.
- No TBD/FIXME/XXX markers in the phase files. No new stubs found.

## Gaps

None. The full vitest suite was not re-run; the SUMMARY reports 5198 passing, and that figure is unverified.

## Human verification

1. Visual design of both modals and the Settings history (see the frontmatter).
2. Live GitHub pagination and offline fallback.
