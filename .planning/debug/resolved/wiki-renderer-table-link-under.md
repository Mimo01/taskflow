---
name: wiki-renderer-table-link-under
status: resolved
trigger: "There is a problem with WikiRenderer on issue detail. In this table the first link gets rendered with '*' instead of '_'."
created: 2026-05-18
updated: 2026-05-18
---

## Symptoms

- **Expected behavior:** Clickable link with underscore preserved in URL (e.g. hash like Ve_ZplpPeXug renders correctly with _ intact)
- **Actual behavior:** The `_` character in the URL renders as `*` (asterisk), causing visual corruption
- **Error messages:** No JS errors — just silent visual corruption
- **Timeline:** Unknown — not confirmed if ever worked
- **Reproduction:** View issue detail with a Jira/wiki table containing pipe-separated links in format `[url1|url2]` inside table cells; the link URL underscores corrupt to asterisks, but only in table cells specifically

## Sample input triggering the bug

```
|0905473496|Go Biznis 22 eur|[https://www.orange.euro/e-shop-beta/rychla-vymena?hash=1D_D5LJtmN2Xr1bQQRvAcywIXXCd7fBCUz3Ve_ZplpPeXug=#ponuka|https://www.orange.euro/e-shop/rychla-vymena?hash=1D_D5LJtmN2Xr1bQQRvAcywIXXCd7fBCUz3Ve_ZplpPeXug=#ponuka]|
```

The `_` in `Ve_ZplpPeXug` and `1D_D5LJtmN2Xr1bQQRvAcywIXXCd7fBCUz3Ve_ZplpPeXug` renders as `*`.

## Current Focus

```yaml
hypothesis: "CONFIRMED — jira2md applies italic transformation globally before extracting link parts"
test: "Traced in jira2md/index.js line 53: .replace(/_(\S.*)_/g, '*$1*') runs before Named Links regex"
expecting: "n/a — resolved"
next_action: "done"
```

## Evidence

- timestamp: 2026-05-18T11:00:00Z
  type: code-trace
  finding: >
    jira2md `to_markdown()` applies its italic rule `/_(\S.*)_/g → '*$1*'` at
    step 4 of a 14-step chain, before the Named Links rule `[(.+?)|(.+?)]` at
    step 13. Verified via node REPL: input `[Name|https://x.com/1D_D5_ZplpPeXug]`
    produces `[Name](https://x.com/1D*D5*ZplpPeXug)` — the paired underscores
    in the URL are converted to asterisks by the italic pass.
  affected: both href and URL-as-display-text portions

- timestamp: 2026-05-18T11:00:00Z
  type: scope
  finding: >
    The corruption affects ALL [display|url] links where the URL or display text
    contains two or more underscores — not limited to table cells. The "table
    only" perception in the original report was because the test fixtures outside
    tables happened to use single-underscore URLs.

## Eliminated Hypotheses

- "Only in table cells" — false; the jira2md italic regex is global, affects all contexts

## Resolution

```yaml
root_cause: >
  jira2md's italic transformation regex `/_(\S.*)_/g` runs globally across the
  entire input string — including inside `[display|url]` link syntax — before
  the Named Links regex extracts the link parts. Any URL containing two or more
  underscores has its first and last `_` treated as italic delimiters, converting
  the content between them from `_…_` to `*…*`. This corrupts both the href and
  the display text (when display text is itself a URL) in the resulting markdown
  link `[text](url)`.
fix: >
  Added `fixMarkdownLinkUnderscores()` post-processor in WikiRenderer.tsx.
  Applied immediately after `j2m.to_markdown()` and before react-markdown.
  Scans the markdown output for `[text](url)` links and reverts `*` → `_` in
  (1) the URL portion always — `*` is not a valid URL character in practice,
  (2) the display text only when it is itself a URL (starts with http:// or
  https://) — preserves intentional bold/italic markdown in human-readable labels.
verification: >
  55/55 WikiRenderer tests pass including 6 new tests in the
  'underscore preservation in link URLs' describe block covering: verbatim bug
  fixture, single underscore (no-op), two underscores, bold label not affected,
  headed table, and plain prose outside table.
files_changed:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
```
