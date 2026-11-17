---
status: pending
phase: 98-editor-shell
source: [98-13-PLAN.md]
started: 2026-11-17
updated: 2026-11-17
---

## Current Test

[awaiting human testing]

All tests run in `cd taskflow && npm run tauri dev` → Developer Tools → Editor tab. Placeholder content only.

## Tests

### 1. Caret and rebuild
Blank doc, type 100+ characters including Enter and Backspace.
expected: created stays 1, render commits stay bounded, the caret never jumps.
result: [pending]

### 2. IME
Japanese `nihon` → 日本, Pinyin `zhongwen` → 中文, dead key `option+e e` → é, in a paragraph, a bullet list item and a table cell.
expected: text lands once, no stray characters.
result: [pending]

### 3. Input rules during composition
Start an IME composition, then type `*`, `# `, `h1. `.
expected: no rule fires until composition ends.
result: [pending]

### 4. Wiki/markdown rules
Type `*bold* `, `_it_ `, `* `, `- `, `# `, `1. `, `h2. `, `## `, `{code}`, `{code:java}`, `{noformat}`.
expected: each formats in place and the verdict panel emits canonical wiki ("wiki wins": `*x*` is bold, `# ` is a numbered list).
result: [pending]

### 5. Cmd+Left/Right after programmatic focus
Focus the editor programmatically (Phase 96 note), then press Cmd+Left and Cmd+Right.
expected: the caret moves to line start/end on the first press; a first Cmd+Left no-op is an issue.
result: [pending]

### 6. App shortcuts while typing (FLOW-04)
In the editor: ⌘⇧M, ⌘B, J/K, ⌘⇧B. Then click outside the editor and press ⌘⇧M.
expected: ⌘⇧M toggles source (no Merge Requests navigation), ⌘B bolds (sidebar does not toggle), J/K type letters, ⌘⇧B makes a quote (no Backlog navigation); outside the editor ⌘⇧M navigates as usual.
result: [pending]

### 7. Toolbar
Full and Compact presets; Narrow width; hover tooltips; scroll a long fixture.
expected: Narrow keeps one row with low-priority items in the ⋯ More menu; tooltips show label + keycaps; the toolbar stays sticky while scrolling.
result: [pending]

### 8. Blocks
Insert a 3×4 table, Tab/Shift+Tab, Tab in the last cell, floating table toolbar actions incl. header toggle, delete table + ⌘Z; insert a code block and change its language; noformat; panels of each type with a title, switch type, remove panel + ⌘Z; colour from the palette, remove colour; a fixture with an off-palette colour.
expected: Tab in the last cell adds a row; every action works and undoes; the off-palette colour shows "Custom (kept)".
result: [pending]

### 9. Links
⌘K and the toolbar link popover, paste a URL over a selection, try `javascript:`, use Open.
expected: links apply; `javascript:` is rejected; Open uses the system browser.
result: [pending]

### 10. Source mode
Toggle with preview on, hide preview, Narrow width, edit in source and toggle back, then ⌘Z once.
expected: Narrow width auto-hides the preview; a single ⌘Z reverts the whole source session.
result: [pending]

### 11. Forced source and failed save (SAFE-05 / D-08)
Load a fixture or paste text that fails to load; in rich, type an unspellable token.
expected: the failing text opens in source with the quiet notice and Rich disabled (the Settings preference is unchanged); the unspellable token shows "Couldn't save safely: …" and "Fix in source" works.
result: [pending]

### 12. Raw atoms
Open a rich-demoted fixture; hover the raw frames; find inline raw chips; select and delete each.
expected: dashed read-only frames with "Edit in source" on hover; inline raw chips; each deletes as a unit.
result: [pending]

### 13. Visual parity (EDIT-01)
Compare the rich view of a fixture with the WikiRenderer preview beside it, in light and dark mode.
expected: the rich view looks like the preview in both themes.
result: [pending]

## Summary

total: 13
passed: 0
issues: 0
pending: 13
skipped: 0
blocked: 0

## Gaps
