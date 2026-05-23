---
slug: underscore-to-asterisk-outside
status: resolved
trigger: We have recently fixed rendering problem of * vs _ in links in tables. The same problem still appears outside of tables
created: 2026-05-18
updated: 2026-05-18
---

## Symptoms

- **Expected:** URL in Jira wiki `[URL]` bracket syntax renders with underscores preserved — e.g. `https://...?hash=L_0mIHoqvPqgwUAu6FML8le7k8K_uXCDZ8OUVHEeqnheLRQ%3D`
- **Actual:** Underscores `_` in URLs are replaced with asterisks `*` — e.g. `https://...?hash=L*0mIHoqvPqgwUAu6FML8le7k8K*uXCDZ8OUVHEeqnheLRQ%3D`
- **Reproduction content:** `[https://www.orange.euro/e-shop-beta/vymena-internetu-a-televizie/rychla-vymena?hash=L_0mIHoqvPqgwUAu6FML8le7k8K_uXCDZ8OUVHEeqnheLRQ%3D]`
- **Affected locations:** Plain paragraph text, list items, headings, blockquotes (everywhere outside tables)
- **Timeline:** Unknown — the table fix may or may not have introduced this; was always present outside tables
- **Context:** A similar fix was previously applied for `*` vs `_` rendering inside tables; the same issue persists outside tables

## Current Focus

hypothesis: resolved
test: 3 new tests added and passing
expecting: n/a
next_action: none

## Evidence

- timestamp: 2026-05-18
  what: Traced jira2md output for `[URL]` (URL-only) bracket syntax
  result: jira2md emits a markdown **autolink** `<https://...>` (not `[text](url)`) for URL-only bracket syntax. The italic pass (`_text_` → `*text*`) corrupts underscores in the URL before the autolink token is formed, producing `<https://...L*0mIH...K*uXCDZ...>`.
  conclusion: The existing `fixMarkdownLinkUnderscores` function only handled the `[text](url)` form via regex `\[([^\]]*)\]\(([^)]*)\)`. It did not match autolinks at all.

- timestamp: 2026-05-18
  what: Distinguished `[display|url]` vs `[URL]` jira2md output forms
  result: `[display|url]` → `[display](url)` — already fixed. `[URL]` → `<https://...>` — not fixed until now.
  conclusion: Root cause is the missing autolink arm in fixMarkdownLinkUnderscores.

## Eliminated

- Table-context fix scope: the previous fix was correct for `[text](url)` links in both table and non-table contexts. The gap was purely the autolink form `<https://...>` produced by `[URL]` syntax.

## Resolution

root_cause: jira2md emits `<https://…>` markdown autolink syntax for `[URL]` bracket tokens (URL-only, no display text). The existing `fixMarkdownLinkUnderscores` post-processor only restored `*` → `_` in `[text](url)` links (regex `\[…\]\(…\)`) and had no arm for autolinks, leaving the jira2md italic-corruption (`_` → `*`) unrepaired in all non-table URL-only links.
fix: Added a second `.replace()` pass in `fixMarkdownLinkUnderscores` that matches `<https?://…>` autolinks and restores `*` → `_` in the URL body. Three new tests added covering the verbatim reproduction URL, a two-underscore URL, and a list-item URL — all passing.
verification: 73/73 tests pass in WikiRenderer.test.tsx
files_changed:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx (fixMarkdownLinkUnderscores — added autolink arm)
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx (3 new tests in 'underscore preservation' describe block)
