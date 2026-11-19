---
status: resolved
trigger: "Couldn't save safely — block 1 (paragraph) does not read back as the edited structure (paragraph \"vsmvofo\" + trailing line break reads back without the break)"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms
- expected: paragraph "vsmvofo" + ⏎ line break saves
- actual: save-check refuses; emitted markup reads back as paragraph "vsmvofo" (break lost)
- reproduction: Shift+Enter at the end of a paragraph, save

## Resolution
root_cause: emit.ts spelled every unrecorded paragraph/list-item hardBreak as `\n`. A trailing
`\n` is stripped (and blank lines are block gaps), so a break at the start or end of a paragraph,
or two breaks in a row (or around a whitespace-only line), cannot read back as a break.
fix: `pinBreaks` in src/lib/wiki/editor/emit.ts spells such breaks `\\` (which the parser reads
back as a hardBreak) — only in para/item context, and only when a `\n` would leave a blank line on
either side. Recorded `\n` in cells/quotes untouched (parsed continuations may be blank there —
lossless fuzz caught both a `\n`-next-to-`\\` and a blank cell line case).
verification: 5 new cases in emit-edited.test.ts fail pre-fix and pass post-fix; wiki + wiki-editor
+ dev-tools suites 1178/1178 incl. lossless fuzz; biome + tsc clean.
files_changed: taskflow/src/lib/wiki/editor/emit.ts, taskflow/src/lib/wiki/editor/emit-edited.test.ts
