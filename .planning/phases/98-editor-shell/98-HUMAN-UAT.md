---
status: diagnosed
phase: 98-editor-shell
source: [98-13-PLAN.md]
started: 2026-11-17
updated: 2026-11-17
---

## Current Test

[testing complete — automated WKWebView pass, 1 test partly pending human check]

Method: Claude ran the tests in a real macOS WKWebView (the Tauri engine), not jsdom. A throwaway page mounted the dev-tools EditorTab from the running Vite server (React Compiler active). A compiled Swift driver sent native NSEvent keystrokes, used NSTextInputClient `setMarkedText`/`insertText` for IME and dead keys, ran JS probes and took `takeSnapshot` screenshots. The harness was deleted afterwards. Hover tooltips, sticky scroll, Base UI popovers that need real pointer events, and Tauri-only behaviour (system browser) could not be driven this way.

## Tests

### 1. Caret and rebuild
Blank doc, type 100+ characters including Enter and Backspace.
expected: created stays 1, render commits stay bounded, the caret never jumps.
result: issue
reported: "Caret never jumps (text exact after 130 keystrokes with Enter/Backspace), created stays 1, render commits ~1 per keystroke. BUT the save fails as soon as the doc has 2+ paragraphs typed with Enter: 'the saved text has 1 top-level blocks, the edit has 3'. Every new paragraph carries gap=0."
severity: blocker

### 2. IME
Japanese `nihon` → 日本, Pinyin `zhongwen` → 中文, dead key `option+e e` → é, in a paragraph, a bullet list item and a table cell.
expected: text lands once, no stray characters.
result: pass
note: "Composition via setMarkedText/insertText: 日本, 中文 and ´→é land once in a paragraph, a list item and a table cell; save succeeds. Synthetic Option+e key events can't run TIS dead-key handling (same harness limit as Phase 96), so the dead key was driven through the marked-text path the OS uses."

### 3. Input rules during composition
Start an IME composition, then type `*`, `# `, `h1. `.
expected: no rule fires until composition ends.
result: pass
note: "Marked `# `, `h1. ` and `*` stay plain text while composing; `# ` and `h1. ` convert only after commit."

### 4. Wiki/markdown rules
Type `*bold* `, `_it_ `, `* `, `- `, `# `, `1. `, `h2. `, `## `, `{code}`, `{code:java}`, `{noformat}`.
expected: each formats in place and the verdict panel emits canonical wiki ("wiki wins": `*x*` is bold, `# ` is a numbered list).
result: pass
note: "All formatted in place and saved canonical wiki (`- `→`* `, `1. `→`# `, `## `→`h2. `, `{code:java}` picks Java). Also `-strike- ` and `+under+ ` work. Side note, not phase 98 code: the WikiRenderer preview of `{noformat}\ntail\n{noformat}` shows a stray ``` after the text."

### 5. Cmd+Left/Right after programmatic focus
Focus the editor programmatically (Phase 96 note), then press Cmd+Left and Cmd+Right.
expected: the caret moves to line start/end on the first press; a first Cmd+Left no-op is an issue.
result: issue
reported: "After switching Source → Rich (WikiEditor calls editor.commands.focus()), the first Cmd+Left is a no-op (caret stays at 2). `editor.commands.focus()` also leaves document.activeElement on BODY in WKWebView. keymap.ts binds no Mod-ArrowLeft/Right although Phase 96 SPIKE-FINDINGS recommended it. With a DOM `.focus()` both keys work on the first press."
severity: major

### 6. App shortcuts while typing (FLOW-04)
In the editor: ⌘⇧M, ⌘B, J/K, ⌘⇧B. Then click outside the editor and press ⌘⇧M.
expected: ⌘⇧M toggles source (no Merge Requests navigation), ⌘B bolds (sidebar does not toggle), J/K type letters, ⌘⇧B makes a quote (no Backlog navigation); outside the editor ⌘⇧M navigates as usual.
result: issue
reported: "⌘B bolds, J/K type, ⌘⇧B makes a quote, ⌘⇧M switches to source, and no app shortcut fires; outside the editor ⌘⇧M/J/⌘B reach the app. BUT after ⌘⇧M switches to source, focus is on BODY (the source textarea is not focused), so the next ⌘⇧M navigates to Merge Requests instead of switching back."
severity: major

### 7. Toolbar
Full and Compact presets; Narrow width; hover tooltips; scroll a long fixture.
expected: Narrow keeps one row with low-priority items in the ⋯ More menu; tooltips show label + keycaps; the toolbar stays sticky while scrolling.
result: issue
reported: "Full preset at Narrow (360px): the toolbar stays one row (40px) but is clipped after 'Insert'; there is no ⋯ More button and the Rich/Source toggle is pushed out of view. Compact preset shows Bold, Italic, Underline, Link, Insert, More, Rich, Source. Tooltips and sticky scroll not checked (needs real hover/scroll)."
severity: major

### 8. Blocks
Insert a 3×4 table, Tab/Shift+Tab, Tab in the last cell, floating table toolbar actions incl. header toggle, delete table + ⌘Z; insert a code block and change its language; noformat; panels of each type with a title, switch type, remove panel + ⌘Z; colour from the palette, remove colour; a fixture with an off-palette colour.
expected: Tab in the last cell adds a row; every action works and undoes; the off-palette colour shows "Custom (kept)".
result: [pending]
note: "Checked: Tab in the last cell adds a row (3→4); the floating table toolbar shows all 9 actions incl. header toggles; Delete table then ⌘Z restores it; `{code:java}` shows the Java language picker; `{noformat}` inserts. Still for a human: colour popover and 'Custom (kept)' (scripted click doesn't open Base UI popovers), panel type switch/remove."

