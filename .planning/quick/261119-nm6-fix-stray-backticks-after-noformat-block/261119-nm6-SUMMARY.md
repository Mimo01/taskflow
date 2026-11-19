---
quick_id: 261119-nm6
status: complete
commits: [3990b8c3]
---

# Quick 261119-nm6 Summary: {noformat} close fence

`{noformat}\nfoo bar\n{noformat}` now renders `<pre><code>foo bar\n</code></pre>`. Before the fix it
rendered `foo bar````.

## Cause
jira2md converts `{noformat}` by plain substitution to ```, with no newline template like the one
`{code}` gets. preprocessJiraMarkup stripped the body's trailing newline for both block types, so
the closing ``` glued onto the last body line. The fence then never closed: mid-document, all
following prose was swallowed into the code block, which was worse than the reported stray backticks.

## Fix (conversion step only, nothing at render time)
- `preprocess.ts`: for a `{noformat}` close, a real `\n` goes back outside the CODEBODY placeholder.
- `pipeline.ts` (wikiToMarkdown restore): if a block body contains a run of 3+ backticks, both of
  its fences are widened to (longest run + 1). This makes a literal ``` line in a {noformat} body
  show as text instead of closing the fence. It applies to {code} too.

## Verification
- 8 new tests in `pipeline.test.tsx` ("{noformat} close fence (261119-nm6)"). The 7 {noformat}
  cases failed before the fix and the {code} control passed. All 8 pass after it.
- lib/wiki: 25 files / 483 tests pass, including equivalence, corpus coverage and editor
  emit round-trip. wiki-editor + WikiRenderer consumers: 65 files / 979 tests pass. tsc is clean,
  biome is clean, and the pre-commit run was 91 files / 1550 tests.
- The editor emit path (`{noformat}` open/close spelling) is untouched. Only the read-only
  conversion changed.
