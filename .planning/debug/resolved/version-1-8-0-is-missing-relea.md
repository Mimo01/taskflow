---
status: resolved
trigger: version 1.8.0 is missing release notes
created: 2026-05-19
updated: 2026-05-19
---

# Debug Session: version 1.8.0 is missing release notes

## Symptoms

- **Expected:** Release notes visible in app/changelog for v1.8.0
- **Actual:** In-app changelog / release notes screen shows a blank/empty section for v1.8.0; GitHub state unknown
- **Error messages:** No error shown — just a blank/empty section
- **Timeline:** Prior versions (v1.7.x or earlier) had release notes; v1.8.0 does not
- **Reproduction:** Open the in-app changelog / release notes screen — v1.8.0 section is blank

## Current Focus

- hypothesis: "The GitHub release for v1.8.0 was published with an empty body"
- test: "gh release view v1.8.0 --repo Mimo01/taskflow-releases --json body"
- expecting: "body field to be empty"
- next_action: "publish release notes to GitHub release"
- reasoning_checkpoint: "Confirmed: body is empty string. CHANGELOG.md has full v1.8.0 notes."
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-19T00:00:00Z
  finding: "GitHub release v1.8.0 exists (published 2026-05-18T23:53:24Z) but body is empty string"
  source: "gh release view v1.8.0 --repo Mimo01/taskflow-releases"
  implication: "UpdatesSection.tsx renders release.body via ReactMarkdown — empty body = blank section"

- timestamp: 2026-05-19T00:00:00Z
  finding: "CHANGELOG.md has complete v1.8.0 notes under ## [1.8.0] — 2026-05-18"
  source: "taskflow/CHANGELOG.md lines 6-31"
  implication: "Release notes exist locally but were never pushed to the GitHub release"

## Eliminated Hypotheses

- "v1.8.0 release does not exist on GitHub" — eliminated; release exists, just body is empty
- "In-app rendering bug" — eliminated; other releases render fine with the same code path

## Resolution

- root_cause: "The GitHub release for v1.8.0 was published with an empty body. The in-app VersionHistoryList fetches release.body from the GitHub Releases API and renders it as markdown — empty body produces a blank section."
- fix: "Edit the v1.8.0 GitHub release to add the release notes from CHANGELOG.md as the body."
- verification: "After updating, open Settings → Updates in the app and expand v1.8.0 — release notes should render."
- files_changed: []
