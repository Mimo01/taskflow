---
status: resolved
trigger: "Gap 3 — Nested wiki ({panel} with embedded [name|url] list) — images work but layout is still kind of broken. Table doesn't break mid-table any more, but the panel is not rendered in one cell of the table — it overflows and breaks layout in the section where it is located."
created: 2026-05-14T20:30:00Z
updated: 2026-05-18T00:00:00Z
---

## Current Focus

hypothesis: The `<span data-callout="panel">` produced by `flattenInlineCalloutsForTableRow` (taskflow/src/routes/dashboard/WikiRenderer.tsx:86) survives jira2md and HAST parsing as an INLINE phrasing element inside `<td>`. But the inner markdown (`# [VAS.png|...]`) is converted by jira2md into a block construct (heading `# …`) — and even after sanitisation, react-markdown/rehype-raw produce a BLOCK-LEVEL child (e.g. `<p>`, `<h1>`, or the literal `#` followed by an anchor) inside the inline `<span>`. The `inline-block` span CSS (line 290) gives the span itself only its content-box width inside the `<td>`, but the block-level child forces a line-break and the panel's `p-3 my-2` margin/padding push the panel visually outside the cell flow.
test: Step through the produced markdown for the verbatim ESHOP fixture from 54-PROBE-FINDINGS.md Probe E and confirm what HTML lands inside the `<span data-callout="panel">` after `flattenInlineCalloutsForTableRow` -> `j2m.to_markdown` -> rehypeRaw/rehypeSanitize.
expecting: The span contains a block-level child (most likely a `<p>` from the markdown processor wrapping the `[VAS.png|...]` link, or a heading element because `# [VAS.png|url]` is a Jira H1 line). That child being block-level inside an inline `<span>` will cause the visual overflow even though the test asserts panel-inside-td.
next_action: Re-read mergeOpenTableRows and trace what the joined+flattened row looks like for the verbatim Probe E fixture; specifically look at what happens to the `# [VAS.png|url]` content when wrapped in `<span data-callout="panel">…</span>` inside a `|td|` cell.

## Symptoms

expected: ESHOP issue whose failed test runs contain step content with a {panel} wiki block embedded inside a |cell| of a wiki table row should render the panel content INSIDE the table cell. Layout intact. Anchor (e.g. VAS.png) opens in-app ImageLightbox.
actual: "images work but the layout is still kind of broken. The table doesnt break in the middle like it used to but the pannel is not rendered in one cell of a table but overflows and breaks the layout in the section of the table where it is located"
errors: none (visual layout regression)
reproduction: Open ESHOP issue 393120 (or any with verbatim Finding-1-shaped step content). Inspect the failed-step row of the rendered step table in AIO section.
started: After 54-07 Branch 3-A shipped — improved from 54-06 UAT (table no longer breaks mid-table), still broken at 2026-05-14 UAT (panel escapes cell).

## Evidence

- timestamp: 2026-05-14T20:31:00Z
  checked: WikiRenderer.tsx flattenInlineCalloutsForTableRow + mergeOpenTableRows
  found: For the verbatim Probe E fixture, the open row body is `|2. |...splatky... \n {panel}\n# [VAS.png|URL]\n{panel}|`. flattenInlineCalloutsForTableRow replaces `{panel}\n# [VAS.png|URL]\n{panel}` with `<span data-callout="panel"># [VAS.png|URL]</span>` (after `\n -> <br/>` then trim — the inner content becomes `<br/># [VAS.png|URL]<br/>` or similar, NOT a markdown-newline). Actually: inner = `\n# [VAS.png|URL]\n` → replace `\n` with `<br/>` → `<br/># [VAS.png|URL]<br/>` → trim() drops nothing → final inner = `<br/># [VAS.png|URL]<br/>`.
  implication: The inner content is a literal `# [VAS.png|URL]` between two `<br/>` tags. Jira2md sees this AS PART of a single table row line, so `# ...` is not at column 0 of a logical line — but jira2md's tokenizer for cells likely treats `#` as literal text (not a heading) inside a `|cell|`. The actual markdown emitted will have `[VAS.png|URL]` which jira2md converts to `[VAS.png](URL)`.

