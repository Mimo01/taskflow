---
status: open
session: 2026-05-14T09:25:00Z
phase: 54-aio-on-issue-detail
related:
  - .planning/debug/panel-overflows-table-cell.md (round 1 — fixed by 54-08 commit 9862672, but residual breakage remains)
fix_attempts:
  - plan: 54-07
    commit: previously
    approach: Branch 3-A — `mergeOpenTableRows` + `flattenInlineCalloutsForTableRow` heuristics
    outcome: panel containment improved but cell content still escapes
  - plan: 54-08
    commit: 9862672
    approach: CSS-layer fix — `WikiRenderer.markdownComponents.table` overflow-x-auto wrapper + `min-w-0` on StepTable `<td>` wrappers
    outcome: visual loudness softened (no full-page widening) but table layout STILL fractures around the multi-line cell + panel
evidence:
  expected: .planning/phases/54-aio-on-issue-detail/screenshots/gap3-round2-expected.png
  actual: .planning/phases/54-aio-on-issue-detail/screenshots/gap3-round2-actual.png
---

# Gap 3 Round 2 — Panel + multi-line cell STILL breaks the table

## Symptom (round 2, after 54-08 fix)

Side-by-side from user screenshots on the ESHOP issue with the Finding 1 fixture:

**Expected (Jira's native wiki render — gap3-round2-expected.png):**
- Clean 4-column table: `S.No. | Step | Expected Result | Actual Result`
- Row 2 contents stay inside their cells:
  - `Step` cell: `FAILED: Plati pre paušály S, M, L:` on one line, `• 5 GB (12657037, 5,13 €)` on a continuation line — both INSIDE the Step cell
  - `Expected Result` cell: `Kontrola OK`
  - `Actual Result` cell: `V kosiku mam Pro Biznis M a device na splatky. Nikde nedostanem vsak moznost ziskat 5GB za 5,13e.` followed by a properly-nested numbered list inside a grey panel: `1. VAS.png` `2. Kosik.png` — all INSIDE the Actual Result cell

**Actual (current Taskflow render — gap3-round2-actual.png):**
1. **Row 2 fractures vertically.** The continuation line `• 5 GB (12657037, 5,13 €)` appears as a SEPARATE row beneath the row containing `FAILED: Plati pre paušály S, M, L:`. Visually the table grows an extra phantom row.
2. **Columns shift on the fractured continuation.** `Kontrola OK` (Expected) and the Actual cell content land in the wrong columns relative to the header.
3. **The panel content partially renders inside the cell.** The first item (`# VAS.png`) appears with the grey panel background mid-paragraph inside what should be the Actual cell — but it's been demoted from a numbered list item (`1.`) to a single text anchor with a panel border around it.
4. **The second panel item ESCAPES the table entirely.** `# Kosik.png` renders as a standalone underlined link BELOW the entire step table, fully outside any cell.

## Why the 54-08 fix wasn't enough

Plan 54-08 commit 9862672 addressed visual overflow (inner table wider than outer column):
- `WikiRenderer.markdownComponents.table` wraps in `<div className="overflow-x-auto max-w-full">`
- `AioTestRunsSection.StepTable` `<td>` wrappers gained `min-w-0`

That fix targeted the wrong layer. The actual bug is **parser/structural**, not CSS overflow. The cell content is escaping the cell at the markdown AST level, before any layout happens. No amount of overflow-x-auto on the rendered `<table>` can put `# Kosik.png` back inside its source `<td>`.

## Likely root cause (hypothesis — needs source verification)

Three independent parser concerns layered on top of each other:

### Concern A — `mergeOpenTableRows` may not be consuming the full panel-bearing row

The merger (`WikiRenderer.tsx:116-153`) forward-scans up to 50 lines from a row that starts with `|` and doesn't end with `|`, looking for the next line that ends with `|` AND has an even count of `{panel}` markers seen so far. For the suspected fixture:

```
|2.|FAILED: Plati pre paušály S, M, L:
• 5 GB (12657037, 5,13 €)|Kontrola OK|V kosiku mam ... ziskat 5GB za 5,13e.
{panel}
# [VAS.png|url]
# [Kosik.png|url]
{panel}|
```

The merger SHOULD consume all six lines into one merged row. Whether it does depends on whether `PANEL_TAG_RE` matches both `{panel}` opens and closes (look at the regex definition — if it only matches opens, the count never balances and the merger gives up at `MAX_LOOKAHEAD=50`).

**Verification needed:** print `PANEL_TAG_RE.source` from `WikiRenderer.tsx`. If it matches only `\{panel\}` literal (both opens and closes — count = 2 → even), the merger should work. If it only matches `\{panel\b[^}]*\}` (still both), same result.

### Concern B — wiki link `[name|url]` inside the merged row breaks markdown table parsing

After `flattenInlineCalloutsForTableRow` substitutes `{panel}...{panel}` to `<span data-callout="panel">...</span>`, the inner content `# [VAS.png|url]<br/># [Kosik.png|url]` still contains literal `|` characters from the wiki link syntax `[name|url]`. When jira2md converts this to a markdown table cell, the `|` is NOT escaped. Downstream react-markdown's gfm-table extension treats every unescaped `|` as a column separator, splitting the Actual cell value at `[VAS.png` and pushing `url]<br/># [Kosik.png|url]` into a phantom column 5+.

The Step cell `FAILED: Plati pre paušály S, M, L:\n• 5 GB (12657037, 5,13 €)` also has unescaped `|` in `• 5 GB|Kontrola OK` after the merger flattens `\n` → ` ` — but here the `|` is a real table separator, not part of content, so this part is fine.

**Fix candidate:** In `flattenInlineCalloutsForTableRow`, also escape `|` inside the substituted span content (`.replace(/\|/g, '\\|')`) so markdown table parser doesn't treat them as separators.

### Concern C — wiki numbered list `# item` inside the panel needs to stay a numbered list

The Expected render shows the panel as a proper `<ol><li>VAS.png</li><li>Kosik.png</li></ol>`. The current flattener produces `# [VAS.png|url]<br/># [Kosik.png|url]` which:
- Loses the list semantics (it's not an `<ol>`)
- Has bare `#` characters that markdown might re-interpret as headings (downstream of the `<span>`)

**Fix candidate:** In `flattenInlineCalloutsForTableRow`, detect lines starting with `# ` inside the panel body and convert them to `<li>` elements wrapped in `<ol>`:
```
{panel}
# [VAS.png|url]
# [Kosik.png|url]
{panel}
```
→
```
<span data-callout="panel"><ol><li>[VAS.png|url]</li><li>[Kosik.png|url]</li></ol></span>
```
Then the `[VAS.png|url]` wiki links pass through to jira2md → markdown as proper anchor refs, with the `|` escaping applied.

## Out-of-scope alternatives considered

- **Swap parser (Branch 3-C — switch from j2m to mwparserfromhell or a Jira-specific lib):** out of scope per 54-07 Branch 3-A decision. Stays out of scope for round 2.
- **Custom `<td>` renderer (Branch 3-B):** previously rejected because it requires re-implementing wiki-cell rendering. Re-rejected — preprocessing is the lighter touch.

## Recommended next steps

1. Capture the verbatim wiki source for this issue's failed-step (from AIO API response or DevTools network tab) — needed to confirm fixture matches the Concern A / B / C analysis.
2. Plan 54-09 (gap-closure) should land:
   - Fix Concern B (escape `|` in flattened callout spans) — likely necessary regardless
   - Fix Concern C (preserve `# item` numbered list semantics inside panels)
   - Verification: re-run failed-step rendering against the captured fixture; visually compare against Jira's native render
3. Add a regression test in `WikiRenderer.test.tsx` using the verbatim fixture (not just the abbreviated Probe E version) — current tests pass on the abbreviated fixture but the real fixture has details the tests don't cover.

## Test coverage gap

The existing Plan 54-08 Gap 3 regression test (`WikiRenderer.test.tsx`) asserts only that an `overflow-x-auto` ancestor exists around the rendered `<table>`. It does NOT assert:
- Row count (would catch the fractured-row symptom)
- Cell content membership (would catch the `# Kosik.png` escape)
- Numbered list semantics inside the panel (would catch the demoted `#` → bare text)

The existing `data-callout="panel"` containment test asserts structural containment of the panel `<span>` inside the inner `<td>`, but that test fixture is the abbreviated Probe E shape, not the verbatim real-issue fixture with the multi-line cell + numbered list inside the panel.

## Status

`open` — diagnosis complete pending source verification. Routed to plan 54-09 via `/gsd:plan-phase 54 --gaps`.
