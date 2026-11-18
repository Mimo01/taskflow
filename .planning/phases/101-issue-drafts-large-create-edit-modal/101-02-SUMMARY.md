---
phase: 101-issue-drafts-large-create-edit-modal
plan: 02
subsystem: draft-attachment-storage
tags: [tauri, plugin-fs, drafts, wiki-editor]
requires: []
provides:
  - "lib/issue-draft-files.ts: stageDraftFile, readDraftFile, removeDraftFiles, purgeAllDraftFiles, purgeOrphanDraftFiles, safeDraftFileName"
  - "WikiEditorHandle.setLocalPreview"
  - "fs plugin scoped to $APPDATA/issue-drafts/**"
affects: [draft plans 06, 09, 12]
tech-stack:
  added: ["@tauri-apps/plugin-fs 2.7.1", "tauri-plugin-fs 2"]
key-files:
  created:
    - taskflow/src/lib/issue-draft-files.ts
    - taskflow/src/lib/issue-draft-files.test.ts
  modified:
    - taskflow/package.json
    - taskflow/package-lock.json
    - taskflow/src-tauri/Cargo.toml
    - taskflow/src-tauri/Cargo.lock
    - taskflow/src-tauri/src/lib.rs
    - taskflow/src-tauri/capabilities/default.json
    - taskflow/src/test/setup.ts
    - taskflow/src/test/wiki-editor-stub.tsx
    - taskflow/src/components/wiki-editor/types.ts
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
requirements-completed: [DRAFT-05]
duration: ~20 min
completed: 2026-11-18
---

# Phase 101 Plan 02: Draft file storage Summary

Tauri fs plugin registered and scoped to the drafts subtree, with a mockable service that stores staged-file copies under `$APPDATA/issue-drafts/<draftId>/` and rebuilds `File`s, plus `WikiEditorHandle.setLocalPreview`.

## Task outcomes

1. Legitimacy gate (checkpoint:human-verify): approved by the user on 2026-11-18. Evidence: npm `@tauri-apps/plugin-fs` 2.7.1 from github.com/tauri-apps/plugins-workspace, Tauri core maintainers, no install scripts; crates.io `tauri-plugin-fs` 2.7.1 same repo. No commit.
2. Plugin install/registration: commit 27e551c8. Permissions `fs:allow-{mkdir,write-file,read-file,remove,exists,read-dir}` each scoped to `$APPDATA/issue-drafts` and `/**`; no `fs:default`. `cargo check` passed.
3. Service + handle (TDD, single commit): commit c81455aa. 8 tests cover sanitising, round trip, bad draft id, missing copy to null, per-draft remove, purge all, orphan purge, readDir failure swallowed.

## Deviations from Plan

- npm install was done with `--package-lock-only` in the worktree (node_modules is a symlink to the main checkout), and the package was installed `--no-save` into the main checkout's node_modules for tsc. The orchestrator should run a real `npm install` after merge.
- The service test file asserts behaviour through the in-memory plugin-fs mock rather than spying on mkdir/writeFile call arguments, since the global mock uses plain functions. The draftId rejection test checks nothing was written.
- Pre-existing flaky tests (EpicDetailSheet, IssueDetailParts, WorklogsPage) failed intermittently in the pre-commit full-suite run; they pass in isolation and the commit succeeded on retry. Not caused by this plan.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-101-04/05/06 mitigated as planned).

## Self-Check: PASSED
- Files exist, commits 27e551c8 and c81455aa present, tsc and full vitest green on commit.
