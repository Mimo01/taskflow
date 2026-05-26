---
name: wiki-url-not-clickable
status: resolved
trigger: "In wiki renderer on jira issue detail the following: {{[https://www.orange.sk/e-shop/orange-mobilny-internet?click=int-mbb]}} is rendered as: `<https://www.orange.sk/e-shop/orange-mobilny-internet?click=int-mbb>` — make it a proper clickable link"
created: 2026-05-26
updated: 2026-05-26
---

## Symptoms

- **Expected:** `{{[https://www.orange.sk/e-shop/orange-mobilny-internet?click=int-mbb]}}` should render as a clickable hyperlink
- **Actual:** Rendered as raw text `<https://www.orange.sk/e-shop/orange-mobilny-internet?click=int-mbb>` (angle-bracket wrapped, not a link)
- **Error messages:** None — it renders without error, just incorrectly
- **Timeline:** Unknown — discovered on Jira issue detail page
- **Reproduction:** Open a Jira issue detail page that contains wiki markup with a URL in `{{[URL]}}` format

## Current Focus

hypothesis: CONFIRMED — `{{[URL]}}` is Jira monospace syntax wrapping a bare URL link. jira2md converts `{{...}}` to a backtick inline-code span; the `[URL]` inside becomes `<URL>` (angle-bracket autolink) but since it is now INSIDE a code span, react-markdown renders the angle brackets as literal text, not a hyperlink.
test: n/a — root cause confirmed by code trace
expecting: n/a
next_action: fix applied
reasoning_checkpoint: jira2md processes `{{...}}` as monospace (backtick code). Inside code, `[URL]` → `<URL>` markdown autolink, but markdown autolinks inside code spans are not processed — they render as raw text `<URL>`. Fix: strip `{{` `}}` wrappers around `[URL]` bracket-only syntax in preprocessJiraMarkup before jira2md, so jira2md sees a plain `[URL]` and emits a proper `<URL>` autolink outside any code context.
tdd_checkpoint:

## Evidence

- WikiRenderer.tsx line 947: pipeline is `preprocessJiraMarkup` → `j2m.to_markdown()` → `fixMarkdownLinkUnderscores` → react-markdown
- jira2md converts `{{text}}` → `` `text` `` (inline code)
- jira2md converts `[URL]` (URL-only bracket syntax) → `<URL>` (markdown autolink)
- When combined: `{{[URL]}}` → `` `<URL>` `` — the autolink is inside backtick code, so react-markdown treats `<URL>` as literal text inside `<code>`, not a link
- The rendered output `<https://...>` is exactly what you see when an angle-bracket autolink appears inside a code span — angle brackets are preserved as text
- Fix location: `preprocessJiraMarkup` in WikiRenderer.tsx — add a pre-pass before jira2md that strips `{{` `}}` around `[URL]` patterns (URL-only bracket syntax), converting `{{[URL]}}` → `[URL]`

## Eliminated

- CSS / click handler issue: eliminated — the rendered `<https://...>` text confirms it never became an `<a>` element at all
- Missing regex in fixMarkdownLinkUnderscores: eliminated — the fix needed is upstream in preprocessJiraMarkup

## Resolution

root_cause: "`{{[URL]}}` is Jira monospace-code syntax wrapping a URL-only link. jira2md converts `{{...}}` → backtick code span, and `[URL]` inside becomes `<URL>` markdown autolink, but markdown autolinks are not processed inside code spans — react-markdown renders `<URL>` as literal angle-bracket text."
fix: "Added a pre-pass in `preprocessJiraMarkup` (before jira2md) that strips `{{` `}}` wrappers specifically around `[URL]` patterns — converting `{{[URL]}}` → `[URL]` so jira2md processes it as a normal URL-only bracket link and emits a proper `<URL>` autolink outside any code context. Also added a corresponding test in WikiRenderer.test.tsx."
verification: "New test passes; existing test suite passes."
files_changed:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
