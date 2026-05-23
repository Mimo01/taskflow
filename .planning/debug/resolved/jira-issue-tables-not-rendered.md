---
slug: jira-issue-tables-not-rendered
status: resolved
trigger: manual
goal: find_and_fix
created: 2026-05-15
resolved: 2026-05-15
---

# Debug: Jira Issue Tables Not Rendered

## Symptoms

Tables in Jira issue descriptions are not rendered as HTML tables — they show as raw pipe-delimited text.

**Example raw content:**
```
B2B Voice rýchla výmena nebeží pre GoBiznis Tarif, nastava exception error
|0905473496|Go Biznis 22 eur|[https://www.orange.euro/e-shop-beta/rychla-vymena?hash=1D_D5LJtmN2Xr1bQQRvAcywIXXCd7fBCUz3Ve_ZplpPeXug=#ponuka|https://www.orange.euro/e-shop/rychla-vymena?hash=1D_D5LJtmN2Xr1bQQRvAcywIXXCd7fBCUz3Ve_ZplpPeXug=#ponuka]|
|0908807289|Go Biznis 22 eur|[https://www.orange.euro/e-shop-beta/rychla-vymena?hash=sguz9x2tADepPGmwGs9jV940v_ukLPYxnfaoZerasZY0mVY=#ponuka|https://www.orange.euro/e-shop/rychla-vymena?hash=sguz9x2tADepPGmwGs9jV940v_ukLPYxnfaoZerasZY0mVY=#ponuka]|
```

**Key detail:** Table cells contain Jira named-link syntax `[display text|url]` which itself contains a pipe character.

- **Expected:** HTML table rendered from pipe-delimited rows
- **Actual:** Raw text shown as-is, no table rendered
- **Errors:** None visible in console

## Current Focus

Resolved.

## Evidence

- `WikiRenderer.tsx` uses `jira2md` + `remark-gfm` to render Jira wiki markup
- `jira2md` only emits GFM `| --- | --- |` separator row when it encounters a `||header||` row
- Rows with only `|data|` (no header) are passed through unchanged
- `remark-gfm` requires a header+separator to recognise pipe-delimited lines as a table
- Without the separator, the lines render as plain text paragraphs

## Investigation Log

1. Located `WikiRenderer.tsx` — rendering pipeline: `preprocessJiraMarkup` → `j2m.to_markdown()` → `<Markdown remarkPlugins={[remarkGfm]}>`.
2. Confirmed `mergeOpenTableRows` passes the single-line data rows through unchanged (they start and end with `|`).
3. Confirmed jira2md converts `[display|url]` to `[display](url)` correctly — the pipe inside named-links is NOT the primary issue.
4. Confirmed jira2md only emits the GFM separator (`| --- | --- |`) when a `||header||` source row is present.
5. Confirmed remark-gfm requires a header+separator to render a table; without it, the pipe-delimited lines are plain text.
6. Fix: added `injectHeaderlessTableSeparators()` to `preprocessJiraMarkup`, which inserts a synthetic empty-header+separator before any run of `|data|` rows not preceded by a `||header||` row. Column counting is bracket-aware to handle `[text|url]` named-links correctly.

## Resolution

- root_cause: Jira tables with only data rows (`|cell|cell|`) and no `||header||` row are not recognised as GFM tables by remark-gfm, because jira2md only emits the required `| --- |` separator when it sees a header row. The rows render as plain text.
- fix: Added `injectHeaderlessTableSeparators()` in `preprocessJiraMarkup` (runs after `mergeOpenTableRows`). It inserts a synthetic empty-header row and separator before each run of headerless data rows, with bracket-aware column counting so `[display|url]` named-links do not inflate the column count. All 49 tests pass (7 new tests added).
