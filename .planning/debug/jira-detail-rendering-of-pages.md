---
status: resolved
trigger: "Something is broken about jira detail rendering of pages."
created: 2026-05-18
updated: 2026-05-18
---

# Debug Session: jira-detail-rendering-of-pages

## Symptoms

**Expected behavior:**
Jira wiki table markup renders all content correctly within the proper table cells. `\+` (backslash-escaped plus) renders as literal `+`. `\\` (double backslash) renders as `<br>` line breaks within table cells. Each row maps to its correct wiki source row.

**Actual behavior:**
1. `\+` is rendered as an HTML `<ins>` tag (or its stringified form `&lt;ins&gt;`/`&lt;/ins&gt;`) instead of literal `+`
2. Row 3's step cell content after `\(popis \+ modal\):` gets broken into separate table rows — the `\\`-separated lines (Pro Biznis S/M/L/XL/XXL prices) fall into their own `<tr>` elements instead of staying as `<br>`-separated content within the cell
3. Row 2 step shows `(karticky &lt;ins&gt; modal)` and row 3 shows `(popis &lt;/ins&gt; modal):` — suggesting `\+` from row 2 and row 3 are being paired as underline open/close across cell boundaries

**Input (Jira wiki markup):**
```
||*S.No.*||*Step*||*Expected Result*||*Actual Result*||
|1. |Nacitanie eshop home page |Kontrola OK |Works as expected|
|2. |Kontrola cien bez DPH \- pausaly \(karticky \+ modal\): \\ Pro Biznis S = 17,89 € \\ Pro Biznis M = 23,58 € \\ Pro Biznis L = 31,71 € \\ Pro Biznis XL = 39,84 € \\ Pro Biznis XXL = 58,54 € |Kontrola OK |Works as expected \\{panel}...{panel}|
|3. |Kontrola cien bez DPH \- katalog \(popis \+ modal\): \\ Pro Biznis S = 17,89 € \\ Pro Biznis M = 23,58 € \\ Pro Biznis L = 31,71 € \\ Pro Biznis XL = 39,84 € \\ Pro Biznis XXL = 58,54 € |Kontrola OK |Neprepinaju sa cenzy s/bez DPH.|
|4. |{color:#d04437}*FAILED:*{color} ...|*Kontrola OK* |...|
```

**Actual rendered HTML (broken):**
- Row 2 step: `Kontrola cien bez DPH - pausaly (karticky &lt;ins&gt; modal)` (truncated, missing `\\` price lines)
- Row 3 step: `Kontrola cien bez DPH - katalog (popis &lt;/ins&gt; modal):` + empty cells
- Extra rows after row 3 containing just price items: `Pro Biznis S = 17,89 €`, `Pro Biznis M = 23,58 €`, etc. as separate `<tr>` each

**Timeline:** Unknown when it started.

**Reproduction:** Render a Jira wiki table where a cell contains `\+` (escaped plus) and `\\` (line break) together.

## Current Focus

hypothesis: "Two independent bugs in preprocessJiraMarkup in WikiRenderer.tsx: (1) \+ is not handled before jira2md, leaving bare + that pairs across cells as underline; (2) \\ in single-line table rows is converted to a newline by the global hard-break pass, breaking GFM table structure."
test: "Confirmed by regression tests."
expecting: "Both bugs fixed."
next_action: "resolved"

## Evidence

- timestamp: 2026-05-18T22:00:00Z
  type: code_read
  file: taskflow/src/routes/dashboard/WikiRenderer.tsx
  finding: "jira2md line 59: `.replace(/\+([^+]*)\+/g, '<ins>$1</ins>')` — global, operates on full string across cell boundaries. No handling of Jira's \+ escape anywhere in preprocessJiraMarkup."

- timestamp: 2026-05-18T22:00:00Z
  type: code_read
  file: taskflow/src/routes/dashboard/WikiRenderer.tsx lines 632-633
  finding: "Global `\\\\` → `  \\n` conversion applies to ALL lines including table data rows. mergeOpenTableRows only converts `\\\\` to `<br/>` for multi-line rows it merges; single-line rows (already ending with |) are passed through unchanged and hit this global conversion, inserting a newline mid-row."

## Eliminated

- jira2md version issue — jira2md is not the problem, the pre-processing pipeline is

## Resolution

root_cause: "Two bugs in preprocessJiraMarkup: (1) Jira's `\+` escape sequence (literal plus) is not handled — jira2md's global `/\+([^+]*)\+/` underline rule pairs the bare `+` from row 2 with `+` from row 3 across cell boundaries, producing cross-cell `<ins>` tags; (2) the global `\\` → markdown hard-break conversion (lines 632-633) inserts `\n` inside single-line table rows that end with `|`, which mergeOpenTableRows never processed, breaking the GFM table structure."

fix: "Two additions to preprocessJiraMarkup in WikiRenderer.tsx: (1) added `result = result.replace(/\\\+/g, '&#43;')` immediately after brace-quoted bold/italic handling — converts `\+` to HTML entity `&#43;` before jira2md sees it; (2) added a line-based pass after normalizeTableCellInlineFormatting that converts `\\` to `<br/>` in table data rows (lines starting with `|` but not `||`) before the global `\\` → markdown hard-break conversion runs."

verification: "114/114 tests pass in WikiRenderer.test.tsx including 3 new regression tests: (a) `\+` renders as literal `+` not `<ins>`; (b) `\\` in single-line table row renders as `<br/>` not a row split; (c) full fixture with both escapes in same rows produces correct row count and text."

files_changed: "taskflow/src/routes/dashboard/WikiRenderer.tsx, taskflow/src/routes/dashboard/WikiRenderer.test.tsx"
