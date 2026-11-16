---
phase: 97-round-trip-engine
plan: 08
subsystem: wiki-editor-engine
tags: [wiki, prosemirror, marks, links, escaping, round-trip]
requires: ["97-07"]
provides:
  - "parse/marks.ts: renderer-mirroring mark matcher (bold, italic, strike, underline, sup, sub, mono, brace forms, teletype) recording delimiter spelling"
  - "bracket links [label|url] / [url] as link marks (form named|bare)"
  - "emit: mark runs with recorded or canonical delimiters (D-08)"
  - "escape.ts: escapeText / escapeSites for typed text; emit escapes only when a re-parse would not read back the same characters"
affects: [97-09, 98]
key-files:
  created:
    - taskflow/src/lib/wiki/editor/parse/marks.ts
    - taskflow/src/lib/wiki/editor/escape.ts
    - taskflow/src/lib/wiki/editor/marks.test.ts
    - taskflow/src/lib/wiki/editor/escape.test.ts
  modified:
    - taskflow/src/lib/wiki/editor/parse/inline.ts
    - taskflow/src/lib/wiki/editor/emit.ts
    - taskflow/src/lib/wiki/editor/schema.ts
    - taskflow/src/lib/wiki/editor/roundtrip.test.ts
    - taskflow/src/lib/wiki/editor/tables.test.ts
key-decisions:
  - "Marks carry a `span` attr (parse order, outer first) so equal-extent nesting and adjacent equal spans re-emit byte-exactly"
  - "Mark rules mirror the renderer exactly, so `a*b*c` is bold (renderer bolds it), `??cite??` is not modelled (renderer does not render it), `-a-` needs 2+ chars"
  - "Escaping is decided by re-parsing the plain emission in its block context; a character class is escaped only if leaving it unescaped breaks the read-back"
requirements-completed: [SAFE-06, SAFE-03]
duration: ~25min
completed: 2026-11-16
---

# Phase 97 Plan 08: Marks, Links and Escaping Summary

Formatting marks and bracket links keep their exact delimiter spelling, and typed text that contains markup characters is escaped minimally while parsed text is never rewritten.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Formatting marks and links with recorded delimiters | see git log (feat(97-08): model formatting marks...) |
| 2 | Table-driven escaping for typed text | see git log (feat(97-08): table-driven escaping...) |

## Deviations from Plan

**1. [Adaptation] `span` mark attribute (schema.ts).** Mark order is not preserved by ProseMirror, and adjacent equal spans (`{{a}}{{b}}`) merge into one text node. A parse-order `span` number on bold/italic/strike/underline/sup/sub/cite/mono keeps both exact (the lossless fuzz needed it). User-created marks have `span` null and nest by span length then a fixed rank.

**2. [Adaptation] `cite` is not modelled.** The renderer does not render `??x??` (verified with `wikiToHtml`), so per the plan's own rule it stays plain text. `CANONICAL_DELIMS` still lists `??` for user-created cite marks.

**3. [Adaptation] Plan boundary case `a*b*c`.** The renderer bolds it, so it is bold in the editor. The no-mark assertions use `2 * 3 * 4`, `a_b_c`, `a + b + c`, `-a- b` and `??cite??`, each checked against `wikiToHtml`.

**4. [Adaptation] Escape decision by re-parse, not by tokenizer rules alone.** `escapeText(text, ctx)` is a context-gated site table; `emit.ts` escapes only when parsing the plain emission in its block context (paragraph, heading, list item, quote, table cell) would not show the same characters, then drops each character class that is not needed. This guarantees parsed text is unchanged. If even full escaping cannot fix it, the text is emitted as typed.

**5. Link labels are plain text.** The renderer shows marks inside `[*b*|url]`, the editor shows the characters (emit is still byte-identical). Modelling marks inside labels is a later refinement.

**6. Test conventions.** New tests run under jsdom (no node directive); RED and GREEN combined per commit because of the pre-commit suite. `tables.test.ts` `cellText` helper now reads the link mark `src`.

## UNSPELLABLE (Open Question 3 follow-up)

Typed sequences with no Jira spelling that shows the same characters, excluded from the property generators (named `UNSPELLABLE` in `escape.test.ts`):
- A typed backslash directly before an escapable character or another backslash (it fuses into `\*`-style escapes or the `\\` line break).
- `h1.`-style heading and `bq.` prefixes at a line start (no escape spelling).
- In a table cell, a trailing backslash (fuses with the closing `|` into an escaped pipe).

For these, emit leaves the text as typed (never throws). Phase 98 should prevent or warn.

## Known Limitations

- Marks inside link labels are not modelled (see 5).
- Adjacent or nested spans created by the user (no `span`) nest by span length then rank, so `_*x*_` typed by a user emits `*_x_*`; parsed spans replay exactly.

## Known Stubs

None.

## Threat Flags

None. T-97-24 mitigated by the 3000-case property tests; T-97-26 by next-occurrence lookups and a 50k-opener-per-delimiter timing test; T-97-25 accepted (href stored as typed).

## Verification

Full vitest suite, tsc and biome green in the pre-commit hook on both commits.

## Self-Check: PASSED
