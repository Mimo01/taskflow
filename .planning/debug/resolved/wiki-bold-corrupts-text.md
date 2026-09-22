---
status: resolved
trigger: |
  DATA_START
  there is a bug in the wiki renderer, this raw text:
  *1. -TEXT-*

  gets rendered as
  <strong>1. -Vianočná Super Prima-</strong>
  DATA_END
created: 2026-09-22
updated: 2026-09-22
---

## Symptoms

- Expected behavior: `*1. -TEXT-*` (literal wiki markup, bold markers around the literal text `1. -TEXT-*`) should render as `<strong>1. -TEXT-</strong>` — i.e. the bold wrapper should apply only to its own matched span, with the content inside unchanged from what was authored at that location.
- Actual behavior: the rendered output shows `<strong>1. -Vianočná Super Prima-</strong>` — the bold tag ends up wrapping unrelated real content (a Slovak-language string with non-ASCII characters) instead of the literal `TEXT` placeholder content that was at that position in the source. This indicates the bold/italic regex is matching across a broader span than intended and pulling in unrelated text from elsewhere in the document (a known recurring pattern in this renderer — see prior fixes for `+` character corruption and italic + non-ASCII corruption).
- Error messages: none — silent HTML corruption, no console errors.
- Timeline: always been broken, as far as the user knows (not a regression).
- Reproduction: render wiki content containing a line matching the pattern `*1. -TEXT-*` (asterisk-bold markup wrapping a numbered, dash-delimited fragment) inside a document that also contains other text elsewhere (e.g. non-ASCII / Slovak text) — the bold tag ends up wrapping the wrong span/content.

## Current Focus

hypothesis: RESOLVED (round 2) — `*1. -TEXT-*` rendered `<strong>1. -TEXT-</strong>` (literal dashes) instead of `<strong>1. <del>TEXT</del></strong>` because jira2md's own strikethrough rule (`/(\s+)-(\S+.*?\S)-(\s+)/g`) requires whitespace immediately before the opening `-` and after the closing `-`; when the strikethrough span is nested directly against a bold delimiter (`-TEXT-*`), the closing `-` is followed by `*`, not whitespace, so the rule never fires and the dashes render as literal text.
test: added strikethrough-to-`<del>` conversion inside convertInlineBoldItalic (treats `*`/`_` as valid boundaries in addition to whitespace/start/end), scoped to run before the bold/italic HTML conversion so `*1. -TEXT-*` becomes `*1. <del>TEXT</del>*` then `<strong>1. <del>TEXT</del></strong>`. Reordered the pre-existing `----` → `<hr>` divider fix to run BEFORE this new pass (it must see un-corrupted pure-dash-run lines).
expecting: N/A — fix implemented, verified, full suite green.
next_action: CHECKPOINT — ask user to retest `*1. -TEXT-*` (and the general two-bold-spans-on-one-line case) in the real app; archive session on confirmation.
reasoning_checkpoint:
  hypothesis: "jira2md's to_markdown() bold regex (/\\*(\\S.*)\\*/g) and italic regex (/_(\\S.*)_/g) are greedy per-source-line matches that pair the FIRST opening delimiter with the LAST closing delimiter on that line. WikiRenderer already works around this defect for table cells via normalizeTableCellInlineFormatting() (WikiRenderer.tsx:538), but that workaround is scoped ONLY to lines starting with `|` (table data rows). Ordinary prose/paragraph lines containing two or more *...* (or _..._) spans on the same physical source line are unprotected, so jira2md's raw regex bleeds bold/italic formatting from the first opening marker all the way to the last closing marker on the line, wrapping any unrelated intervening text (including a second, unrelated bold span later on the same line) inside one <strong>/<em>."
  confirming_evidence:
    - "Reproduced directly via preprocessJiraMarkup() + j2m.to_markdown(): input '*1. -TEXT-* niečo *Vianočná Super Prima-*' (single prose line, two bold spans) produces markdown '**1. -TEXT-* niečo *Vianočná Super Prima-**' — i.e. ONE <strong> wrapping from the first '*' to the LAST '*', swallowing the intervening 'niečo' text and merging both spans, exactly matching the reported symptom (bold wrapping unrelated text located elsewhere on the line/document)."
    - "Same mechanism already documented and fixed for two other cases in this file: table cells (WikiRenderer.tsx:517-530, normalizeTableCellInlineFormatting) and brace-bold {*}a{*} {*}b{*} (WikiRenderer.tsx:695-703, comment explicitly states 'two adjacent *a* *b* spans get merged... by jira2md'). Plain prose *a* *b* was never given the equivalent fix."
    - "jira2md/index.js source confirms the raw regexes: `.replace(/\\*(\\S.*)\\*/g, '**$1**')` (bold) and `.replace(/_(\\S.*)_/g, '*$1*')` (italic) — both use greedy `.*` with no non-table per-line safeguard applied before this point in the pipeline for non-table-row lines."
  falsification_test: "If a prose line contains only ONE *...* bold span (no second unrelated * pair on the same line), the bug does not manifest — confirmed in the first scratch repro ('*1. -TEXT-*' alone on its own line rendered correctly as **1. -TEXT-**). This confirms the defect requires 2+ same-line bold/italic spans, consistent with the greedy first-to-last pairing theory, not some other cause (e.g. non-ASCII handling, dash/strikethrough interaction)."
  fix_rationale: "Generalize normalizeTableCellInlineFormatting's per-line, non-greedy, link-protected bold/italic conversion (already proven correct for table rows) to run on ALL lines, not just lines starting with `|`. This converts *text*/_text_ directly to <strong>/<em> HTML per-line before jira2md ever sees them, using the same non-greedy regex with negative lookaround (already used for table cells) that correctly pairs each opening marker with its own nearest closing marker instead of the first-to-last greedy span. This addresses the root cause (jira2md's greedy same-line regex) rather than special-casing the reported example text."
  blind_spots: "Have not yet verified this generalization doesn't regress list markers (`* item`), emoticon `(*)` sequences, or already-converted brace-bold HTML — reasoned through statically (list markers have a space after `*` so the `\\S` boundary excludes them; emoticons/brace-bold run before this step and no longer contain raw `*...*`) but must run the full existing WikiRenderer test suite to confirm no regression before treating this as verified."

