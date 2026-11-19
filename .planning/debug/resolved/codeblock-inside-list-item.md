---
status: resolved
trigger: "emitError: cannot emit a codeBlock inside a list item (original markup: {code:xml} block + a line of backslashes)"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms

- expected: editing the description saves
- actual: save fails with `cannot emit a codeBlock inside a list item` (emitError)
- original markup: a `{code:xml}` block, two blank lines, then `\\\\\\\\\\\\\\\\vsmvofo\\\\`
- timeline: unknown
- reproduction: unknown; user not sure which edit put the code block into a list

## Current Focus

hypothesis: CONFIRMED — schema lets listItem/tableCell hold any block; emit.ts can only spell paragraph/list/rawBlock (item) and paragraph/panel/rawBlock (cell)
next_action: none

## Evidence

- timestamp: 2026-11-19 — loading the reported markup and saving unchanged → `unchanged` (load is fine; the failing doc came from an edit)
- timestamp: 2026-11-19 — caret in `* a`, INSERT_ITEMS "Code block" → listItem[paragraph, codeBlock] → `cannot emit a codeBlock inside a list item` (exact error)
- timestamp: 2026-11-19 — caret in `* a`, insertContent('<pre><code>…') (paste path) → same error
- timestamp: 2026-11-19 — caret in a table cell, insert code/noformat/rule → `cannot emit a … inside a table cell` (same class)
- timestamp: 2026-11-19 — typing `{code}` / ``` in a list item: input rules don't fire there, not a path

## Eliminated

- hypothesis: the original markup fails to round-trip — it loads rich and saves unchanged
- hypothesis: code input rules inside list items — they don't fire

## Resolution

root_cause: StarterKit listItem (`paragraph block*`) and tiptap table cells (`block+`) accept blocks emit.ts cannot write inside them; insert/paste built such docs and save threw
fix: WikiListItem (`paragraph (paragraph | bulletList | orderedList | rawBlock)*`) + WikiTableCell/WikiTableHeader (`(paragraph | panel | rawBlock)+`) in schema.ts, used by wikiExtensions and buildEditorExtensions; ProseMirror replace fitting now places the block after the list/table
verification: 5 new insert-items tests fail pre-fix, pass post-fix; schema rejection tests; full wiki suite 1191/1191; tsc + biome clean
files_changed: src/lib/wiki/editor/schema.ts, src/components/wiki-editor/extensions.ts, package.json (+@tiptap/extension-list 3.34.0 exact), insert-items.test.ts, schema.test.ts
follow_ups: table inserted inside a table cell lands adjacent to the existing table and fails read-back ("1 top-level blocks, the edit has 2"); toggling a list over a code block flattens it into a paragraph with raw newlines → "does not read back"
