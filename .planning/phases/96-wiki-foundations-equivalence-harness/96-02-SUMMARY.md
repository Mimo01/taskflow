---
phase: 96-wiki-foundations-equivalence-harness
plan: 02
subsystem: wiki
tags: [unified, rehype-stringify, oracle, parity, SAFE-01]
requires: [96-01, 96-03]
provides:
  - wikiToHtml / wikiMarkdownToHtml oracle in lib/wiki/pipeline.ts
affects: [96-04, phase-98 runtime guard]
tech-stack:
  added: [unified, remark-parse, remark-rehype, rehype-stringify]
key-files:
  created: [taskflow/src/lib/wiki/pipeline.test.tsx]
  modified: [taskflow/src/lib/wiki/pipeline.ts, taskflow/package.json, taskflow/package-lock.json]
decisions:
  - "Four unified packages are regular dependencies on main; no tiptap/codemirror on main (D-03)"
requirements-completed: [SAFE-01]
completed: 2026-11-16
---

# Phase 96 Plan 02: wikiToHtml oracle Summary

wikiToHtml/wikiMarkdownToHtml built from the shared remark/rehype plugin lists (sanitize kept, presentation plugins excluded), proven equal to react-markdown's render over the whole corpus.

## Task 1: package legitimacy (resolved by orchestrator)

User replied "approved" for all 12 packages. None has preinstall/install/postinstall scripts.

- rehype-stringify 10.0.1 | github.com/rehypejs/rehype | maint: remcohaszing, wooorm, kmck
- unified 11.0.5 | github.com/unifiedjs/unified | maint: remcohaszing, wooorm
- remark-parse 11.0.0 | github.com/remarkjs/remark | maint: johno, wooorm
- remark-rehype 11.1.2 | github.com/remarkjs/remark-rehype | maint: johno, wooorm, remcohaszing
- @tiptap/react, core, pm, starter-kit, extension-table 3.34.0 | github.com/ueberdosis/tiptap | maint: arnaugomeztiptap, patrickbaber, timoisik, _bdbch
- codemirror 6.0.2 | github.com/codemirror/basic-setup | maint: marijn
- @codemirror/view 6.43.15, @codemirror/state 6.7.6 | code.haverbeke.berlin/codemirror/* (self-hosted forge, GitHub mirror) | maint: marijn

Decision: all 12 approved. Main gets the 4 unified packages only; tiptap/codemirror are spike-branch only.

## Commits

- 82f6fd06: build(96-02) declare unified pipeline deps and add rehype-stringify (npm ls shows a single deduped unified 11.0.5)
- d7d8a24f: feat(96-02) add wikiToHtml oracle with react-markdown parity test

## Deviations from Plan

**1. [Rule 1 - Test artifact] React 19 image preload hints**
- Found during: Task 3
- Issue: `renderToStaticMarkup` hoists `<link rel="preload" as="image">` for each `<img>`, so `attachments/image.wiki` failed parity. Not a pipeline difference.
- Fix: strip those link tags from the React-side string in the test's `reactRender`. `PARITY_KNOWN_DIVERGENCES` stays empty; no fixture diverges due to defaultUrlTransform.
- Files: taskflow/src/lib/wiki/pipeline.test.tsx

Also: the worktree base was behind 846b4f2e and was reset to it per the branch check. Biome organizeImports/format applied to the two touched files only.

## Known limitations

Parity is asserted on jsdom-innerHTML-normalised strings. The round-trip through a div canonicalises serialisation (void-tag forms like `<br>` vs `<br/>`, entity spelling, attribute quoting and order), so byte-level differences between rehype-stringify and renderToStaticMarkup are masked and not covered. Plan 04 consumers compare DOM-equivalent output, not raw strings. Also, the preload-link stripping above is a test-side normalisation.

## Known Stubs

None.

## Verification

Full vitest suite green via pre-commit hook (5359 passed); tsc and biome check on src/lib/wiki clean; WikiRenderer.test.tsx unmodified.

## Self-Check: PASSED
