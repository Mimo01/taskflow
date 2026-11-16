---
phase: 97-round-trip-engine
verified: 2026-11-16T23:00:00Z
status: human_needed
score: 5/5 roadmap success criteria verified (with documented fail-closed limitations)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Gap 1: typed block macros mid-line saved live (fixed by 97-16: rawInline atoms plus opening-delimiter-last minimiser)"
    - "Gap 2: backslash escapes rendered as literal tag text in WikiRenderer (fixed by 97-15: neutraliser in preprocess.ts plus inline-code decoder)"
  gaps_remaining: []
  regressions: []
warnings:
  - id: W1
    item: "Bare URL containing paired _ or * is saved with backslash escapes and renders a broken href (review WR-01)"
    evidence: "My probe: typed 'http://a.com/_a_ and _b_' saves as 'http://a.com/\\_a\\_ and \\_b\\_' and renders <a href=\"http://a.com/&#x26;#95;a&#x26;#95\">. Same for 'https://e.com/a*b*c'. Reachable from the emitter, not hypothetical."
    severity: warning
  - id: W2
    item: "Typed {code}/{noformat} inside a table cell cannot be saved (fail-closed)"
    severity: warning
  - id: W3
    item: "Cell-panel opener lookbehind ignores even backslash runs (review WR-02): model and renderer disagree, no data loss"
    severity: warning
human_verification:
  - test: "Paste into a Jira test issue: 'a \\*b\\* c', 'ping \\[~admin] now', 'a \\{code}x\\{code} b', and a bare URL 'http://a.com/\\_a\\_'"
    expected: "Jira shows the literal characters with no bold, mention, code block; for the URL, note whether Jira keeps the backslashes in the link"
    why_human: "Only Jira can say whether it honours these escapes, and how it treats escapes inside bare URLs (decides whether W1 is a TaskFlow-only defect or also a Jira one)"
  - test: "Deferred 97-03 Task 3: compare Jira and WikiRenderer for mixed *# nesting (D-01), header-less tables (D-02), panels including lists (D-12)"
    expected: "WikiRenderer matches Jira for each"
    why_human: "Visual Jira parity cannot be asserted by grep"
---

# Phase 97: Round-Trip Engine Verification Report (re-verification 2)

**Phase Goal:** Wiki text can be parsed into an editor document and emitted back without changing what Jira shows, and an unedited text is saved byte-identical
**Status:** human_needed (all automated checks pass; the Jira-side checks remain human)
**Re-verification:** Yes, after gap closure plans 97-15, 97-16, 97-17

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Corpus fixtures re-emitted render identically through WikiRenderer | VERIFIED | Corpus and equivalence tests pass; escape neutraliser did not change any corpus expectation (97-15 SUMMARY "Changed expectations: None"). |
| 2 | No-edit load/save is byte-identical incl. CRLF, trailing whitespace | VERIFIED | Engine, roundtrip and fuzz tests green; saveWiki returns the original string when unchanged. |
| 3 | Emoticons, `[~user]`, escapes, `\\` keep original spelling | VERIFIED | Parsed atoms replay recorded spelling. Typed look-alikes are now escaped and render as typed (typed-render.test.ts, 32 cases, includes the previous 8 repro rows). |
| 4 | Unknown macros / unparseable spans are read-only raw atoms saved verbatim | VERIFIED | raw.test.ts; mid-line live macros are now rawInline atoms (97-16); nested raw atoms in items/cells verified earlier. |
| 5 | Unproven constructs demoted to raw atoms | VERIFIED | ladder tests pass. |

**Score:** 5/5

## Behavioral spot-checks

| Check | Command | Result |
|-------|---------|--------|
| Wiki engine, renderer and corpus tests | `npx vitest run src/lib/wiki src/routes/dashboard/WikiRenderer.test.tsx` (in inner taskflow/) | 23 files, 628 tests passed |
| Typed URL probe (scratch test, deleted, git tree clean) | saveWiki then wikiToHtml | W1 reproduced, see above |

Both previous gaps are re-checked: the 8 repro rows now live in `typed-render.test.ts` and pass in my run; `{code}` etc. are saved as `\{code}`, `*b*` renders as `*b*` rather than literal tag text.

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SAFE-03 | SATISFIED | SC2; fail-closed re-parse on edits |
| SAFE-04 | SATISFIED | SC4, SC5 |
| SAFE-06 | SATISFIED for the requirement text, with the limitations W1/W2 | SC3; see judgement below |

No orphaned requirements (REQUIREMENTS.md maps only SAFE-03/04/06 to Phase 97, all in plan frontmatter). REQUIREMENTS.md still shows SAFE-06 Pending (line 15 and traceability row 108).

## Judgement 1: typed {code}/{noformat} in a table cell (fail-closed): not a blocker

SAFE-06 text: emoticons, mentions, escaping, `\\` breaks and CRLF/trailing whitespace "survive round-trip with their original spelling". That is a preservation requirement. The cell limitation does not violate it: nothing existing is altered, and `saveWiki` returns `failed` rather than writing text. The phase goal ("without changing what Jira shows") is held, since a refused save changes nothing in Jira. Success criteria 1-5 speak of corpus, no-op saves, atoms and demotion; none promises that every possible typed string is saveable. The cost is a usability limit on an uncommon input (literal code-macro text in a table cell), and Phase 98 already owns the "fails the round-trip check, show a notice" path (its SC4) and Phase 100 the save UX. Recommendation: mark SAFE-06 Complete and record the limitation as a known follow-up (make `parseCell` escape-aware) in the Phase 98 hand-off. If the owner wants "every typed string is saveable" as the bar, keep it Pending; that is a scope decision, not a verification failure.

## Judgement 2: review WR-01 and WR-02

- WR-01 is real and reachable: the emitter does write `\_` or `\*` inside a bare URL when paired delimiters appear in the same paragraph, and TaskFlow then renders a mangled href and link text (probe above). A URL with a single `_` (common) is unaffected, and a URL with unpaired `_` pairs like `p_q_` renders a trimmed link even without escapes, which is pre-existing renderer behaviour. It does not break any success criterion: SC1 and SC3 concern corpus and parsed spellings, and the typed-text battery passes. It does affect real use in Phase 98 and should be fixed before the editor ships (renderer should restore `&#NN;` inside autolinks, or the emitter should not escape inside bare URLs). Severity: warning.
- WR-02 is a model/renderer inconsistency for `\\{info}` in a cell; content is preserved as raw atoms, no corruption. Not a blocker; unreproduced by me.
- IN-01 (lookbehind needs WebKit 16.4+): confirm the minimum macOS target during Phase 98.

## Anti-patterns

No TBD/FIXME/XXX introduced in the reviewed files that I found; no stubs reported. The scratch probe file was removed and the git tree is clean.

## Gaps Summary

No blocking gaps. Both previous gaps are closed and verified by passing tests and my own repro. Status is human_needed only because the Jira-side behaviour of the escapes and the deferred 97-03 visual parity check cannot be asserted from code. Open warnings W1 (URL escapes) and W2 (cell code macro) should be carried into Phase 98 planning.

---

_Verified: 2026-11-16T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
