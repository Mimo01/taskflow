---
phase: 97-round-trip-engine
verified: 2026-11-16T22:20:00Z
status: gaps_found
score: 4/5 roadmap success criteria verified (SC3 fails for typed text)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "SC1: mid-line panel regression in preprocess.ts (prior CR-01), fixed by ownLine in preprocess.ts"
    - "SC1/D-02: attribute injection and forged headerless marker (prior CR-02), attr() plus positional marker match in pipeline.ts"
    - "SAFE-04: raw atoms inside list items and table cells written verbatim (prior CR-03)"
    - "Edited-table corruption: empty cells and hard breaks in cells (prior CR-04)"
    - "SAFE-06 typed atom look-alikes ([~x], !img!, [^f], {status}, emoticons) are now escaped (prior CR-05, partial)"
  gaps_remaining:
    - "SAFE-06 typed block macros mid-line saved unescaped and render live (new CR-01)"
    - "SAFE-06 the new escapes render as literal HTML text in TaskFlow's own renderer (new CR-02)"
  regressions: []
gaps:
  - truth: "SAFE-06 / SC3: typed text containing markup characters is saved so that what Jira shows equals what the user typed"
    status: failed
    reason: "Verified by my own repro (saveWiki of an edited doc, then wikiToHtml). Typed 'a {code}x{code} b' is saved unescaped as 'a {code}x{code} b' and renders as a literal triple-backtick plus an empty <pre><code class=language-b>. Typed 'a {info}x{info} b' renders a live callout span; 'a {quote}q{quote} b' renders a blockquote marker; 'a {noformat}x{noformat} b' renders inline code. Cause: inlineSegments escapes only when the editor's own parseWiki would read the text differently, and parseWiki treats these macros as plain text mid-line, while the renderer (and Jira) treat them as live. save-check.ts compares only against parseWiki, so it accepts the text."
    artifacts:
      - path: "taskflow/src/lib/wiki/editor/emit.ts"
        issue: "inlineSegments (~369-380) and the keep minimiser decide escaping by the editor parser alone"
      - path: "taskflow/src/lib/wiki/editor/escape.ts"
        issue: "'{' is not an unconditional escape site for code/noformat/quote/panel/info/note/warning/tip/color"
      - path: "taskflow/src/lib/wiki/editor/save-check.ts"
        issue: "oracle is parseWiki, not the renderer"
    missing:
      - "Always escape the opening brace of live macro names in typed text"
      - "Add a regression test that runs typed macro look-alikes through saveWiki and wikiToHtml"
  - truth: "The escapes the emitter writes display as the typed characters in TaskFlow (SC1: identical through WikiRenderer)"
    status: failed
    reason: "Verified. Typed 'a *b* c' saves as 'a \\*b\\* c' and wikiToHtml gives <p>a &#x3C;strong>b&#x3C;/strong> c</p>, i.e. literal tag text. Same for '\\_', '[\\~admin]' (shows <~admin>), and '\\{color:red}' (shows a literal span tag). preprocess.ts does not neutralise Jira backslash escapes before jira2md. What Jira shows for these escapes is not determinable from the code, so only the TaskFlow side is asserted here."
    artifacts:
      - path: "taskflow/src/lib/wiki/preprocess.ts"
        issue: "no handling of \\* \\_ \\^ \\~ \\{ \\[ \\! before jira2md (only \\+ and \\\\ handled)"
    missing:
      - "Replace backslash-escaped ESCAPABLE_CHARS with entities or sentinels before jira2md; add a renderer test per character"
human_verification:
  - test: "Paste into a Jira test issue: 'a \\*b\\* c', '[\\~admin]', '\\{color:red}x\\{color}', '\\!http://e.example/p.png\\!' and compare with the emitter's output"
    expected: "Jira shows the literal characters (asterisks, brackets, braces, bang) with no bold, mention, color or image"
    why_human: "Only Jira can say whether its parser honours these escapes, and whether the minimiser's choice of '[\\~admin]' (rather than '\\[~admin]') is literal there (review WR-04)"
  - test: "Deferred 97-03 Task 3: compare Jira and WikiRenderer for mixed *# nesting (D-01), header-less tables (D-02), panels including lists (D-12)"
    expected: "WikiRenderer matches Jira for each"
    why_human: "Visual Jira parity cannot be asserted by grep"
---

# Phase 97: Round-Trip Engine Verification Report (re-verification)

