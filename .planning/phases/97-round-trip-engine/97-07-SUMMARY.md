---
phase: 97-round-trip-engine
plan: 07
subsystem: wiki-editor-engine
tags: [wiki, prosemirror, inline-atoms, round-trip, spelling]
requires: ["97-06"]
provides:
  - "JIRA_EMOTICON_TOKENS: single token list next to JIRA_EMOTICON_MAP, tested to agree"
  - "parseInline atoms: emoticon, mention, escape, hardBreak (\\\\), image, attachment, rawInline"
  - "emitter replay of atom src; canonical forms for user-created mention/image/attachment"
affects: [97-08, 97-09]
key-files:
  created:
    - taskflow/src/lib/wiki/editor/spelling.test.ts
  modified:
    - taskflow/src/lib/wiki/preprocess.ts
    - taskflow/src/lib/wiki/editor/parse/inline.ts
    - taskflow/src/lib/wiki/editor/emit.ts
    - taskflow/src/lib/wiki/editor/roundtrip.test.ts
    - taskflow/src/lib/wiki/editor/tables.test.ts
key-decisions:
  - "Every inline atom stores its exact source token; emit replays it, never decodes spelling (SAFE-06)"
  - "Unknown inline macros (not in KNOWN_MACROS) are rawInline; known macros mid-line stay text for Plan 08"
  - "Opener bodies exclude the opening bracket so the per-line scan stays linear"
requirements-completed: [SAFE-06, SAFE-04]
duration: ~20min
completed: 2026-11-16
---

# Phase 97 Plan 07: Inline Atoms Summary

Emoticons, mentions, escapes, `\\` breaks, images, attachments and unknown inline macros are atoms that replay their exact source token, so `(/)` can no longer become an emoji.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1+2 | Inline atoms (single commit, see deviations) | a9759a43 |

## Deviations from Plan

**1. [Adaptation] One commit for both tasks.** The pre-commit hook runs the full suite and both tasks share inline.ts, emit.ts and the registry.

**2. [Adaptation] tables.test.ts `cellText` helper** now reads escape atom `src`, since `a\|b` in a cell is an escape atom (emit unchanged, byte-identical).

**3. Registry:** `macros/inline-status.wiki` added to RAW_ALLOWED; `unknown-macro.wiki` reason notes its inline `{status}` too.

## Known Stubs
None.

## Threat Flags
None. T-97-21..23 mitigated: image name/params stored as raw strings, rawInline emitted verbatim, scan is linear (a 300k-opener line parses well under 2 s, tested). Full suite, tsc and biome green in the pre-commit hook.

## Self-Check: PASSED
