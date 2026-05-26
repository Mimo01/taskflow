---
name: wiki-renderer-list-in-quote
status: resolved
trigger: "There is a problem with wiki renderer on issue detail. This jira text: {quote}Finálnu definíciu eventov je potrebné odkonzultovať s analytickým tímom pred implementáciou.\n{quote}\n* DA lead form: použiť existujúcu komponentu bez špeciálnej konfigurácie — overiť s tímom, či je potrebné nastaviť špecifický {{formType}} alebo cieľový tím pre tento kontext — Renders the list item in the quote as well"
created: 2026-05-26
updated: 2026-05-26
---

## Symptoms

- **expected**: The {quote} block renders only its own content; the bullet list below renders as a separate, independent list outside the quote
- **actual**: The list item (`* DA lead form: ...`) appears inside the quote block instead of outside it
- **errors**: No console errors — wrong layout only
- **timeline**: Unsure whether this is a regression or always behaved this way
- **reproduction**: Open an issue detail with wiki markup containing a `{quote}...{quote}` block immediately followed by a `*` bullet list item on the next line

## Repro Input

```
{quote}Finálnu definíciu eventov je potrebné odkonzultovať s analytickým tímom pred implementáciou.
{quote}
* DA lead form: použiť existujúcu komponentu bez špeciálnej konfigurácie — overiť s tímom, či je potrebné nastaviť špecifický {formType} alebo cieľový tím pre tento kontext
```

## Current Focus

hypothesis: "The {quote} regex captures trailing \\n in content, emitting a trailing '> ' empty line that absorbs the following list item into the blockquote"
test: "Traced preprocessJiraMarkup output: content='Finálnu...\\n', split=['Finálnu...', ''], mapped=['> Finálnu...', '> '], result='> Finálnu...\\n> \\n* DA lead form:...'"
expecting: "Stripping trailing \\n from quote content + adding explicit blank line after blockquote keeps the list outside"
next_action: "done"
reasoning_checkpoint: "Remark AST tests confirm '> text\\n> \\n* item' parses as blockquote+list siblings correctly, but the trailing '> ' is misleading and may interact differently in browsers. Fix is: strip trailing \\n + add explicit \\n separator."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-26T14:46:00Z
  what: traced quote regex on repro input
  result: "content='Finálnu...\\n', split=['Finálnu...',''], mapped=['> Finálnu...','> '], final='> Finálnu...\\n> \\n* DA lead form'"
  significance: trailing '> ' empty blockquote line emitted due to \\n before closing {quote} tag

- timestamp: 2026-05-26T14:48:00Z
  what: remark AST test with '> Finálnu...\\n> \\n* DA lead form'
  result: top-level nodes = [blockquote, list] — structurally correct in remark
  significance: remark parses correctly, but trailing '> ' is harmful in browser rendering

- timestamp: 2026-05-26T14:50:00Z
  what: jira2md pipeline test
  result: jira2md passes through the '> ' markdown lines unchanged
  significance: no transformation at jira2md level

- timestamp: 2026-05-26T14:52:00Z
  what: all 127 tests pass after fix (126 existing + 1 new regression)
  result: PASS
  significance: fix confirmed correct, no regressions

## Eliminated

- jira2md transforming the blockquote incorrectly — jira2md passes '> text' through unchanged
- remarkBreaks interfering with blockquote structure — confirmed AST is correct after all plugins
- rehype-raw stripping blockquote — no raw HTML in the quote content for this case

## Resolution

root_cause: "preprocessJiraMarkup quote regex: when closing {quote} is on its own line, captured content ends with '\\n', which produces a trailing empty '> ' blockquote continuation line immediately before '* item'. This causes the list to render visually inside the blockquote."
fix: "In the {quote} regex replacement (WikiRenderer.tsx line 792-798): added .replace(/\\n+$/, '') to strip trailing newlines from content before split/map, and appended '\\n' to the replacement to emit an explicit blank-line separator between the blockquote and following content."
verification: "127/127 tests pass including new regression test 'list item after {quote} block (closing tag on own line) renders outside the blockquote'"
files_changed: "taskflow/src/routes/dashboard/WikiRenderer.tsx, taskflow/src/routes/dashboard/WikiRenderer.test.tsx"