**Phase Goal:** Wiki text can be parsed into an editor document and emitted back without changing what Jira shows, and an unedited text is saved byte-identical
**Verified:** 2026-11-16T22:20:00Z
**Status:** gaps_found
**Re-verification:** Yes, after gap closure plans 97-11..97-14

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Corpus fixtures re-emitted render identically through WikiRenderer | VERIFIED for corpus | Prior CR-01 (mid-line panel) and CR-02 (attr injection) are closed; ownLine and attr() present in preprocess.ts, positional headerless match in pipeline.ts. 368 wiki tests and tsc pass. The new CR-02 below concerns edited typed text, not the corpus. |
| 2 | No-edit load/save is byte-identical incl. CRLF and trailing whitespace | VERIFIED | saveWiki returns the original when the doc is unchanged; engine, roundtrip and fuzz tests pass. saveWiki now also re-parses its output and fails closed (97-14). |
| 3 | Emoticons, `[~user]`, escapes, `\\` breaks keep original spelling | VERIFIED for parsed text; FAILED for typed text | Atoms replay their recorded spelling and yield to attribute edits. Typed block macros are saved live (gap 1). |
| 4 | Unknown macros / unparseable spans become raw atoms, read-only, saved verbatim | VERIFIED | Also verified for raw atoms inside list items and cells (97-13). Unsupported nested blocks fail closed with WikiEmitError. |
| 5 | Unproven constructs demoted to raw atoms | VERIFIED | D-11 ladder tests pass. |

**Score:** 4/5 (SC3 fails for typed text)

## Independent repro (my own scratch vitest, deleted afterwards, git tree clean)

Edited doc with a single paragraph of typed text, passed through saveWiki, then wikiToHtml:

| Typed text | Saved | TaskFlow renders |
|-----------|-------|------------------|
| `a {code}x{code} b` | unescaped | literal backticks and an empty `<pre>` (language-b) |
| `a {info}x{info} b` | unescaped | live callout span |
| `a {quote}q{quote} b` | unescaped | blockquote marker and `<br>` |
| `a {noformat}x{noformat} b` | unescaped | inline `<code>` |
| `a *b* c` | `a \*b\* c` | `<p>a &#x3C;strong>b&#x3C;/strong> c</p>` (literal tag text) |
| `a _b_ c` | `a \_b\_ c` | literal `<em>` text |
| `ping [~admin] now` | `ping [\~admin] now` | `<~admin>` |
| `{color:red}x{color}` | `\{color:red}x\{color}` | literal `<span data-color=...>` text |

Both review criticals are confirmed as far as the TaskFlow renderer goes. Jira's rendering of the first four rows is expected to be live (the macros are Jira's own syntax), but I have not seen Jira render them. For the escape rows the saved text is probably right in Jira; that is human_needed.

The save check compares only against parseWiki, so it cannot see either problem; it is blind by construction rather than buggy.

## Prior gap re-verification

| Prior gap | Result |
|-----------|--------|
| CR-01 mid-line panels split lists | Closed (code present, review repro and test suite pass) |
| CR-02 forged headerless / attribute injection | Closed for title/color/data-id; siblings missed (see warning W5) |
| CR-03 raw atoms in items/cells | Closed |
| CR-04 empty cells, hard break in cells | Closed |
| CR-05 typed atom look-alikes | Partially closed: atoms escaped, block macros not, and escapes render badly in TaskFlow |

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SAFE-03 (unedited save byte-identical) | SATISFIED | SC2 verified; fail-closed re-parse on edits |
| SAFE-04 (unmodelable constructs read-only, saved verbatim) | SATISFIED | SC4, SC5 verified including nested raw atoms |
| SAFE-06 (spelling, escaping, `\\`, CRLF survive) | NOT SATISFIED for typed text | gap 1 and gap 2; parsed spelling is fine |

No orphaned requirements; REQUIREMENTS.md maps only SAFE-03/04/06 to Phase 97. REQUIREMENTS.md currently marks SAFE-06 Complete; this should be reverted to Pending until the gaps close.

## Other review findings (read from 97-REVIEW.md, not all re-run by me)

- WR-01: parser/renderer divergence accepted by the save check (`*one<br>two*`, heading hard break). Same root cause as gap 1.
- WR-02: toggling a table header row always fails to save. Fail-closed but blocks a basic Phase 98 edit.
- WR-03: first block gets a leading blank line after edits. I observed this in my repro (saved text began with `\n`).
- WR-04: minimiser picks `[\~admin]`; Jira behaviour unverified (human_needed above).
- WR-05: display name and attachment URL not attribute-escaped (tracking pixel via user-map name). Sanitize prevents script execution.
- WR-06..WR-08, IN-01..IN-05: unchanged or fail-closed; none touches the unedited path.

## Gaps Summary

The headline guarantees (no-edit byte identity, raw atom preservation, fail-closed save) hold, and every prior gap is closed or reduced. The remaining blocker is SAFE-06 for typed text: the emitter and the save check use the editor parser as the only judge of what is literal, but the renderer and Jira are the real judges. Block macros typed mid-line stay live, and the escapes written for other characters display as raw tag text in TaskFlow. A further closure plan should force-escape live macro openers, teach preprocess.ts the Jira backslash escapes, and add tests that route typed text through wikiToHtml.

---

_Verified: 2026-11-16T22:20:00Z_
_Verifier: Claude (gsd-verifier)_
