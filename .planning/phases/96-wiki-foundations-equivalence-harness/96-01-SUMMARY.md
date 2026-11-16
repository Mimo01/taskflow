---
phase: 96-wiki-foundations-equivalence-harness
plan: 01
subsystem: wiki
tags: [refactor, wiki, pipeline, safe-01]
requires: []
provides:
  - "taskflow/src/lib/wiki/ (preprocess, pipeline, index barrel) importable without React"
affects: [96-02, phase-97]
tech-stack:
  added: []
  patterns: ["core pipeline vs presentation split; plugin builder with fixed raw-first / sanitize-last order"]
key-files:
  created:
    - taskflow/src/lib/wiki/preprocess.ts
    - taskflow/src/lib/wiki/pipeline.ts
    - taskflow/src/lib/wiki/index.ts
  modified:
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
decisions:
  - "rehypeIssueKeys stays in WikiRenderer.tsx and is spliced in via wikiRehypePlugins([...])"
metrics:
  completed: 2026-11-16
  tasks: 2
  files: 4
requirements: [SAFE-01]
---

# Phase 96 Plan 01: Wiki pipeline extraction Summary

Pure relocation of WikiRenderer's preprocess, jira2md conversion and shared remark/rehype plugin list into `src/lib/wiki/`, with no behaviour change.

## Commits
- 8513149f: refactor(96-01): move wiki preprocess into lib/wiki (preprocess.ts, L100-L1169 byte-verbatim)
- 50f46253: refactor(96-01): move core wiki plugin pipeline into lib/wiki (pipeline.ts: schema, fixMarkdownLinkUnderscores, decode plugin verbatim; new wikiToMarkdown, wikiRemarkPlugins, wikiRehypePlugins)

## Verification
- Moved ranges verified byte-identical against c921736c.
- WikiRenderer.test.tsx unmodified, 184 tests pass; full suite 5310 pass; tsc and biome clean.
- wikiRehypePlugins returns `[rehypeRaw, ...presentation, decode, [rehypeSanitize, wikiSanitizeSchema]]` (T-96-01).
- lib/wiki has no React/Tauri/store imports.

## Deviations from Plan
- [Rule 3 - Blocking] Worktree branch started at 1cc3524b; reset to the required base 62064e5f per the base check. Symlinked the main checkout's node_modules into taskflow/ (gitignored).
- Literal acceptance greps counted comment mentions: WikiRenderer.tsx still has 2 comment hits (`rehype-sanitize`, `wikiSanitizeSchema` in the pre-existing rehypeIssueKeys JSDoc) and pipeline.ts has 1 (`rehypeIssueKeys` in the verbatim-moved schema comment). No code references remain, so the intent (no core/presentation leakage) holds; verbatim ranges were not edited.

## Known Stubs
None.

## Self-Check: PASSED
