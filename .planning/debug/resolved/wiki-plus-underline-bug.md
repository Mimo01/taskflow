---
status: resolved
trigger: "there is a proble min wiki renderer with the '+' character. It is always treated as start of an underscore styling. verify how it is used and fix it, it behaves inconsistently with real jira"
created: 2026-09-22
updated: 2026-09-22
---

## Symptoms

- **Expected behavior:** A '+' character should render literally in most cases. Jira wiki markup uses paired `+text+` as the underline marker — only a properly paired occurrence should become underline styling. Unrelated lone '+' characters (e.g. in "C++", "3+2", version strings) should stay literal, matching real Jira's rendering behavior.
- **Actual behavior:** Any lone '+' appears to be treated as the start of underline/underscore styling, corrupting rendering of subsequent text.
- **Error messages:** None — silent, purely a visual/rendering bug (no console/runtime errors).
- **Timeline:** Long-standing; user is not sure it ever worked correctly. Not tied to a known recent change.
- **Reproduction:** Text like `text + text` renders with the second "text" underlined. General case: any string containing an unpaired '+' character in Jira wiki-formatted content rendered by WikiRenderer.

## Current Focus

reasoning_checkpoint:
  hypothesis: "jira2md's `to_markdown()` underline rule (`index.js` line 59: `.replace(/\+([^+]*)\+/g, '<ins>$1</ins>')`) runs on the ENTIRE preprocessed string with no per-line scoping and no whitespace-boundary requirement (unlike its own bold/italic rules which at least require `\S` at the start). It pairs the FIRST literal '+' anywhere in the document with the NEXT literal '+' anywhere after it — including across unrelated prose, table cells, and paragraphs — wrapping everything between them in `<ins>`. A single stray '+' (C++, 3+2, version strings, 'text + text') has no effect by itself, but as soon as a SECOND unrelated '+' exists anywhere later in the same rendered field, the two incorrectly pair up and corrupt all text between them. This exactly mirrors the already-fixed jira2md bold/italic greedy-pairing bug class (jira-wiki-italic-non-ascii) and the already-partially-fixed backslash-escaped-plus case (existing `\\+` → `&#43;` handling at WikiRenderer.tsx:688), which protects only the ESCAPED case, not bare unpaired '+'."
  confirming_evidence:
    - "Read node_modules/jira2md/index.js line 59: `.replace(/\\+([^+]*)\\+/g, '<ins>$1</ins>')` — global, whole-string, no boundary/whitespace requirement, so any two '+' chars anywhere in the doc pair."
    - "WikiRenderer.tsx:682-688 already documents & fixes the backslash-escaped `\\+` case for exactly this reason ('a bare + left after stripping the backslash can pair with another + in a different cell, producing cross-cell <ins> tags') — confirms the maintainers already identified this failure mode for the escaped case but never handled the more common bare/unescaped case."
    - "Existing tests (WikiRenderer.test.tsx ~2098-2168) only cover the escaped `\\+` case ('escaped-plus... jira-detail-rendering-of-pages'); no test/fix exists for bare/unpaired '+' — matches reported gap exactly."
  falsification_test: "If jira2md's underline regex were instead scoped per-line or required whitespace-adjacency like real Jira, bare unpaired '+' would never produce <ins> — disproven by direct read of index.js source, which has neither constraint."
  note_regex_iteration: "First implementation used `\\S` for the content boundary characters, which incorrectly matched '+' itself (since '+' is non-whitespace) — this let a boundary swallow an adjacent '+' in a run of 2+ plus signs (e.g. 'C++ ... +3 ...') and mis-paired the FIRST '+' with an unrelated '+' several words later. Caught by the 'C++ and version-style pluses render literally' regression test failing on first run. Fixed by using `[^+\\s]` (non-whitespace AND non-plus) for both content boundaries."
  fix_rationale: "Root cause is that jira2md is never given a chance to apply its broken global pairing: add a preprocessing pass (mirroring the existing per-line, non-greedy, \\S-boundary bold/italic pattern already used in normalizeTableCellInlineFormatting) that converts genuine same-line, non-whitespace-bounded `+text+` pairs directly to `<ins>text</ins>` HTML, then neutralizes any remaining literal '+' to the HTML entity `&#43;` (same technique already used for the escaped-\\+ case) so jira2md's own buggy regex never sees an unpaired '+' to mis-pair. Must run AFTER the image/attachment steps (which rely on literal '+' in URLs for their own %20 substitution) and after the emoticon (+) replacement, i.e. near the end of preprocessJiraMarkup, mirroring where the analogous round-2 underscore-protection pass sits."
  blind_spots: "Two touching pluses on both sides of a single character (e.g. '3+2+4') will still false-positive-match ('2' becomes underlined) because real Jira has this same inherent ambiguity for touching delimiters — not something to fully solve, matches upstream Jira behavior, not a regression target. Have not yet run the test suite to confirm no interaction with normalizeTableCellInlineFormatting's per-cell placeholder logic (LINK placeholders) since underline pass runs on the whole doc after table-cell processing already occurred."

