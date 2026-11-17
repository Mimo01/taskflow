---
status: diagnosed
phase: 98-editor-shell
source: [98-13-PLAN.md, 98-14-SUMMARY.md, 98-15-SUMMARY.md, 98-16-SUMMARY.md]
started: 2026-11-17
updated: 2026-11-17
---

## Current Test

[testing complete — round 2: WKWebView re-test of the 98-14..16 fixes, 2026-11-17]

Round 2 method: same approach as round 1; the harness was rebuilt and deleted afterwards. Native NSEvent keys and mouse clicks (Base UI popovers open with native clicks). Synthetic mouse moves produce no pointer events in WKWebView, so tooltips were checked via keyboard focus.

Round 1 method:

Method: Claude ran the tests in a real macOS WKWebView (the Tauri engine), not jsdom. A throwaway page mounted the dev-tools EditorTab from the running Vite server (React Compiler active). A compiled Swift driver sent native NSEvent keystrokes, used NSTextInputClient `setMarkedText`/`insertText` for IME and dead keys, ran JS probes and took `takeSnapshot` screenshots. The harness was deleted afterwards. Hover tooltips, sticky scroll, Base UI popovers that need real pointer events, and Tauri-only behaviour (system browser) could not be driven this way.

## Tests

### 1. Caret and rebuild
Blank doc, type 100+ characters including Enter and Backspace.
expected: created stays 1, render commits stay bounded, the caret never jumps.
result: pass
retest: "Re-test after 98-14: 4 paragraphs typed with Enter and Backspace in real WebKit; save `saved` with blank lines between blocks; text exact; created 1; 130 render commits for ~120 keys."

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
retest: "Re-test after 98-14: `* `, Enter in a bullet list, Enter twice to exit, then `# ` keep the save at unchanged/saved; no Couldn't save banner."

### 5. Cmd+Left/Right after programmatic focus
Focus the editor programmatically (Phase 96 note), then press Cmd+Left and Cmd+Right.
expected: the caret moves to line start/end on the first press; a first Cmd+Left no-op is an issue.
result: pass
retest: "Re-test after 98-15: after Source → Rich activeElement is the ProseMirror; the first Cmd+Left from mid-line goes to the line start and the first Cmd+Right to the line end, also right after a ⌘⇧M round trip."

### 6. App shortcuts while typing (FLOW-04)
In the editor: ⌘⇧M, ⌘B, J/K, ⌘⇧B. Then click outside the editor and press ⌘⇧M.
expected: ⌘⇧M toggles source (no Merge Requests navigation), ⌘B bolds (sidebar does not toggle), J/K type letters, ⌘⇧B makes a quote (no Backlog navigation); outside the editor ⌘⇧M navigates as usual.
result: pass
retest: "Re-test after 98-15: ⌘⇧M focuses the source textarea, a second ⌘⇧M returns to rich, no app shortcut fired. Outside the editor ⌘⇧M, J and ⌘B reach the app."

### 7. Toolbar
Full and Compact presets; Narrow width; hover tooltips; scroll a long fixture.
expected: Narrow keeps one row with low-priority items in the ⋯ More menu; tooltips show label + keycaps; the toolbar stays sticky while scrolling.
result: issue
reported: "Re-test after 98-16: at Narrow 360px the Full toolbar is one 40px row and More + Rich|Source are visible, BUT Italic is clipped by the overflow-hidden items region (region 144px wide, content 175px) and is not in the More menu, so it is unreachable except by ⌘I. Compact is fine (Bold, Italic, Underline, Link, Insert, More, Rich, Source). Tooltip shows 'Bold ⌘ B' (checked via keyboard focus; synthetic hover doesn't reach WebKit). Sticky works while scrolling, BUT the toolbar background is bg-muted/40, so scrolled text shows through it."
severity: major

