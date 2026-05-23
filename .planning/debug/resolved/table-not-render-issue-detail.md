---
name: table-not-render-issue-detail
status: resolved
trigger: "This table doesnt render in issue detail at all"
created: 2026-05-18
updated: 2026-05-18
---

## Symptoms

- **Expected:** Markdown table renders as a formatted HTML table with rows and columns
- **Actual:** Raw markup shows — pipes and dashes appear as literal text instead of being rendered
- **Error messages:** None reported
- **Timeline:** Some tables render correctly, some don't — this specific one does not
- **Reproduction:** Issue description contains a table that follows Jira image macros with dimension options

## Reproduction Input

Actual Jira source (multi-line, with image macros):
```
h1. Vysledok analyzy
h2. Strucny popis aktualneho stavu

Mame 3 systemy v eshope: Mpc, Ost, Rework

!aktualny-stav.png|width=899,height=770!
h2. Chceny stav

Chceme novy system...

!checkouty.png|width=851,height=718!
h2. Novy system sa bude nazyvat LST - Local Sales Tool
|*Nazov systemu*|*Odkial ma data*|*Kto kalkuluje offer*|*Kto zobrazuje offer*|
|Mpc|_Mpc_|_Noe_|_Noe_|
|Ost|_Ost_|_Ost_|_Noe_|
|Lst|_Noe_|_Noe_|_Noe_|
```

## Current Focus

hypothesis: "RESOLVED"
next_action: "none"
test: ""
expecting: ""
reasoning_checkpoint: ""
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-18
  observation: "splitInlineSingleLineTables correctly splits the fixture into multi-line form. Output: prefix line, blank line, header row (22-col empty), separator row (21-col ---), 4 data rows."
  interpretation: "Split logic is correct. jira2md then transforms '## ' prefix into a list item ('   1. Novy system...'). Table rows pass through jira2md unchanged."

- timestamp: 2026-05-18
  observation: "remark-gfm does not render the table when it immediately follows a list item with no blank line. The table header row is absorbed into the list item continuation."
  interpretation: "Root cause: no blank line between prefix and first table row after split. remark-gfm requires a blank line to start a table in a fresh block context when it follows a non-table block."

- timestamp: 2026-05-18
  observation: "injectHeaderlessTableSeparators look-ahead fix confirmed correct: with nextIsSeparator check, no spurious injection occurs for the reconstructed table."
  interpretation: "Secondary fix is correct and needed."

- timestamp: 2026-05-18
  observation: "Cycle 2: user provided actual Jira source. jira2md bold regex /\\*(\\S.*)\\*/g and italic regex /_(\\.S.*)_/g are greedy and cross | cell separators. |*Nazov systemu*|*Odkial ma data*| becomes |**Nazov systemu*|*Odkial ma data**| (jira2md output). Table still renders structurally but cell content is garbled."
  interpretation: "Root cause for cycle 2: jira2md's greedy bold/italic regexes corrupt table cells that use |*bold*| or |_italic_| Jira inline formatting."

- timestamp: 2026-05-18
  observation: "Full pipeline simulation confirms: injectHeaderlessTableSeparators correctly injects | | | | | and |---|---|---|---| before the first data row. After jira2md, the table has correct GFM structure but corrupted cell content."
  interpretation: "The table DOES render (remark-gfm table tokenizer splits by | first, then parses each cell independently). The fix needed is per-cell inline formatting normalization before jira2md."

- timestamp: 2026-05-18
  observation: "normalizeTableCellInlineFormatting added: bracket-aware cell split, link placeholders to protect [display|url] content, bold *text* → <strong>text</strong> and italic _text_ → <em>text</em> (HTML output bypasses jira2md double-conversion). All 101 tests pass."
  interpretation: "Fix is complete and verified."

## Eliminated Hypotheses

- "The markdown parser requires tables to span multiple lines" — partially true, but the split function addresses this. The actual blocker was the missing blank line before the table block.
- "injectHeaderlessTableSeparators double-injection was the only problem" — false; the look-ahead fix was necessary but not sufficient. The blank line separator between prefix and table was also required.
- "Image macro !filename.png|width=N,height=N! breaks rendering of subsequent content" — false; the | in the URL params does not cause remark-gfm to misparse. The image macro handling is improved unconditionally to strip options, but it was not the root cause of the table rendering failure.

## Resolution

root_cause: "jira2md's bold regex /\\*(\\S.*)\\*/g and italic regex /_(\\.S.*)_/g are greedy and operate on the full input string across | cell separators. When a Jira table row uses |*bold*|*more bold*| or |_italic_|_more italic_| syntax, jira2md matches from the first * or _ to the last across all cells, corrupting cell content. Additionally, image macros with dimension options (!filename.png|width=N,height=N!) were only stripped when an attachments map was provided; without one they fell through to jira2md with garbage URL params."
fix: "Two fixes in WikiRenderer.tsx: (1) New normalizeTableCellInlineFormatting function: bracket-aware per-cell split, [display|url] link placeholders to protect URL underscores, Jira bold *text* → <strong>text</strong> and italic _text_ → <em>text</em> (HTML output bypasses jira2md re-processing), runs after injectHeaderlessTableSeparators and before jira2md. (2) Image macro regex now runs unconditionally (not gated on attachments being non-empty); when filename is not in the attachment map, options are stripped and !filename! is emitted for clean jira2md processing."
verification: "101/101 tests pass including 5 new E2E tests for the actual Jira source fixture, bold/italic per-cell rendering, and image macro option stripping."
files_changed: "taskflow/src/routes/dashboard/WikiRenderer.tsx, taskflow/src/routes/dashboard/WikiRenderer.test.tsx"
