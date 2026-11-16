---
phase: 97-round-trip-engine
verified: 2026-11-16T20:50:00Z
status: gaps_found
score: 3/5 roadmap success criteria verified (SC1 and SC3 partial, see gaps)
overrides_applied: 0
re_verification: false
gaps:
  - truth: "SC1: every corpus fixture renders identically through WikiRenderer, including the panel family (D-12 renderer fix)"
    status: failed
    reason: "CR-01 confirmed. The D-12 panel rewrite in preprocess.ts emits blank-line-wrapped block divs for panels that open mid-line, which splits list items and paragraphs. wikiToMarkdown('* item one {note}nested{note} tail\n* item two') now gives '* item one <div data-callout=\"note\">\n\nnested\n\n</div> tail\n* item two'. The list is cut and the rest renders as literal text. This is a regression of existing renderer behaviour caused by this phase."
    artifacts:
      - path: "taskflow/src/lib/wiki/preprocess.ts"
        issue: "lines ~988-1010: block form used even when the opener/closer is not on its own line"
    missing:
      - "Use the block form only when the opener starts a line and the closer ends a line; otherwise keep the inline form (as inTableRow does)"
      - "Add a corpus fixture and renderer test for a panel opened mid-list-item and mid-paragraph"
  - truth: "SC1 / D-02: header-less table marker cannot be forged; renderer output does not change what Jira shows"
    status: failed
    reason: "CR-02 confirmed. Panel title and color values are pasted unescaped into HTML attributes. wikiToMarkdown('||Secret header{info:title=x\" data-wiki-headerless=\"1}a{info}||h2||\n|c|d|') yields a span carrying data-wiki-headerless=\"1\", which rehypeDropHeaderlessThead then uses to delete a real header row. Sanitize still runs, so no script execution, but attacker-controlled attributes reach the tree and the stated invariant (marker cannot be typed) is false."
    artifacts:
      - path: "taskflow/src/lib/wiki/preprocess.ts"
        issue: "lines ~223-234, 995-1009, 1040-1046: data-title / data-color interpolated without attribute escaping"
      - path: "taskflow/src/lib/wiki/pipeline.ts"
        issue: "lines ~183-201: hasHeaderlessMarker searches the whole thead subtree"
    missing:
      - "Attribute-escape every interpolated value (quote and newline)"
      - "Restrict hasHeaderlessMarker to thead > tr > th:first-child > span"
  - truth: "SAFE-06 / 97-08 must-have: typed text containing markup characters is escaped so re-parsing shows the same characters"
    status: failed
    reason: "CR-05 confirmed. emitWiki of a paragraph whose text node is 'ping [~admin] now' emits it unescaped, so it re-parses as a mention (also '!http://..!' images, '[^f]' attachments, '{status:..}' macros, '(x)' emoticons). The 1000-case property test in escape.test.ts treats atom src as equal to typed text, so it cannot detect this."
    artifacts:
      - path: "taskflow/src/lib/wiki/editor/emit.ts"
        issue: "display() (~194-205) renders atoms and text identically, so fits() passes and escaping is skipped"
      - path: "taskflow/src/lib/wiki/editor/escape.test.ts"
        issue: "property oracle too lenient"
    missing:
      - "Make display() distinguish atom nodes from text so a text-vs-atom mismatch triggers escaping; add '(' emoticon handling"
      - "Tighten the property test so typed text may not re-parse as an atom"
  - truth: "SAFE-04: raw atoms are saved verbatim (schema-valid raw atoms inside list items and table cells)"
    status: partial
    reason: "CR-03 confirmed. emitWiki on listItem[paragraph, rawBlock('{status:x}')] returns '* a\n' (raw content lost). Parser does not currently produce this shape, so the unedited path is unaffected, but schema allows it and Phase 98 edits can create it (e.g. paste/move)."
    artifacts:
      - path: "taskflow/src/lib/wiki/editor/emit.ts"
        issue: "lines ~288-296, 339-353: non-paragraph children go through textOf/inlineSegments, rawBlock content dropped"
    missing:
      - "Route non-inline children through the block emitter; always emit rawBlock attrs.raw; throw for constructs wiki cannot express"
  - truth: "Emitter output for user-edited tables does not corrupt the table (D-08 user-created defaults)"
    status: partial
    reason: "CR-04 confirmed. A table whose first cell is empty with no padding emits '||b|' (the row becomes a header separator mix and the parser would reject it as raw). Hard breaks with src null emit a raw newline, splitting rows."
    artifacts:
      - path: "taskflow/src/lib/wiki/editor/emit.ts"
        issue: "lines ~356-370 and ~36-37"
    missing:
      - "Emit a single space for empty unpadded cells; emit hardBreak with no src as '\\\\' inside cells and headings"
