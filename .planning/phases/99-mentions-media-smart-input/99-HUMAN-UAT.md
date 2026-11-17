---
status: gaps-found
phase: 99-mentions-media-smart-input
source: [99-14-PLAN.md, 99-11-SUMMARY.md, 99-12-SUMMARY.md, 99-13-SUMMARY.md]
started: 2026-11-17
updated: 2026-11-17
---

## Current Test

[testing complete — run by Claude on 2026-11-17 at the user's request; 3 gaps recorded]

Method: a throwaway page mounted the dev-tools EditorTab from the running Vite server (React Compiler active, MemoryRouter + QueryClient; people/issue search stubbed in the query client with placeholder DEMO users and issues). It was driven two ways and deleted afterwards:
- Playwright WebKit 27.2 (the engine behind WKWebView) for all 12 tests, using synthetic DOM drop/paste events with real File objects and real keyboard input.
- A compiled Swift driver hosting a real macOS WKWebView with the app's Edit menu (Undo, Redo, Cut, Copy, Paste, Select All; no Paste and Match Style). It used AppKit key-equivalent dispatch (window first, then menu), a real screenshot on the clipboard (`screencapture -c`) and WebKit's own drag-destination path (draggingEntered → performDragOperation with file URLs). This covered tests 1, 4, 5 and 7 natively.
Not driven: a physical Finder drag source and the full Tauri shell. `dragDropEnabled: false` is confirmed in tauri.conf.json. Test 8 used the five synthetic fixtures only; no real Jira or Word content was captured (no customer data).

Automated gates before UAT: `npm test` 420 files / 6422 tests passed; `npx tsc --noEmit` clean.

Setup: every step uses the Editor tab (Settings > Dev tools > Editor). Controls: Preset (Full / Compact), Host context (Project key, Staged mode switch, Upload: Succeed / Fail / Slow 3s), Paste sample, Capture next paste, Open in dialog, Width. Use placeholder content only (DEMO- keys, stub names). Never commit real Jira or Word content.

## Tests

### 1. Finder drag and drop (image + PDF)
Editor tab: Preset Full, Upload Succeed. Drag one PNG and one PDF from Finder into the editor in the middle of a paragraph.
expected: two placeholders appear at the drop point, then resolve to an `!name!` image chip and a `[^name]` file chip. The drop does not also trigger any outer drop zone.
result: pass — native WKWebView drag of drop.png + drop.pdf (file URLs) at 'Alpha beta|': saved `Alpha beta!drop.png![^drop.pdf] gamma delta.`, image rendered (2800x1662 blob), outer window drop listener not fired. Placeholders seen with Slow 3s (test 2).

### 2. Slow upload keeps typing
Upload Slow 3s. Drop a file, keep typing while the placeholder spins.
expected: typing is never blocked, text lands in the right places, placeholder resolves after about 3s.
result: pass — placeholder visible while typing; caret elsewhere: `One!slow.png! two three. End typed.` (image at drop point, typed text at caret).

### 3. Failed upload
Upload Fail. Drop a file.
expected: the chip is removed and an error line names the file; Dismiss clears the line.
result: pass — chip removed (no save), line \"Couldn't upload broken.png. Check your connection and try again.\", Dismiss clears it.

### 4. Clipboard screenshot paste
Take a screenshot to clipboard (Cmd+Ctrl+Shift+4), click in the editor, Cmd+V (Upload Succeed).
expected: an `image-YYYYMMDD-HHMMSS.png` image embeds and renders inline.
result: pass — native: real screenshot on the clipboard (public.png + public.tiff), Cmd+V via the Edit menu path → `!image-20261117-171630.png!`, renders 240x160.

### 5. Staged mode previews
Host context: turn the Staged mode switch on. Paste an image.
expected: the preview renders immediately (not blank), the Staged files list shows it, the verdict text keeps the filename.
result: pass — native: preview renders 240x160 immediately (blob), Staged files lists image-20261117-171632.png, saved text keeps the filename.

### 6. Delete embed prompt
Staged mode off, Upload Succeed. Paste an image, then delete the embed. Also delete an embed of a pre-existing placeholder attachment.
expected: for the just-uploaded embed an "Also delete attachment?" row appears and auto-dismisses after 6s; Delete removes it from the uploaded list. The pre-existing placeholder attachment shows nothing.
result: pass — prompt shown for the just-uploaded embed, gone after 6.5s; Delete removes it from host attachments (only diagram.png, report.pdf left); deleting pre-existing `!diagram.png!` shows no prompt.

### 7. Cmd+Shift+V plain paste
Copy a formatted section from a web page, then Cmd+Shift+V in the editor.
expected: arrives as plain text with no formatting.
result: issue — native WKWebView: Cmd+Shift+V reaches the page as a keydown but no paste happens (0 paste events). The Edit menu has no item for it and WebKit binds nothing to Cmd+Shift+V. Plain-mode logic itself works (synthetic paste with Shift held → plain; next Cmd+V rich again), and native `pasteAsPlainText:` pastes plain text.

### 8. Real Jira and Word paste samples
Click Capture next paste, then paste from a real Jira issue view; repeat with Word. Review the captured html/plain textareas. Do not keep real content.
expected: record whether mentions, keys, emoticons, panels, lists and tables map correctly. Any mis-mapped sample is saved as a placeholder-only gap note (DEMO- keys, stub names), never real content.
result: issue (cosmetic) — fixtures map: Jira (mentions [~jdoe]/[~rroe], DEMO-12, (/), {panel:title=…}, {info}, {warning}, {code:java}, {noformat}, !diagram.png!), Word (marks, nested list, colour), web (heading, marks, link, mono, lists, bq., code, ----, table flattened), hostile (unsafe links stripped). Google Docs heading saves as `h2. *Docs heading*` (heading span font-weight:700 kept as bold). Real Jira/Word capture not run.

### 9. Esc nesting in a dialog
Click Open in dialog, type `@`, press Esc once, then Esc again. Repeat with the bubble menu visible (select text).
expected: first Esc closes the popover (or bubble), dialog stays open; second Esc closes the dialog.
result: issue (minor) — Esc nesting works: Esc 1 closes the popover (or bubble) and keeps the dialog, Esc 2 closes the dialog. But a second, stray mention popover opens in the main (unfocused) editor behind the dialog and survives both Escs.

### 10. Caret after insertions
In the editor insert, in turn: a mention (`@`), an emoticon (`:`), an issue key (`DEMO-`), an attachment from the picker, a table from `/`.
expected: the caret lands right after each inserted item and typing continues there.
result: pass — `Start [~jdoe] M1`, `(/)E1`, `DEMO-1 K1`, `/table` → caret in the first header cell (T1), picker report.pdf → `[^report.pdf]A1` with focus back in the editor.

### 11. Compact preset
Preset Compact.
expected: the bubble shows on selection only and never together with a toolbar; footer Attach, Mention and Emoticon work and focus returns to the editor.
result: pass — no toolbar until selection; selection shows only 'Selection formatting'; footer Mention/Emoticon open the list with focus in the editor; Attach opens the picker and Esc returns focus.

### 12. Source mode
Switch to Source mode (Rich | Source). Type `@` and then `:`; paste a file / drop a file.
expected: the `@` popover appears at the textarea caret and Esc closes just that popover; file paste or drop inserts upload markup at the caret and uploads the file; a file plus text paste uploads the file and skips the text.
result: pass — `@ja` popover at the textarea caret line; Esc closes it and typing more doesn't reopen it; `:che` inserts (/); pdf paste (with text) → `[^doc.pdf]` (text skipped), image paste → `!image-…png!`, drop → `[^dropped.pdf]`, no outer drop.

## Summary

total: 12
passed: 9
issues: 3
pending: 0

## Gaps

- truth: "Cmd+Shift+V pastes as plain text in the app (test 7)"
  status: failed
  reason: "Native WKWebView with the app's Edit menu: Cmd+Shift+V fires a keydown but no paste event, so nothing is pasted."
  severity: major
  test: 7
  root_cause: "src-tauri/src/lib.rs Edit menu has PredefinedMenuItem paste (Cmd+V) only. WebKit has no default binding for Cmd+Shift+V, so the plugin's plainNext flag is set but no paste ever follows. Native `pasteAsPlainText:` sent to the WKWebView does fire a plain-text paste."
  artifacts: [taskflow/src-tauri/src/lib.rs, taskflow/src/components/wiki-editor/paste/paste-plugin.ts]
  missing: ["Edit menu item 'Paste and Match Style' (CmdOrCtrl+Shift+V) whose handler sends pasteAsPlainText: to the webview (with_webview + objc), or an equivalent native trigger", "plainNext must not stay armed when no paste follows (reset on keyup/blur or with a short timeout)"]
  debug_session: "inline WKWebView probe"

- truth: "Only the focused editor shows a suggestion popover (test 9)"
  status: failed
  reason: "Typing @ja in the dialog editor also opens a mention popover in the unfocused main editor behind it; Esc does not close it."
  severity: minor
  test: 9
  root_cause: "The two EditorTab editors share `text`. The dialog's onChange resets the main editor's doc to text ending in '@ja' with the caret at the end, and the suggestion plugin activates on that programmatic transaction although the editor is not focused."
  artifacts: [taskflow/src/components/wiki-editor/suggestion/create-suggestion.ts, taskflow/src/components/wiki-editor/WikiEditor.tsx]
  missing: ["suggestions open only for a focused editor / user-input transactions (not after resetDoc or setContent)"]
  debug_session: "inline WKWebView probe"

- truth: "Google Docs headings paste as plain headings (test 8)"
  status: failed
  reason: "google-docs.html heading saves as `h2. *Docs heading*`."
  severity: cosmetic
  test: 8
  root_cause: "Docs wraps heading text in a span with font-weight:700; the normaliser keeps it as bold inside the heading."
  artifacts: [taskflow/src/components/wiki-editor/paste/html-normalise.ts]
  missing: ["drop bold marks that cover a whole heading"]
  debug_session: "inline WKWebView probe"

