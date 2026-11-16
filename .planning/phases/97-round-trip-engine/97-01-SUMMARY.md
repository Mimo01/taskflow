---
phase: 97-round-trip-engine
plan: 01
subsystem: wiki-renderer
tags: [wiki, jira, rehype, preprocess, lists, tables]
requires: []
provides:
  - convertMixedListMarkers (preprocess.ts)
  - rehypeDropHeaderlessThead (pipeline.ts)
affects: [WikiRenderer consumers, round-trip oracle]
key-files:
  modified:
    - taskflow/src/lib/wiki/preprocess.ts
    - taskflow/src/lib/wiki/pipeline.ts
    - taskflow/src/lib/wiki/pipeline.test.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
decisions:
  - "Mixed *#/#* markers become \\x00LI sentinels, restored to indented markdown markers after jira2md"
  - "Header-less marker is a data-wiki-headerless span, dropped with its thead after rehypeRaw and before sanitize"
requirements: [SAFE-03]
metrics:
  completed: 2026-11-16
  tasks: 2
  files: 4
---

# Phase 97 Plan 01: Renderer Jira parity (D-01, D-02) Summary

Mixed `*#`/`#*` list nesting now renders as nested lists, and header-less tables no longer show a synthetic empty header row, so the round-trip oracle matches Jira.

## Commits

- da863026: D-01 mixed list nesting (`convertMixedListMarkers` before `normalizeTableCellInlineFormatting`; `\x00LI` restore in `wikiToMarkdown`)
- 3a4a57e7: D-02 header-less tables (marker in `injectHeaderlessTableSeparators`; `rehypeDropHeaderlessThead` right after `rehypeRaw`)

## Test changes (D-03)

No existing test assertion was changed or removed. All additions are appended: new `D-01`/`D-02` describe blocks in `pipeline.test.tsx` and `WikiRenderer.test.tsx`. The existing headerless-table tests (L984-L1110) passed unchanged because they assert on tbody/links, not on the empty thead.

## Deviations from Plan

**1. [Rule 3 - Blocking] `Array.prototype.at` not available in tsc target**
- `marks.at(-1)` from RESEARCH Pattern 6 fails `tsc` (lib below es2022); replaced with `marks[marks.length - 1]`.

**2. [Rule 3 - Blocking] Worktree had no node_modules**
- Symlinked the main checkout's `taskflow/node_modules` into the worktree (untracked, git-ignored). No packages installed.

**3. Base reset**
- The worktree base differed from the expected commit; reset to 13666a35 per the startup check (tree was clean).

## Verification

- `npx vitest run src/lib/wiki src/routes/dashboard/WikiRenderer.test.tsx`: 277 passed
- `npx tsc --noEmit` clean; biome check clean on the four files
- `wikiSanitizeSchema` not edited (grep of diff for schema keys empty)
- Pre-commit hook (full suite) passed on both commits

## Known Stubs

None.

## Self-Check: PASSED

Commits da863026 and 3a4a57e7 exist; modified files present.