- timestamp: 2026-05-14T20:32:00Z
  checked: jira2md handling of `[name|url]` inside table cell
  found: jira2md converts `[VAS.png|URL]` to markdown link `[VAS.png](URL)`. Inside the cell, after preprocessing the row looks roughly like: `|2. |{color:#d04437}*FAILED:*{color} ...splatky... <span data-callout="panel"><br/># [VAS.png|URL]<br/></span>|`. After jira2md: the `<span>` is preserved as raw HTML; `[VAS.png|URL]` is link syntax. The `# ` prefix inside the span — between two `<br/>` — becomes literal `#` (markdown headings only match at start of a line, not inside an inline `<span>`).
  implication: So the markdown output is something like: `| 2.  | ...splatky... <span data-callout="panel"><br/># [VAS.png](URL)<br/></span> |`. Inside the `<td>` after remark-gfm parses the table cell, the `<span>` is raw HTML inline content; rehypeRaw parses it as HAST; rehype-sanitize allows `span[data-callout]` per the schema (line 36). So far structurally it should stay inside the cell.

- timestamp: 2026-05-14T20:33:00Z
  checked: span callout CSS — line 290 className `inline-block ${calloutStyles[calloutType]}`. calloutStyles.panel = `border-l-4 border-border bg-muted/50 p-3 rounded-r-md my-2`
  found: The `panel` callout class includes `p-3 my-2`. `p-3` adds 12px padding on all sides. `my-2` adds 8px top/bottom margin. The base class adds `inline-block`. An `inline-block` span with `p-3 my-2` inside a `<td>` should fit, BUT the table cell width is constrained by the column header. The panel contents (a VAS.png link rendered as text) shouldn't be wider than the cell.
  implication: Even with inline-block, if the cell column is narrow, padding + my-2 vertical margin on the inline-block + the inline-block being placed after the rest of the cell's prose forces the row height to grow. Tailwind's `my-2` on inline-block does apply vertical margin and DOES affect line height. This alone shouldn't break OUTSIDE the cell, but it adds significant visual height.

