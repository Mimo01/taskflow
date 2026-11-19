---
status: resolved
trigger: "In the editor when it is empty it says 'Write a description'. When i insert code block immediately at start, it overlaps"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms
- expected: placeholder disappears once a code block is inserted
- actual: "Write a description…" placeholder overlaps the empty code block at the start of the editor

## Resolution
- root_cause: Tiptap's `editor.isEmpty` (isNodeEmpty(doc)) is true for a doc containing only an empty code block, so Placeholder decorates the `<pre>` with `is-editor-empty` + `data-placeholder`. The CSS `.ProseMirror .is-editor-empty:first-child::before` matched any block type, floating the text inside the code block (same for empty list/quote).
- evidence: jsdom probe after setCodeBlock() → `<pre data-placeholder="Write a description…" class="is-empty is-editor-empty">`, isEmpty=true
- fix: restrict selector to `.ProseMirror p.is-editor-empty:first-child::before`
- files_changed: taskflow/src/index.css