human_verification:
  - test: "Plan 97-03 Task 3 (deferred by user): in the running app compare Jira and WikiRenderer for mixed *# nesting (D-01), header-less tables (D-02) and the panel family including lists in panels (D-12)"
    expected: "WikiRenderer matches Jira for each; re-check after the CR-01/CR-02 renderer fixes"
    why_human: "Visual Jira parity cannot be asserted by grep"
---

# Phase 97: Round-Trip Engine Verification Report

**Phase Goal:** Wiki text can be parsed into an editor document and emitted back without changing what Jira shows, and an unedited text is saved byte-identical
**Status:** gaps_found
**Re-verification:** No, initial verification

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Corpus fixtures re-emitted render identically through WikiRenderer (header-less tables, panels, `{color}`, mixed `*#`) | FAILED (partial) | Corpus tests pass (5603 vitest green), but the phase's own D-12 renderer rewrite regresses mid-line panels (CR-01) and permits forging the headerless marker (CR-02); both confirmed by scratch run of wikiToMarkdown |
| 2 | No-edit load/save is byte-identical incl. CRLF and trailing whitespace | VERIFIED | saveWiki returns `loaded.original` when `current.eq(loaded.doc)` (engine.ts:93-95); roundtrip, fuzz and ladder tests green; reviewer found the load path sound |
| 3 | Emoticons, `[~user]`, escapes, `\\` breaks keep original spelling | VERIFIED for parsed text (atoms replay `src`); typed-text side fails under SAFE-06 (CR-05) | See gaps; parsed spelling is preserved |
| 4 | Unknown macros / unparseable spans become raw atoms, shown read-only, saved verbatim | VERIFIED for the parse and unedited path; partial for raw atoms nested in list items / cells on edited docs (CR-03) | engine tests, raw.test.ts green |
| 5 | Unproven constructs demoted to raw atoms | VERIFIED | D-11 ladder in loadWiki (commit 6d82e963), ladder.test.ts green |

**Score:** 3/5 (SC2, SC4, SC5 verified for the unedited and parsed path; SC1 failed, SC3 partial)

## Independent confirmation of review blockers

Scratch vitest run (temp file, deleted, no source modified):

| ID | Reproduced | Output | Defeats |
|----|-----------|--------|---------|
| CR-01 | Yes | list item cut by `\n\n</div>` blocks | SC1 (renderer parity) |
| CR-02 | Yes | `data-wiki-headerless="1"` forged on a span in a header cell | SC1, D-02 invariant |
| CR-03 | Yes | `"* a\n"`, `{status:x}` lost | SAFE-04 contract |
| CR-04 | Yes | `"||b|"` for an empty first cell | edited-table safety (plan 06 D-08) |
| CR-05 | Yes | `"ping [~admin] now"` emitted unescaped | SAFE-06, plan 97-08 truth |

CR-03/CR-04 do not affect the unedited path, so the headline guarantee (SC2) holds. They do break emit contracts that Phase 98 depends on, so they are recorded as partial gaps.

## Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| SAFE-03 | 01, 02, 04, 05, 06, 09, 10 | SATISFIED | no-edit byte identity verified (SC2) |
| SAFE-04 | 04, 05, 06, 10 (and 07) | PARTIAL | verbatim for parsed docs; CR-03 loses raw content in edited docs |
| SAFE-06 | 07, 08, 09, 10 | PARTIAL | spelling kept for parsed text; typed text becomes markup (CR-05) |

No orphaned requirements: REQUIREMENTS.md maps only SAFE-03/04/06 to Phase 97 (SAFE-05 belongs to Phase 98). REQUIREMENTS.md currently marks all three Complete; that should be reverted to Pending until the gaps close.

## Other findings (non-blocking, from 97-REVIEW.md)

WR-01..WR-09 and IN-01..IN-05 are not independently re-verified here. WR-01 (saveWiki never re-checks its output) and WR-02 (recorded spelling overrides edited attrs) matter for Phase 98 and should be planned alongside the gap closure.

## Human Verification Required

1. Deferred 97-03 Task 3: visual Jira-parity check of D-01/D-02/D-12 (see frontmatter). Run it after the CR-01/CR-02 fixes, since they change the same renderer paths.

## Anti-patterns

No TBD/FIXME/XXX scan was run beyond the review; the review reported none relevant.

## Gaps Summary

The no-edit byte-identical guarantee and the demotion ladder are solid. The phase falls short in two places. (1) The renderer changes made for D-12 regress mid-line panels and open an attribute-injection path (CR-01, CR-02), which breaks SC1. (2) The emitter fails its typed-text escaping must-have (CR-05) and mishandles raw atoms and empty cells on edited docs (CR-03, CR-04). A gap-closure plan should cover CR-01 to CR-05 and tighten the tests that missed them (escape property oracle; no mid-line panel fixture).

---

_Verified: 2026-11-16T20:50:00Z_
_Verifier: Claude (gsd-verifier)_
