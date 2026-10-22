---
status: resolved
trigger: "wiki renderer on issue detail breaks when a {code:java} block follows an empty list bullet (` * ` then newline then {code})"
created: 2026-10-22
updated: 2026-10-22
---

## Symptoms

<!-- DATA_START -->
expected: |
  Jira wiki description renders like Jira: bullet list, then a {code:java} block with the XML body
  verbatim, then a bold heading, a || header table, images and further lists.

actual: |
  - The empty trailing bullet ` * ` followed by `{code:java}` on the next line produces an <li> with an
    EMPTY <pre><code class="language-java"></code></pre>.
  - The code body leaks into a <p>: XML tags render as <a node="[object Object]">…</a>, closing tags
    escaped as text, indentation turned into &nbsp; runs + <br>.
  - The closing ` {code}` (mid-line, after the last XML line) opens a new fence that swallows the rest
    of the document as literal converted markdown/HTML (&lt;strong&gt;, `| --- |` table, &lt;img&gt;).

errors: none (render only)

source_shape: |
  (ticket content omitted — structure only)
  Intro text.
   * bullet
   * bullet:
   * 
  {code:java}
   <ns:a>
       <ns:b>value</ns:b>
   </ns:a> {code}

  *Bold heading:*
  ||Col A||Col B||
  |x|y|

timeline: unknown; reported 2026-10-22
reproduction: issue description with an empty bullet immediately before {code:java}, closing {code} at end of the last code line
<!-- DATA_END -->

## Notes for investigator
- Renderer: src/components/**/WikiRenderer.tsx in inner app dir (taskflow/taskflow/). Jira wiki → markdown conversion then react-markdown (v10) + rehype plugins.
- Known gotchas in memory: tt macro format `{{{}TEXT{}}}` (WikiRenderer.tsx ~624); react-markdown v10 has no components.text override.
- Likely issues to check: (1) {code} detection anchored at line start / requires closing on its own line; (2) list-item continuation swallowing the next-line {code:java}; (3) `node` prop spread onto <a> in a custom component (should destructure `node` out); (4) `&#43;` double-escaped.
- Write a regression test with this exact excerpt; prove it fails pre-fix.

## Current Focus
next_action: none — user confirmed fixed in app 2026-10-22

## Evidence
- jira2md list regex ^\s*(\*+)\s+ lets \s+ eat the newline after an empty bullet, so "* \n{code:java}" becomes "* ```java" (fence glued to the bullet, opens inside the list item). Closing ``` at column 0 is outside the item, so fences mispair and a stray fence swallows the rest of the document. The node="[object Object]" anchors were just a symptom of the code body being parsed as prose.

## Eliminated
- {code} regex requiring own-line close: protect regex handles mid-line close fine (body captured correctly).

## Resolution
root_cause: empty list-marker line before {code}/{noformat} is merged with the fence by jira2md's \s+ in its list regex, putting the opening fence inside a list item while the close is at column 0.
fix: preprocessJiraMarkup drops empty [*#] marker lines immediately preceding a {code}/{noformat} line.
verification: new regression test fails without the fix, passes with it; WikiRenderer suite 181/181; biome clean on both files.
files_changed: [taskflow/src/routes/dashboard/WikiRenderer.tsx, taskflow/src/routes/dashboard/WikiRenderer.test.tsx]