- timestamp: 2026-05-14T20:34:00Z
  checked: Outer prose styling — line 359 `'prose prose-sm dark:prose-invert max-w-none'`
  found: `prose` Tailwind classes apply rich-text typographic styles globally inside the article element. `prose` adds margins to `<p>`, `<table>`, headings, and notably has rules for `<td>` content (the .prose theme's td styling).
  implication: The prose theme's defaults for `<a>`, `<p>`, `<br>` inside `<td>` may give vertical margins that interact poorly with the inline-block panel span. But more importantly: AioTestRunsSection.tsx renders the step table at the OUTER level (the full HTML wiki `||header||/|row|` table from the step content goes through WikiRenderer per cell? or as one big block?).

- timestamp: 2026-05-14T20:36:00Z
  checked: AioTestRunsSection.tsx step rendering — verification report cites lines 240-304 StepTable; each cell renders via `<WikiRenderer wikiText={step.step | expectedResult | actualResult} />` (verification lines 65, 261/264/271)
  found: Per the verification report (line 65): "3 cells render via WikiRenderer (lines 261, 264, 271)". So the OUTER table (Step/Expected/Actual/Status columns) is rendered by React-Table-like JSX in AioTestRunsSection.tsx. Each cell's content (which itself is a Jira wiki blob — including its own `||header||/|row|` wiki table) is fed to a separate WikiRenderer instance.
  implication: This means the Finding 1 fixture (a wiki TABLE inside step.step) is rendered INSIDE an outer React `<td>` from the OUTER AioTestRunsSection step table. So we have nesting: `<outer table><tr><td><article class="prose">...<inner wiki table from WikiRenderer>...</td></tr></outer table>`. The `prose max-w-none` allows the inner article to span the cell width. But the `prose` theme has td-padding rules, and TABLES inside prose have margin-top/bottom that visually break the outer cell layout.

- timestamp: 2026-05-14T20:38:00Z
  checked: How the Probe E fixture is actually fed — is the full fixture one `step.step` value? Or do the wiki table rows fan out to multiple StepTable rows?
  found: The Probe E / Finding 1 fixture IS one value of `step.step` (the entire `||header||/|row1|/|row2|...` block including the embedded `{panel}` IS the wiki content of ONE step's `step` field). So a SINGLE outer-table cell receives the entire multi-row wiki table as its WikiRenderer input.
  implication: Inside that single outer `<td>` (in AioTestRunsSection step table), WikiRenderer renders an `<article class="prose">` containing an inner `<table>` (the wiki table). That nested table has its own `<tr>`s and `<td>`s. The `{panel}` lives inside one of THOSE inner `<td>`s. The outer cell column has a constrained width — the inner table tries to fit inside. Tables don't shrink content; if the inner cells exceed the column width, the inner table will overflow its container.

- timestamp: 2026-05-14T20:40:00Z
  checked: CSS overflow behavior of nested tables in prose
  found: Default `<table>` has no `max-width` constraint — it grows to fit content. `prose` adds `max-width: 65ch` to the article, but `max-w-none` removes that. Without `overflow-x: auto` or `table-layout: fixed` on the inner table, the inner wiki table will be as wide as its widest cell content. The VAS.png URL is ~250+ chars when displayed as text in the panel's inline span. Even though the URL is hidden behind an `<a>VAS.png</a>` (so the visible text is just "VAS.png"), the cell content also includes the `<br/>` lines and the `inline-block` panel CSS.
  implication: This is the most likely cause: the INNER wiki table is wider than the OUTER `<td>` column allows. The inner table overflows horizontally, "breaking the layout in the section of the table where it is located". The panel just happens to be the WIDEST cell in the inner table (due to padding/margin/the long row), so it appears to "overflow the cell" — but it's actually the entire inner table overflowing its outer container.

- timestamp: 2026-05-14T20:41:00Z
  checked: Whether AioTestRunsSection or WikiRenderer applies overflow handling for nested tables
  found: WikiRenderer's outer `<article className="prose prose-sm dark:prose-invert max-w-none">` does NOT add `overflow-x-auto` or wrap tables in a scrollable container. No `table` override in markdownComponents either. AioTestRunsSection's outer step-table cell rendering uses standard tailwind `<td className="...">` (per verification line 65), and that outer cell does NOT wrap WikiRenderer in an `overflow-hidden`/`overflow-x-auto` div.
  implication: There is NO horizontal-overflow handling for the nested wiki table. When the inner wiki table grows wider than the outer cell, it overflows and visually breaks layout. The {panel} cell appearing to escape is a symptom of the inner table being wider than the outer column.

- timestamp: 2026-05-14T20:43:00Z
  checked: AioTestRunsSection.tsx StepTable cells at lines 260-272
  found: Outer step table = `<table className="w-full text-sm">` (line 242). The "Step" column outer `<td className="px-4 py-3">` (line 260) wraps WikiRenderer with NO overflow handling, NO `min-w-0`, NO `max-width`. Column widths are constrained by `w-48` (Expected, Actual = 192px) and `w-24` (Status = 96px); Step column gets the remainder of `w-full`. The Finding 1 fixture (entire wiki step blob with embedded {panel}) is passed as the value of `step.step`, so it goes into THIS Step column.
  implication: Confirmed: the bug is structural integration between AioTestRunsSection's outer step table cell and WikiRenderer's inner wiki-derived table. No `overflow-x-auto` anywhere in the chain.

- timestamp: 2026-05-14T20:44:00Z
  checked: jira2md output for the merged + flattened Probe E fixture (live probe)
  found: Live probe confirms jira2md emits a pipe-table where row 2's last cell (Actual Result) contains raw HTML: `<span data-callout="panel"><br/># [VAS.png](URL)<br/></span>`. The href URL is ~256 chars (URL-encoded params). The `# ` inside the span is NOT parsed as a markdown heading because it's inside an inline HTML element, not at column 0 of a markdown line — so it renders as literal `# ` followed by an anchor.
  implication: Structurally the markdown produces `<table><tr><td>...<span data-callout="panel"><br/># <a href="URL">VAS.png</a><br/></span></td></tr></table>`. The span IS inside the td. The bug is NOT structural — it's the lack of overflow handling on the outer container plus the panel CSS adding visual `p-3 my-2` weight to a content-rich cell.

## Eliminated

- hypothesis: rehype-sanitize strips wrapping (schema doesn't allow span[data-callout] inside td)
  evidence: wikiSanitizeSchema (line 26-41) explicitly allows `span` in tagNames and `dataCallout`/`dataTitle` on `span` attributes. Test at line 290-316 of WikiRenderer.test.tsx asserts `table?.querySelector('[data-callout="panel"]')` is non-null — sanitiser preserves the span.
  timestamp: 2026-05-14T20:32:00Z

- hypothesis: {panel} block becomes a `<div>` rather than `<span>` inside the table cell (block-level escapes `<td>`)
  evidence: `flattenInlineCalloutsForTableRow` (line 86) substitutes inside the merged table row body BEFORE `preprocessJiraMarkup`'s global `<div data-callout>` substitution sees the panel — by then the panel markers `{panel}…{panel}` inside the merged row are already replaced with `<span>`. The global `{panel} -> <div>` regex (line 222) only catches panel blocks OUTSIDE merged table rows. WikiRenderer.test.tsx 'Gap 3' (line 290-316) confirms `data-callout="panel"` survives as a `<span>` inside the rendered `<table>`. So inside the table, we get `<span>` not `<div>`. This hypothesis is wrong on the structural level.
  timestamp: 2026-05-14T20:33:00Z

## Resolution

root_cause: The visible "panel overflows / breaks the section of the table where it is located" is NOT the {panel} block escaping its <td>. The {panel} content (the inline `<span data-callout="panel">`) IS contained inside the inner wiki table's `<td>` (confirmed by the passing WikiRenderer.test.tsx Gap 3 assertion). The actual cause is: the **inner wiki table itself overflows the outer AioTestRunsSection step-table cell**. The Finding 1 fixture is fed as a single `step.step` blob into ONE outer step-table `<td>`. WikiRenderer renders that blob as an `<article class="prose">` containing an inner `<table>`. Neither WikiRenderer's outer article nor AioTestRunsSection's outer `<td>` provides `overflow-x: auto`, `max-width` constraint, or `table-layout: fixed` on the inner table. The `<span data-callout="panel">` adds padding (`p-3`) and vertical margin (`my-2`), making the panel cell visually the tallest cell in the inner table. With no overflow handling, when the inner table's total width exceeds the outer column's width (and column widths in the outer step table are typically constrained by header text lengths), the inner table overflows horizontally and the panel — being the visually "loudest" element with the colored border — APPEARS to escape its cell. The bug is the LAYOUT integration between the OUTER React step table (AioTestRunsSection) and the INNER wiki-derived table (WikiRenderer), not the preprocess heuristic.
fix: Apply ONE of (in order of least to most invasive):
  1. **Wrap WikiRenderer output's tables in an overflow container.** Add a `table` markdownComponent override in WikiRenderer.tsx that wraps the rendered `<table>` in `<div className="overflow-x-auto max-w-full">`, so nested wiki tables become independently scrollable inside any outer cell. This is the minimal targeted fix.
  2. **Constrain the outer step-table cell width AND tell inner tables to wrap.** In AioTestRunsSection.tsx's StepTable, wrap each WikiRenderer cell in `<div className="min-w-0 overflow-x-auto">` so the outer cell's flex/grid context lets it contract and scroll. Optionally add `table-fixed` + cell `break-words` to the inner table.
  3. **Force inline-only rendering for panels inside tables (no padding/margin).** Modify the `span data-callout` component override (line 284) to use a SLIM inline style (`px-1 border-l-2`) when the parent is a table cell — but React-markdown doesn't expose parent context easily, so this requires a context-aware wrapper or a different `data-callout` value (e.g. `data-callout="panel-inline"`) emitted by `flattenInlineCalloutsForTableRow`. More invasive.
  Recommended: **Fix 1 (table-wrap in WikiRenderer)** + **Fix 2 (min-w-0 around WikiRenderer in StepTable)**. Together they make the inner table scroll horizontally inside its outer column without breaking layout. Fix 3 is nice-to-have for visual polish but not required.
verification: confirmed — both fixes present in codebase
files_changed:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx (markdownComponents.table override with overflow-x-auto wrapper)
  - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx (min-w-0 on StepTable td cells)