### 8. Blocks
Insert a 3×4 table, Tab/Shift+Tab, Tab in the last cell, floating table toolbar actions incl. header toggle, delete table + ⌘Z; insert a code block and change its language; noformat; panels of each type with a title, switch type, remove panel + ⌘Z; colour from the palette, remove colour; a fixture with an off-palette colour.
expected: Tab in the last cell adds a row; every action works and undoes; the off-palette colour shows "Custom (kept)".
result: issue
reported: "Colour popover opens, off-palette #123456 shows 'Custom (kept)', Blue applies, Remove colour works, two ⌘Z restore #123456 (save unchanged). Panels: Insert → Info, title, switch to Warning, Remove panel (keeps content) all emit correct wiki, and ⌘Z undoes once the editor has focus. BUT after any Panel options action focus leaves ProseMirror (type switch → wrapper div, Remove → BODY), so the next ⌘Z or typing does nothing in the editor (in the app, J/K would then reach app shortcuts)."
severity: major

### 9. Links
⌘K and the toolbar link popover, paste a URL over a selection, try `javascript:`, use Open.
expected: links apply; `javascript:` is rejected; Open uses the system browser.
result: pass
note: "⌘K opens the popover with the URL field focused; https applies; `javascript:alert(1)` is rejected ('Enter an http(s) or mailto link.'); pasting a URL over a selection links it. Open uses the system browser only in Tauri (not checked). Unconfirmed: after a rejected URL + Esc, a second ⌘K did not apply a link in the script."

### 10. Source mode
Toggle with preview on, hide preview, Narrow width, edit in source and toggle back, then ⌘Z once.
expected: Narrow width auto-hides the preview; a single ⌘Z reverts the whole source session.
result: pass
retest: "Re-test after 98-15: after ⌘⇧M, typed QQ + Enter + text land in the textarea; the preview beside source updates; back to rich, a single ⌘Z reverts the whole source session."

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
passed: 11
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- Round 1 gaps (Enter gap, mode-toggle focus, Cmd+Arrow, narrow toolbar More/mode toggle, empty list banner) were closed by 98-14..16 and re-verified in WKWebView on 2026-11-17. -->

- truth: "Narrow width keeps every inline Full toolbar item visible or in ⋯ More (test 7)"
  status: failed
  reason: "User reported (re-test): at 360px Italic is clipped by the overflow-hidden data-toolbar-items region and is not in More."
  severity: major
  test: 7
  root_cause: "Pinned controls (Insert, More, Rich|Source ~214px) leave the items region 144px; text style (98) + divider + Bold + Italic need 175. The Full breakpoints in toolbar-config.ts keep italic inline at 360 and give it no overflow entry."
  artifacts: [taskflow/src/components/wiki-editor/toolbar/toolbar-config.ts, taskflow/src/components/wiki-editor/toolbar/Toolbar.tsx]
  missing: ["italic in the Full overflow order with a breakpoint above 360 (or reclaim width so it fits)", "test: the 360 inline set fits its measured width"]
  debug_session: "inline WKWebView probe"

- truth: "The sticky toolbar is opaque while content scrolls under it (test 7)"
  status: failed
  reason: "User reported (re-test): the toolbar uses bg-muted/40, so scrolled paragraphs show through it."
  severity: cosmetic
  test: 7
  root_cause: "Toolbar.tsx:328 uses bg-muted/40, which is translucent; a sticky bar needs an opaque ground."
  artifacts: [taskflow/src/components/wiki-editor/toolbar/Toolbar.tsx]
  missing: ["opaque background (bg-background under the muted tint)"]
  debug_session: "inline WKWebView probe"

- truth: "Panel options actions (switch type, Remove panel) return focus to the editor (test 8)"
  status: failed
  reason: "User reported (re-test): after a Panel options action focus is on a wrapper div or BODY; ⌘Z and typing do nothing until the user clicks back in."
  severity: major
  test: 8
  root_cause: "The DropdownMenu in PanelView.tsx restores focus to its trigger, which sits in the contenteditable=false header (or is deleted with the panel, so focus falls to BODY); the handlers never call editor.view.focus()."
  artifacts: [taskflow/src/components/wiki-editor/nodeviews/PanelView.tsx]
  missing: ["focus the editor after the action (Base UI finalFocus or editor.view.focus())", "check the same for the code-block language picker and the table toolbar"]
  debug_session: "inline WKWebView probe"