## Evidence

- timestamp: 2026-09-22
  checked: taskflow/src/routes/dashboard/WikiRenderer.tsx (full preprocessJiraMarkup pipeline, jira2md/index.js source)
  found: normalizeTableCellInlineFormatting() (line 538) applies a non-greedy, per-cell bold/italic conversion but only to lines starting with `|` (table data rows, line 545: `if (!trimmed.startsWith('|') || trimmed.startsWith('||')) { out.push(line); continue; }`). All other lines pass through untouched and are later processed by jira2md's raw `to_markdown()` regexes.
  implication: prose lines have no protection against the same greedy-pairing defect that table cells were already fixed for.
- timestamp: 2026-09-22
  checked: jira2md/index.js (node_modules), to_markdown() bold/italic rules
  found: "Bold: `.replace(/\\*(\\S.*)\\*/g, '**$1**')`; Italic: `.replace(/_(\\S.*)_/g, '*$1*')` — both greedy `.*`, operate on the whole string per match but `.` cannot cross real newlines, so matching is confined to a single source line but pairs the FIRST opening delimiter with the LAST closing delimiter within that line."
  implication: any single line with 2+ bold (or italic) spans corrupts into one merged span; explains "bold wraps unrelated text elsewhere" symptom when the unrelated text is a later `*...*` span on the same physical line.
- timestamp: 2026-09-22
  checked: reproduced via scratch vitest test calling preprocessJiraMarkup() + j2m.to_markdown() directly
  found: "input `*1. -TEXT-* niečo *Vianočná Super Prima-*` -> preprocessed unchanged -> j2m.to_markdown() output `**1. -TEXT-* niečo *Vianočná Super Prima-**` (single greedy strong wrapping both spans and the text between them). Single-bold-span-per-line inputs render correctly."
  implication: confirms root cause mechanism and reproduces symptom pattern exactly (bold boundary swallowing unrelated later content on the line).

## Evidence (round 2)

- timestamp: 2026-09-22
  checked: user retest of the applied round-1 fix
  found: "`*1. -TEXT-*` now renders as `<p><strong>1. -TEXT-</strong></p>` — the greedy-bold-pairing defect is fixed (single bold span, no bleed to unrelated content), but the dashes around TEXT still render literally instead of as strikethrough."
  implication: a second, distinct/compounding defect exists — Jira strikethrough markup `-text-` is not being converted when nested inside a bold span. Round-1 fix (greedy bold pairing) was correct and should not be reverted.
- timestamp: 2026-09-22
  checked: jira2md/index.js to_markdown() rule order and regex (node_modules/jira2md/index.js line 65)
  found: "Strikethrough rule `.replace(/(\\s+)-(\\S+.*?\\S)-(\\s+)/g, '\$1~~\$2~~\$3')` runs AFTER bold/italic (lines 51/53) and REQUIRES whitespace immediately before the opening `-` and after the closing `-`. In `*1. -TEXT-*`, the closing `-` is immediately followed by `*` (the bold delimiter), never whitespace — so this rule can never match regardless of bold-pairing correctness. This is a pre-existing jira2md limitation, not something introduced by the round-1 fix; round-1 only made the bold *boundary* correct, it does not touch strikethrough."
  implication: root cause of round 2 is jira2md's whitespace-only boundary requirement for strikethrough colliding with adjacent bold/italic delimiters — the same boundary-adjacency category of bug already fixed once for the narrower `[-text-|url]` named-link-label case (commit a5d78151), never generalized to bold/italic-adjacent strikethrough in prose.
