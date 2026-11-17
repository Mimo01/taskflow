---
phase: 98-editor-shell
plan: 02
subsystem: wiki-renderer
tags: [wiki, jira-markup, escaping, WR-01]
requires: []
provides:
  - "Bare URLs containing escaped underscores render as working links with the typed href"
affects: [taskflow/src/lib/wiki/preprocess.ts]
key-files:
  modified:
    - taskflow/src/lib/wiki/preprocess.ts
    - taskflow/src/lib/wiki/editor/typed-render.test.ts
    - .planning/phases/97-round-trip-engine/97-HUMAN-UAT.md
    - .planning/todos/done/wiki-roundtrip-phase97-followups.md
decisions:
  - "Renderer-side fix: UAT showed Jira drops backslashes in a bare-URL href, so the renderer must too; the emitter is unchanged"
requirements: [EDIT-06]
completed: 2026-11-17
---

# Phase 98 Plan 02: WR-01 bare-URL underscore fix Summary

Renderer now treats `\_` inside a bare http(s) URL as a literal underscore, matching Jira, so `http://a.com/_a_` typed in the editor saves and renders as a link to exactly that href.

## What was done

- Task 1 (checkpoint, pre-answered): user reported "drops backslashes". Recorded in 97-HUMAN-UAT.md test 1 as passed with note; summary counts now passed 1 / pending 1.
- Task 2: took the RENDERER branch. In `preprocess.ts`, before the escape neutraliser, any http(s) token containing `\_` is wrapped in a markdown autolink `<url>` with `\_` replaced by the existing USCORE sentinel (restored by `fixMarkdownLinkUnderscores`). The wrap is needed because GFM bare-autolink drops a trailing `_` (first attempt gave href `http://a.com/_a`). Trailing sentence punctuation stays outside the link. Only `_` is handled; other escapes in URLs are unchanged. `\_b\_` outside URLs stays literal text.
- Tests (typed-render.test.ts): save+render yields href `http://a.com/_a_` with `_b_` not italic; saved text reloads as `rich`; trailing `.` stays outside the link. Before the fix the href was `http://a.com/&#x26;#95;a&#x26;#95`.
- Folded todo set `status: done` with `resolved:` and moved to `.planning/todos/done/`.

## Deviations

- Tasks 1 recording and Task 2 were committed together in one commit: the pre-commit hook runs the full suite and the machine load (about 100+) made unrelated tests (FindBar, EpicDetailSheet, WorklogsPage, etc.) time out on several earlier attempts. No hook bypass was used.
- `escape.ts`/`emit.ts` were not touched (emitter branch not chosen); `pipeline.test.tsx` not changed (tests live in typed-render.test.ts, which already has the save+render helper).

## Verification

`npx vitest run src/lib/wiki` passed (22 files, 434 tests).

## Self-Check: PASSED

Commit 4adcfd45 exists and contains all listed files.
