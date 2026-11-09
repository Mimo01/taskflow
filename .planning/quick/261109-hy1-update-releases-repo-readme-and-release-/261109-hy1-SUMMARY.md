---
phase: quick-261109-hy1
plan: 01
subsystem: release-tooling
tags: [release, readme, github-actions]
key-files:
  created:
    - taskflow/scripts/releases-readme.template.md
    - taskflow/scripts/render-releases-readme.sh
  modified:
    - .github/workflows/release-cross-platform.yml
metrics:
  completed: 2026-11-09
---

# Quick 261109-hy1: Releases-repo README template and validated render

Public releases-repo README now comes from a versioned template rendered by a portable bash script that fails the workflow before the PUT if any download link names an asset the release lacks.

## Commits
- 1cfea74a: template + render/validate script
- e0e0cb1e: workflow README step rewrite (asset listing, render with --assets, icon ensure, json.dumps bodies, message `docs: update README for vX`)

## Deviations
- Environment only: the worktree had no `node_modules`, so the husky hook (biome not found) failed; symlinked the main checkout's `taskflow/node_modules` (gitignored, not committed). Hook then ran and passed (4508 tests).
- Task 2 verification used the YAML fallback (no actionlint); the step's `run` body was also extracted and checked with `bash -n`.
- release.sh unchanged (both README mentions already present).

## Not done (by design)
Nothing pushed to the releases repo; no release triggered; the workflow step is untested against the live API.

## Self-Check: PASSED