- timestamp: 2026-09-22
  checked: scratch node repro of first-draft fix regex `-(\S+[^\n]*?\S)-` with `*`/`_` added as valid boundary chars
  found: "Against `*1. -TEXT-* niečo *Vianočná Super Prima-*`, the naive regex (content class `\\S`) greedily consumed through the first `*` delimiter and the second dash-wrapped span too, producing `<del>TEXT-* niečo *Vianočná Super Prima</del>` — because `\\S` includes `*`/`_` themselves, so the greedy `\\S+` component doesn't stop at a bold delimiter. Reproduces the exact same greedy-pairing failure mode the round-1 fix addressed, now inside the new strikethrough regex."
  implication: content character class must explicitly exclude `*`/`_` (not merely rely on `\\S`), mirroring how the existing bold regex already excludes `*` from its own content class (`[^*\\n]`).
- timestamp: 2026-09-22
  checked: revised regex `-([^\s*_\n]+[^*_\n]*?[^\s*_\n])-` (content excludes `*`/`_`, min-2-char requirement preserved to match jira2md's own `\S+.*?\S` minimum) against the full test matrix: nested bold+strikethrough, two-span-per-line bleed case, mid-sentence whitespace-bounded strikethrough, pure `----`/`-----` divider lines, `---` (post-divider-fix 3-dash form), numeric ranges (`-5-10`), hyphenated words (`well-known-term`)
  found: "All cases produced correct output — nested case converts to `<del>`, bleed case stays isolated per span, mid-sentence case unaffected (same visual result, now produced earlier in the pipeline), divider lines and their post-conversion `---` form are untouched (3 total dash chars can't satisfy the 2-content-char minimum), number ranges and hyphenated words are untouched (boundary requirements fail to find a valid pair)."
  implication: fix confirmed correct; also had to reorder the existing `----`→`<hr>` divider conversion to run BEFORE this new strikethrough pass (previously it ran after table-cell/prose bold-italic normalization), since the new pass would otherwise see raw `----`/`-----` lines before the divider fix converts them to the safe 3-dash form.

## Eliminated

- hypothesis: "Fix is not applied / dead code / wrong component rendered in the live app"
  evidence: |
    Only one WikiRenderer implementation exists in the codebase (src/routes/dashboard/WikiRenderer.tsx,
    src/routes/dashboard/WikiRenderer.test.tsx — no duplicate/legacy wiki renderer files found via
    `find src -iname "*wiki*"`). All 7 live usage sites (DescriptionEditor, IssueDetailContent,
    IssueDetailView, CommentComposer, InlineComment, MergeRequestDetailPage, AioTestRunDetailPage,
    ActivityTimeline) import from this single file. The convertInlineBoldItalic() generalization
    (lines 559-577) is wired into normalizeTableCellInlineFormatting() (line 595-597: `if
    (!trimmed.startsWith('|')) { out.push(convertInlineBoldItalic(line)); continue; }`) which
    IS called from preprocessJiraMarkup() (line 786), which IS the function all render call sites
    invoke (line 1419: `preprocessJiraMarkup(wikiText, attachments, users)`). No stale/duplicate
    code path found. A `tauri dev` + vite process has been running since 8:41AM (confirmed via
    `ps aux`), so file-watch/HMR should be picking up the change automatically (module exports a
    React component; non-component helper edits in the same module trigger vite full-reload at
    worst, not a stale bundle).
  timestamp: 2026-09-22
- hypothesis: "The exact reported input, and realistic real-world variants, still fail after the fix"
  evidence: |
    Re-ran the fixed code (current working-tree WikiRenderer.tsx, uncommitted) against 4 scenarios
    via a scratch vitest file: (1) the literal reported input `*1. -TEXT-*` alone → renders
    correctly as one <strong>1. -TEXT-</strong>; (2) `*1. -TEXT-* some plain unrelated text`
    (single bold span, trailing prose, no second `*` pair) → renders correctly, no bleed; (3) two
    numbered bold list-style items on separate physical lines (`*1. -Item A-*\n*2. -Vianočná Super
    Prima-*`) → both render as independent <strong> spans; (4) same two items as a real Jira
    bullet list (`* *1. -TEXT-*\n* *2. -Vianočná Super Prima-*`) → renders as a <ul> with two
    independent <strong> list items, no cross-item bleed. All 4 passed — no reproduction of the
    reported corruption in any realistic variant tried.
  timestamp: 2026-09-22

## Resolution

root_cause: |
  ROUND 1: jira2md's to_markdown() bold regex (/\*(\S.*)\*/g) and italic regex (/_(\S.*)_/g) are
  greedy and pair the FIRST opening delimiter on a source line with the LAST closing delimiter on
  that same line. Fixed by generalizing table-cell-only bold/italic normalization to all prose
  lines (see below) — this part remains correct and was NOT reverted.

  ROUND 2 (compounding defect, found on retest): jira2md's own strikethrough rule
  (/(\s+)-(\S+.*?\S)-(\s+)/g) requires whitespace immediately before the opening `-` and after
  the closing `-`. When a strikethrough span (`-text-`) is nested directly against a bold/italic
  delimiter — e.g. `*1. -TEXT-*` — the closing `-` is immediately followed by `*`, never
  whitespace, so jira2md's rule never matches and the dashes render as literal characters instead
  of producing a struck-through span. This is the same "boundary character isn't whitespace"
  defect category already fixed once for the narrower `[-text-|url]` named-link-label case
  (commit a5d78151), never generalized to bold/italic-adjacent strikethrough in ordinary prose.
fix: |
  ROUND 1 (unchanged): Generalized the non-greedy, link-protected per-line bold/italic conversion
  from table rows only to ALL lines in normalizeTableCellInlineFormatting(), converting
  *text*/_text_ directly to <strong>/<em> before jira2md runs.

  ROUND 2: Added a strikethrough-to-<del> conversion pass inside convertInlineBoldItalic(), run
  BEFORE the bold/italic HTML conversion in the same function. Boundaries accept whitespace,
  start/end-of-line, AND `*`/`_` (the bold/italic delimiters) on either side — whereas jira2md's
  own rule only accepts whitespace, which is why it fails when the strikethrough touches a bold
  delimiter. The content character class explicitly excludes `*`/`_` (not just relies on `\S`,
  which would greedily reproduce the exact round-1 bleed bug inside the new regex — confirmed via
  scratch repro, see Evidence). Also reordered the pre-existing `----`→`<hr>` divider fix
  (`/^-{4,}$/gm` → `\n---\n`) to run BEFORE this new pass instead of after, since the new pass
  would otherwise see raw undivided `----`/`-----` lines and corrupt them into `<del>` spans
  before the divider conversion gets a chance to run.
verification: |
  ROUND 1 (unchanged): scratch repro + regression test + full suite, see prior verification notes
  below (preserved from round 1, all still passing after round 2 changes).

  ROUND 2:
  1. Scratch node regex repros confirmed the naive `\S`-based content class reproduces the
     round-1 greedy-bleed bug inside the new strikethrough regex; the corrected content class
     (excludes `*`/`_`) fixes it while preserving jira2md's original 2-char content minimum.
  2. Full matrix scratch-verified: nested bold+strikethrough (`*1. -TEXT-*` →
     `<strong>1. <del>TEXT</del></strong>`), two-bold-spans-with-strikethrough bleed case, plain
     mid-sentence whitespace-bounded strikethrough (unaffected, same visual result), `----`/
     `-----` divider lines and their post-conversion `---` form (untouched — 3 total dash chars
     can never satisfy the 2-content-char minimum), numeric ranges (`-5-10`, untouched),
     hyphenated words (`well-known-term`, untouched).
  3. Updated existing regression test 'wiki-bold-corrupts-text: two bold spans on the same prose
     line render independently (no bleed)' — strongs[0] now correctly expects '1. TEXT' with a
     nested <del>TEXT</del>, not literal '1. -TEXT-' dashes.
  4. Added new regression test 'wiki-bold-corrupts-text (round 2): strikethrough dashes nested
     inside a bold span render as <del>, not literal dashes' using the verbatim bug-report input
     `*1. -TEXT-*` — passes.
  5. Full WikiRenderer.test.tsx suite: 175/175 passed (was 174, +1 new test, 1 updated).
  6. Full project test suite (npx vitest run): 196 files, 2771 passed, 0 failed, 2 skipped
     (pre-existing, unrelated), 7 todo (pre-existing, unrelated) — no regressions introduced,
     including all existing horizontal-divider and named-link-strikethrough tests.
files_changed:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx (round 1: extracted convertInlineBoldItalic
    helper; extended normalizeTableCellInlineFormatting to apply the same non-greedy,
    link-protected bold/italic conversion to prose lines, not just table rows. round 2: added
    strikethrough-to-<del> conversion inside convertInlineBoldItalic with a *…/_…-excluding
    content class; reordered the `----`→<hr> divider fix to run before it)
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx (round 1: added regression test. round 2:
    updated that test's dash-content assertions + added a dedicated nested bold+strikethrough
    regression test)