## Evidence

- timestamp: 2026-09-22
  checked: node_modules/jira2md/index.js to_markdown()
  found: "Underline rule at line 59 is `.replace(/\\+([^+]*)\\+/g, '<ins>$1</ins>')` — global across the whole string, no per-line scoping, no whitespace-boundary requirement (unlike real Jira's own +...+ underline rule which requires the delimiter to touch non-whitespace)."
  implication: "Any two literal '+' characters anywhere in the rendered field pair up and wrap everything between them in <ins>, regardless of how far apart or unrelated they are (C++, 3+2, version numbers, unrelated prose across paragraphs/table cells)."
- timestamp: 2026-09-22
  checked: WikiRenderer.tsx preprocessJiraMarkup (lines 682-688)
  found: "Existing `\\\\+` → `&#43;` handling already documents this exact failure mode but only protects the Jira backslash-escaped-plus case, not bare/unescaped '+'."
  implication: "Confirms root cause and shows the established fix pattern (neutralize to HTML entity before jira2md runs) already used elsewhere in this file — extend it to genuinely-paired vs stray bare '+'."
- timestamp: 2026-09-22
  checked: user manual verification against real Jira wiki content post-fix
  found: "User confirmed: \"it does seem to be working correctly now\"."
  implication: "Fix validated against real-world content, not just synthetic tests. Session resolved."

## Eliminated

## Resolution

- root_cause: "jira2md's `to_markdown()` underline conversion (`+([^+]*)+` → `<ins>`) operates globally across the entire preprocessed string with no line-scoping or whitespace-boundary requirement, so any two unrelated literal '+' characters anywhere in the rendered field incorrectly pair up and wrap all text between them in `<ins>` underline styling."
- fix: "Added a preprocessing pass in `preprocessJiraMarkup` (WikiRenderer.tsx) that converts genuine same-line, non-whitespace-bounded `+text+` pairs directly to `<ins>text</ins>` HTML (mirroring the existing per-line \\S-boundary bold/italic technique), then neutralizes any remaining literal '+' to the `&#43;` HTML entity so jira2md's own buggy global regex never sees an unpaired '+' to mis-pair with an unrelated one elsewhere in the document. Placed after image/attachment/emoticon handling (which legitimately consume '+' for their own purposes) and before the round-2 link-underscore-protection pass.

  Two follow-up rounds (found during user's real-content verification, fixed inline outside the session manager loop):
  1. '+' inside `{code}`/`{noformat}` blocks was still corrupted because jira2md's `to_markdown()` runs ALL of its wiki-markup regexes (bold/italic/lists/underline) on the whole string BEFORE its own {code}/{noformat}→fence conversion, so code content was never actually shielded by the &#43; neutralization alone. Fixed by extracting each block's BODY (not the delimiter tags, so jira2md still recognizes and fences them) into an opaque \\x00CODEBODY{n}\\x00 placeholder at the very start of preprocessJiraMarkup — before any transform, including jira2md's own — and restoring the literal body text in the WikiRenderer component AFTER `j2m.to_markdown()` returns (preprocessJiraMarkup's return type changed from `string` to `{ text, codeBlockBodies }`).
  2. A body starting immediately after `{code}` with no newline landed on the fence's info-string line and got dropped; fixed by always inserting a real newline right after the open tag when the body didn't already start with one.
  3. The original body's trailing newline (before the closing tag) combined with jira2md's own template newline to produce a stray blank line at the end of the rendered code block; fixed by stripping exactly one trailing newline from the stored body before restoration."
- verification: "Self-verified across all three rounds: (1) full WikiRenderer.test.tsx suite (170 tests, including regression tests for bare '+' in prose, '+' inside {code}/{noformat} blocks, the exact real-world multi-line/multi-plus repro, and the no-trailing-blank-line case) all pass. (2) Full project vitest suite (2765 tests) passes with zero failures/regressions (one unrelated pre-existing flaky test in WorklogsPage.test.tsx confirmed passing in isolation). (3) tsc --noEmit clean. User confirmed against real-world Jira content across all three rounds, final message: \"fix confirmed, approved\"."
- files_changed:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
