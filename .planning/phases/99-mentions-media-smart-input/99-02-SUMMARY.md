---
phase: 99-mentions-media-smart-input
plan: 02
subsystem: wiki-editor
tags: [paste, html-normalise, jira, word, google-docs, security]
requires: []
provides:
  - normalisePastedHtml(html, ctx) => { html, images }
  - looksLikeWiki(text)
affects: [99-10 paste plugin wiring]
tech-stack:
  added: []
  patterns: [DOMParser inert parse + allowlist rebuild into new document]
key-files:
  created:
    - taskflow/src/components/wiki-editor/paste/html-normalise.ts
    - taskflow/src/components/wiki-editor/paste/word-html.ts
    - taskflow/src/components/wiki-editor/paste/jira-html.ts
    - taskflow/src/components/wiki-editor/paste/wiki-text.ts
    - taskflow/src/components/wiki-editor/paste/html-normalise.test.ts
    - taskflow/src/components/wiki-editor/paste/wiki-text.test.ts
    - taskflow/src/components/wiki-editor/__fixtures__/paste/ (5 placeholder fixtures)
key-decisions:
  - "#172b4d (palette Dark grey, the Atlassian default text colour) is dropped with black/white as a body default"
  - "noformat paste emits <pre open close> so the CodeBlock keeps {noformat} delimiters"
requirements-completed: [INPUT-04]
duration: ~20min
completed: 2026-11-17
---

# Phase 99 Plan 02: Paste normaliser and wiki-text heuristic Summary

Pure paste layer: an allowlist HTML normaliser (web, Word, Google Docs, Jira rendered HTML) that emits the exact parse tags the editor schema accepts, plus the looksLikeWiki heuristic. No extensions.ts change was needed.

## Commits
- 85f4501e: `feat(99-02): allowlist HTML paste normaliser with Word/Docs/Jira rewrites` (Task 1)
- 0ad600bc: `feat(99-02): looksLikeWiki paste heuristic` (Task 2)

(RED and GREEN were combined per task because the pre-commit hook runs the full suite.)

## Verification
- `npx vitest run src/components/wiki-editor/paste`: 41 tests pass; every fixture saves with kind 'saved'.
- biome check and tsc clean for the new files.

## Deviations from Plan

**1. [Rule 3 - Blocking] `__parseFromClipboard` has no type declaration**
- tsc rejected the named import; the test casts the module namespace to a typed shape. Runtime unchanged.

**2. Acceptance grep nuance:** the `toBe('saved')` assertion lives in one shared `savedText` helper that every fixture test calls, so the literal grep count is lower than 5 while every fixture is still asserted.

**3. #172b4d dropped as a default colour** (see key-decisions); plan only named black/white/default body colours.

## Known Stubs
None. Fixture `jira-rendered.html` is synthetic until UAT capture replaces it (noted in the file).

## Threat Flags
None. Mitigations T-99-04..09 implemented: inert DOMParser, no attribute copying, safe hrefs, restricted mention id / emoticon / issue key, no fetching, 200000-char cap, placeholder-only fixtures.

## Self-Check: PASSED