### 9. Links
⌘K and the toolbar link popover, paste a URL over a selection, try `javascript:`, use Open.
expected: links apply; `javascript:` is rejected; Open uses the system browser.
result: pass
note: "⌘K opens the popover with the URL field focused; https applies; `javascript:alert(1)` is rejected ('Enter an http(s) or mailto link.'); pasting a URL over a selection links it. Open uses the system browser only in Tauri (not checked). Unconfirmed: after a rejected URL + Esc, a second ⌘K did not apply a link in the script."

### 10. Source mode
Toggle with preview on, hide preview, Narrow width, edit in source and toggle back, then ⌘Z once.
expected: Narrow width auto-hides the preview; a single ⌘Z reverts the whole source session.
result: issue
reported: "Preview shows beside source and a single ⌘Z reverts the whole source session. BUT after ⌘⇧M (or clicking Source) focus stays on the hidden rich editor: typed 'QQ' went into the invisible rich doc, the source pane still showed the old text, and the emitted value became 'QQHello…' while the user sees 'Hello…'. Saved text differs from what is on screen."
severity: blocker

### 11. Forced source and failed save (SAFE-05 / D-08)
Load a fixture or paste text that fails to load; in rich, type an unspellable token.
expected: the failing text opens in source with the quiet notice and Rich disabled (the Settings preference is unchanged); the unspellable token shows "Couldn't save safely: …" and "Fix in source" works.
result: pass
note: "Typing `bq. quote` in rich shows 'Couldn't save safely: block 0: The text starts with `bq. `…' with a 'Fix in source' button. No real text reaches the forced-source path: all 65 fixtures and 32 deliberately odd inputs load rich or rich-demoted, never failed, so the forced notice is covered only by the mocked unit test (forced-source.test.tsx)."

### 12. Raw atoms
Open a rich-demoted fixture; hover the raw frames; find inline raw chips; select and delete each.
expected: dashed read-only frames with "Edit in source" on hover; inline raw chips; each deletes as a unit.
result: pass
note: "unknown-macro: the raw block renders read-only with an 'Edit in source' button, and the `{status}` inline raw chip is present. Backspace removes the inline chip as one unit; the selected raw block deletes as one unit."

### 13. Visual parity (EDIT-01)
Compare the rich view of a fixture with the WikiRenderer preview beside it, in light and dark mode.
expected: the rich view looks like the preview in both themes.
result: pass
note: "inline/formatting: rich view matches the source-mode WikiRenderer preview (weights, strike, underline, sup/sub, ??cite??) in light and dark."

## Summary

total: 13
passed: 7
issues: 5
pending: 1
skipped: 0
blocked: 0

## Gaps

- truth: "Typing paragraphs with Enter in rich mode saves (test 1)"
  status: failed
  reason: "Enter copies the first block's gap=0 onto the new paragraph (gap global attr in src/lib/wiki/editor/schema.ts:33 keeps TipTap's default keepOnSplit), so the emit joins paragraphs and the save check fails. Likely fix: keepOnSplit: false on the gap attribute. Also resolves the logged 'Enter at the start of the first block copies gap 0' limitation."
  severity: blocker
  test: 1
  artifacts: [src/lib/wiki/editor/schema.ts, src/components/wiki-editor/gap-keeper.ts]
  missing: ["keepOnSplit: false on gap", "test: split a gap-0 paragraph via real splitBlock, then saveWiki → saved"]

- truth: "Switching to source moves focus to the source textarea; keystrokes never edit the hidden rich doc (tests 6, 10)"
  status: failed
  reason: "Mode toggle (⌘⇧M or the Source radio) leaves focus on the hidden ProseMirror or BODY. Typing edits the invisible rich doc and changes the emitted value; a second ⌘⇧M navigates away."
  severity: blocker
  test: 10
  artifacts: [src/components/wiki-editor/WikiEditor.tsx, src/components/wiki-editor/source/]
  missing: ["focus the source textarea on toRich→source", "rich editor not editable/focusable while hidden"]

- truth: "Programmatic focus leaves a working caret and Cmd+Left/Right move on the first press (test 5)"
  status: failed
  reason: "editor.commands.focus() doesn't focus the DOM in WKWebView; the first Cmd+Left after Source→Rich is a no-op. Phase 96 recommended binding Mod-ArrowLeft/Right; keymap.ts has none."
  severity: major
  test: 5
  artifacts: [src/components/wiki-editor/WikiEditor.tsx, src/components/wiki-editor/keymap.ts]
  missing: ["Mod-ArrowLeft/Right bindings (selectTextblockStart/End)", "DOM focus when switching back to rich"]

- truth: "Narrow width keeps the Full toolbar on one row with overflow in ⋯ More and the mode toggle visible (test 7)"
  status: failed
  reason: "At 360px the Full preset clips after Insert; no More button; the Rich/Source toggle is off-screen."
  severity: major
  test: 7
  artifacts: [src/components/wiki-editor/toolbar/Toolbar.tsx, src/components/wiki-editor/toolbar/toolbar-config.ts]
  missing: ["overflow measurement/container query that moves items to More at narrow width"]

- truth: "An empty list item doesn't show a save error (typing `# ` or Enter in a list)"
  status: failed
  reason: "An empty list item emits `# ` / `* `, which reads back as a paragraph, so a red 'Couldn't save safely' banner flashes on every new bullet until the first character."
  severity: major
  test: 4
  artifacts: [src/lib/wiki/editor/engine.ts, src/components/wiki-editor/WikiEditor.tsx]
  missing: ["treat a transient empty list item as no-op/hold the last good save instead of a failure banner"]
