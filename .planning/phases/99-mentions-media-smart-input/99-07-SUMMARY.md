---
phase: 99-mentions-media-smart-input
plan: 07
subsystem: wiki-editor
tags: [tiptap, decoration, suggestion, issue-key]
requires: ["99-01", "99-03"]
provides:
  - "lib/issue-key.ts shared regex, isKnownPrefix, link class"
  - "WikiIssueKeyDecoration (decorations only) and WikiIssueKeySuggestion (ABC- trigger)"
affects: [WikiRenderer, wiki-editor]
key-files:
  created:
    - taskflow/src/lib/issue-key.ts
    - taskflow/src/lib/issue-key.test.ts
    - taskflow/src/components/wiki-editor/issue-key-decoration.ts
    - taskflow/src/components/wiki-editor/suggestion/key-suggestion.ts
    - taskflow/src/components/wiki-editor/issue-key.test.ts
  modified:
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
key-decisions:
  - "Known prefixes = active project, host projectKey, prefix of host issueKey; checked in `allow` because the custom findSuggestionMatch cannot read plugin state"
  - "command dispatches closeHistory before insertContentAt so one undo restores the typed prefix"
requirements-completed: [INPUT-05]
completed: 2026-11-17
---

# Phase 99 Plan 07: Issue-key decoration and suggestion Summary

Issue keys with a known prefix are decorated in the editor with the WikiRenderer link look (no markup written), and typing `ABC-` opens a server-side issue search that inserts the plain key. WikiRenderer and the editor now share `lib/issue-key.ts`.

## Tasks

1. Extract `lib/issue-key.ts`, WikiRenderer imports it (all routes/dashboard tests unchanged and green): commit in git log "refactor(99-07)".
2. Decoration plugin, key suggestion and 9 tests: commit "feat(99-07)".

## Deviations from Plan

**1. [Rule 3 - Blocking] Suggestion tests use a real EditorContent harness**
- Headless `makeEditor` never renders the popover content (ReactRenderer needs an EditorContent), so suggestion tests render via `useEditor`/`EditorContent` using `createElement` (file stays `.ts`). Decoration tests stay headless.

**2. [Rule 1 - Bug] Undo grouping**
- Without `closeHistory`, typing and selection merged into one undo step (undo removed the whole text). Added a `closeHistory` dispatch before the insert.

**3. Pre-commit full suite flaked under load** (unrelated route tests); recommitted without `--no-verify`.

## Known Stubs
None.

## Threat Flags
None. Token is read inside queryFn only and is absent from the query key (tested); `data-issue-key` is set only from EXACT_RE-validated text.

## Self-Check: PASSED
All created files exist; both commits present; acceptance greps (no addMark/setMark/tr.insert, no buildSearchIndex) empty; tsc clean.
