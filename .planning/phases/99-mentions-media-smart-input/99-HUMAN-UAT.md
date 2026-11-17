---
status: pending
phase: 99-mentions-media-smart-input
source: [99-14-PLAN.md, 99-11-SUMMARY.md, 99-12-SUMMARY.md, 99-13-SUMMARY.md]
started: 2026-11-17
updated: 2026-11-17
---

## Current Test

[awaiting user — run `npm run tauri dev` in `taskflow/`, open Settings > Dev tools > Editor tab]

Automated gates before UAT: `npm test` 420 files / 6422 tests passed; `npx tsc --noEmit` clean.

Setup: every step uses the Editor tab (Settings > Dev tools > Editor). Controls: Preset (Full / Compact), Host context (Project key, Staged mode switch, Upload: Succeed / Fail / Slow 3s), Paste sample, Capture next paste, Open in dialog, Width. Use placeholder content only (DEMO- keys, stub names). Never commit real Jira or Word content.

## Tests

### 1. Finder drag and drop (image + PDF)
Editor tab: Preset Full, Upload Succeed. Drag one PNG and one PDF from Finder into the editor in the middle of a paragraph.
expected: two placeholders appear at the drop point, then resolve to an `!name!` image chip and a `[^name]` file chip. The drop does not also trigger any outer drop zone.
result: pending

### 2. Slow upload keeps typing
Upload Slow 3s. Drop a file, keep typing while the placeholder spins.
expected: typing is never blocked, text lands in the right places, placeholder resolves after about 3s.
result: pending

### 3. Failed upload
Upload Fail. Drop a file.
expected: the chip is removed and an error line names the file; Dismiss clears the line.
result: pending

### 4. Clipboard screenshot paste
Take a screenshot to clipboard (Cmd+Ctrl+Shift+4), click in the editor, Cmd+V (Upload Succeed).
expected: an `image-YYYYMMDD-HHMMSS.png` image embeds and renders inline.
result: pending

### 5. Staged mode previews
Host context: turn the Staged mode switch on. Paste an image.
expected: the preview renders immediately (not blank), the Staged files list shows it, the verdict text keeps the filename.
result: pending

### 6. Delete embed prompt
Staged mode off, Upload Succeed. Paste an image, then delete the embed. Also delete an embed of a pre-existing placeholder attachment.
expected: for the just-uploaded embed an "Also delete attachment?" row appears and auto-dismisses after 6s; Delete removes it from the uploaded list. The pre-existing placeholder attachment shows nothing.
result: pending

### 7. Cmd+Shift+V plain paste
Copy a formatted section from a web page, then Cmd+Shift+V in the editor.
expected: arrives as plain text with no formatting.
result: pending

### 8. Real Jira and Word paste samples
Click Capture next paste, then paste from a real Jira issue view; repeat with Word. Review the captured html/plain textareas. Do not keep real content.
expected: record whether mentions, keys, emoticons, panels, lists and tables map correctly. Any mis-mapped sample is saved as a placeholder-only gap note (DEMO- keys, stub names), never real content.
result: pending

### 9. Esc nesting in a dialog
Click Open in dialog, type `@`, press Esc once, then Esc again. Repeat with the bubble menu visible (select text).
expected: first Esc closes the popover (or bubble), dialog stays open; second Esc closes the dialog.
result: pending

### 10. Caret after insertions
In the editor insert, in turn: a mention (`@`), an emoticon (`:`), an issue key (`DEMO-`), an attachment from the picker, a table from `/`.
expected: the caret lands right after each inserted item and typing continues there.
result: pending

### 11. Compact preset
Preset Compact.
expected: the bubble shows on selection only and never together with a toolbar; footer Attach, Mention and Emoticon work and focus returns to the editor.
result: pending

### 12. Source mode
Switch to Source mode (Rich | Source). Type `@` and then `:`; paste a file / drop a file.
expected: the `@` popover appears at the textarea caret and Esc closes just that popover; file paste or drop inserts upload markup at the caret and uploads the file; a file plus text paste uploads the file and skips the text.
result: pending

## Summary

total: 12
passed: 0
issues: 0
pending: 12

## Gaps

[none recorded yet]
