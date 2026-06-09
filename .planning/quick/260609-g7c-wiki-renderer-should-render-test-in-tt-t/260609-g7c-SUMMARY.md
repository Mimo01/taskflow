---
phase: quick-260609-g7c
plan: "01"
subsystem: wiki-renderer
tags: [wiki, jira-markup, teletype, tt, preprocessJiraMarkup, tdd]
dependency_graph:
  requires: []
  provides: [triple-brace-teletype-rendering]
  affects: [WikiRenderer.tsx, WikiRenderer.test.tsx]
tech_stack:
  added: []
  patterns: [regex-preprocess-before-jira2md]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
decisions:
  - "Replace {{{...}}} before {{[link]}} guard so triple-brace containing a URL is consumed whole"
  - "Use /gs flag to allow multi-line content, consistent with {*} and {_} patterns"
  - "Emit raw <tt>$1</tt> HTML; tt is already in defaultSchema.tagNames — no schema change needed"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-09"
  tasks: 1
  files: 2
---

# Phase quick-260609-g7c Plan 01: Wiki triple-brace {{{...}}} → <tt> Summary

**One-liner:** Single regex in `preprocessJiraMarkup` converts Jira `{{{TEXT}}}` triple-brace teletype macro to `<tt>TEXT</tt>` before jira2md, preventing partial double-brace match that left stray `{` and `}` in output.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Add failing tt tests to WikiRenderer.test.tsx | 642eb1bc | WikiRenderer.test.tsx |
| GREEN | Add {{{...}}} → <tt> regex in preprocessJiraMarkup | 62e5728b | WikiRenderer.tsx |

## Implementation Details

**Root cause:** jira2md's `{{...}}` double-brace monospace regex partially matches `{{{TEXT}}}` — it sees `{{TEXT}}` as the inner span and ignores the outer braces, leaving a leading `{` and trailing `}` as literal characters in the rendered output.

**Fix:** In `preprocessJiraMarkup` (WikiRenderer.tsx), inserted after the `{_}text{_}` italic replacement and before the `{{[link]}}` guard:

```ts
result = result.replace(/\{\{\{(.*?)\}\}\}/gs, '<tt>$1</tt>');
```

The regex runs before jira2md so it consumes the full triple-brace span. The `s` flag allows newlines in content. `<tt>` is already in `rehype-sanitize`'s `defaultSchema.tagNames` so no schema change was needed.

## Tests

3 new tests added in the `ISSUE-02: wiki markup rendering` describe block:
- **Test A:** `{{{TEST}}}` → `<tt>` element with textContent `"TEST"` (RED: fail → GREEN: pass)
- **Test B:** `{{someCode}}` → `<code>` element (regression guard, passed throughout)
- **Test C:** `{{{hello world}}}` → `<tt>` with textContent `"hello world"` (RED: fail → GREEN: pass)

Final result: **144/144 tests pass** (142 existing + 2 new tt tests + 1 regression guard that passed in RED).

## TDD Gate Compliance

- RED gate: commit `642eb1bc` — `test(quick-260609-g7c-01)`: 2 failing tests confirmed
- GREEN gate: commit `62e5728b` — `feat(quick-260609-g7c-01)`: all 144 tests passing

## Verification

- WikiRenderer tests: **144/144 PASS**
- `npm run check`: 4 pre-existing errors in unrelated files (gitlab.ts, CommandPalette.tsx, main.tsx, BacklogPage.tsx); WikiRenderer files are **CLEAN**

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — the regex uses non-greedy `(.*?)` and content passes through rehype-sanitize (defaultSchema strips script/style/event-handlers) before rendering. No new network endpoints or trust boundaries introduced.

## Self-Check: PASSED

- WikiRenderer.tsx modified: FOUND
- WikiRenderer.test.tsx modified: FOUND
- RED commit 642eb1bc: FOUND
- GREEN commit 62e5728b: FOUND
