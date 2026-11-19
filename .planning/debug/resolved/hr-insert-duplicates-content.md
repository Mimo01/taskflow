---
status: resolved
trigger: "In editor, adding a horizontal rule duplicates the content. Is that correct?"
created: 2026-11-19
updated: 2026-11-19
---

## Current Focus

hypothesis: CONFIRMED — setHorizontalRule inside a table cell / list item splits the enclosing table/list in two (HR is top-level only), so the structure appears twice
next_action: done — user chose 'insert after block'

## Symptoms

expected: inserting a horizontal rule adds one `----` at the caret, nothing else changes
actual: content appears duplicated after inserting the rule
errors: none reported
reproduction: rich editor, Insert → Horizontal rule (toolbar or /hr)

## Evidence

- timestamp: 2026-11-19
  checked: headless sweep — setHorizontalRule at ~40 positions × (caret, 5-char selection) for every WIKI_CORPUS fixture, then saveWiki
  found: 0 saves where an original line appears more times than before; plain paragraphs split cleanly ("Hello world" @6 → "Hello\n\n----\n\n world")
- timestamp: 2026-11-19
  checked: caret inside list item / table cell
  found: `* one\n* two` @5 → doc = bulletList[on], HR, bulletList[e, two] → saves "* on\n\n----\n\n* e\n* two" (list split in two)
  found: `|| h ||\n| cell |` @12 → doc = table[h / c], HR, table[ell] — table split into two tables; save FAILS ("block 2 (table) does not read back as the edited structure")
- timestamp: 2026-11-19
  checked: sweep failure counts
  found: 838 failed saves, all in lists/*, tables/*, panels with lists, plus line-break/emoticon/escape fixtures
- timestamp: 2026-11-19
  checked: insert-items.ts:116, InsertMenu/Toolbar
  found: run = chain().focus().setHorizontalRule(); no can() guard, item never disabled in cells/lists

## Eliminated

- hypothesis: emit/gap-keeper re-emits source slices twice
  reason: sweep found no duplicated lines in any saved output

## Resolution

root_cause: horizontalRule is not allowed in listItem / table cell content (schema.ts CELL_CONTENT, list item content), so ProseMirror's replace-fit splits the enclosing list/table around the HR. Tables come out as two tables (looks duplicated) and fail the save check.
fix: insert-items.ts blockingContainerEnd/insertBlock — when the caret's container can't hold the block, insert it after the enclosing list/table (all insert items: rule, code, noformat, table, panels); caret moves into the new block, stays put for a rule (954a9087)
verification: 15 new insert-items tests fail on HEAD~ and pass after; wiki-editor + lib/wiki 1187/1187, tsc clean
files_changed: [taskflow/src/components/wiki-editor/insert-items.ts, taskflow/src/components/wiki-editor/insert-items.test.ts]
