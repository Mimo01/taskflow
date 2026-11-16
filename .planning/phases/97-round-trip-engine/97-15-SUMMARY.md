---
phase: 97-round-trip-engine
plan: 15
subsystem: wiki-renderer
tags: [jira-escapes, preprocess, SAFE-06, gap-closure]
requires: []
provides:
  - JIRA_ESCAPE_CHARS constant and backslash-escape neutraliser in preprocessJiraMarkup
  - inline-code entity decoder covering every neutraliser entity
affects: [97-17]
key-files:
  modified:
    - taskflow/src/lib/wiki/preprocess.ts
    - taskflow/src/lib/wiki/pipeline.ts
    - taskflow/src/lib/wiki/pipeline.test.tsx
requirements-completed: [SAFE-06]
completed: 2026-11-16
---

# Phase 97 Plan 15: Jira backslash escapes render literally Summary

Jira backslash escapes (`\*`, `\_`, `\^`, `\~`, `\{`, `\[`, `\!` and the rest of `*_-+^~?{}[]|!#`) are turned into numeric entities before jira2md runs, so they render as the typed character in prose and in inline code.

## What changed
- preprocess.ts: exported `JIRA_ESCAPE_CHARS`; one neutraliser step after the `& < >` escape replaces `\X` with `&#code;` and leaves `\\` (hard break) alone. The old `\+` step was removed (covered by the general rule). The `{code}`/`{noformat}` opener now has a lookbehind so an opener after an odd backslash run is not an opener.
- pipeline.ts: `rehypeDecodeInlineCodeEntities` decodes all neutraliser entities via a regex derived from `JIRA_ESCAPE_CHARS`; `&amp;` still decoded last, `<pre>` still skipped.
- pipeline.test.tsx: 14 generated `escape \X renders literally` cases plus mention/color/image, code-opener, hard-break/code-body, table-pipe, plus-literal, and inline-code decoder cases.

## RED evidence (before the fix)
9 failures out of 25 in `-t "CR-02"`:
- `escape \*`: expected 'a <strong>b</strong> c' to be 'a *b* c'
- `escape \_`: 'a <em>b</em> c'; `escape \^`: 'a <sup>b</sup> c'; `escape \~`: 'a <sub>b</sub> c'
- `escape \!`: 'a ![](b) c'
- mention: 'ping <mention data-id="admin">admin n...'
- code opener: expected 'a ```\nx\\n' to be 'a {code}x{code} b'
- real code block after escaped opener: expected '' to contain 'real'
- table pipe: `<td></td>` instead of `a|b`
Task 2 RED: after the neutraliser alone, WikiRenderer wiki-mono-underscore failed with 'HW&#95;SALE&#95;FIX' to be 'HW_SALE_FIX'.

## Changed expectations
None.

## Deviations from Plan
- Tasks 1 and 2 are in one commit (6ca6dbf). Task 1 alone breaks the existing wiki-mono-underscore test, and the pre-commit hook runs the full suite, so the decoder had to land with the neutraliser.
- The worktree had no node_modules; symlinked the main checkout's (untracked, not committed). Worktree base was reset to 17eb5f9a per the branch check.
- One full-suite pre-commit run failed with 2 unrelated tests (flaky); the rerun passed 5713/5713.

## Verification
- `npx vitest run src/lib/wiki src/routes/dashboard/WikiRenderer.test.tsx`: 587 passed
- `npx tsc --noEmit` clean; biome check on the 3 touched files clean; full suite passed in the commit hook.

## Commits
- 6ca6dbf: fix(97-15): render Jira backslash escapes literally

## Self-Check: PASSED
