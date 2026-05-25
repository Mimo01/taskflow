---
status: resolved
trigger: "When issue has an attachment other than image, it presents a download button. It doesn't work"
created: 2026-05-25
updated: 2026-05-25
---

## Symptoms

- **Expected:** Clicking the download button triggers a file download to disk
- **Actual:** Nothing happens — button click is silent, no download initiated, no visible error
- **Errors:** No visible error in UI or browser console (unconfirmed in network tab)
- **File types affected:** All non-image attachments
- **Reproduction:** Open any issue with a non-image attachment → go to issue detail page → click download button in attachments section

## Current Focus

```yaml
hypothesis: ""
test: ""
expecting: ""
next_action: "done"
reasoning_checkpoint: ""
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-05-25T00:00:00Z
  file: taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx
  lines: 56-73
  note: "handleDownload fetched blob correctly via Tauri HTTP plugin but used URL.createObjectURL + a.click() — this browser API pattern does not trigger a file save in Tauri's WKWebView, which has no native download handler"

- timestamp: 2026-05-25T00:00:00Z
  file: taskflow/src-tauri/Cargo.toml
  note: "No tauri-plugin-fs, no tauri-plugin-dialog installed. Only plugin-opener (openUrl + openPath) is available for filesystem interactions"

- timestamp: 2026-05-25T00:00:00Z
  file: taskflow/src-tauri/src/lib.rs
  note: "No file-save command existed. dirs crate (v5) was already a transitive dep and can be declared directly"

## Eliminated

- Button missing onClick: eliminated — AttachmentFileRow.tsx correctly calls onDownload(attachment)
- Wrong/missing download URL: eliminated — att.content is passed correctly
- Fetch failing: eliminated — fetch uses Tauri HTTP plugin with Bearer auth, same pattern as image loading
- Token missing: eliminated — readSecret('jira-pat') is awaited and checked

## Resolution

```yaml
root_cause: "handleDownload used URL.createObjectURL(blob) + a.download + a.click() which does not trigger a file save in Tauri's WKWebView — the WebView has no native download handler for this browser-only API pattern"
fix: "Added a Rust save_attachment command (lib.rs) that receives Vec<u8> bytes + filename, writes to ~/Downloads with collision deduplication, returns the saved path. Frontend now invokes save_attachment with the fetched bytes then calls openPath() to reveal the file in Finder/Explorer."
verification: "cargo check passes clean; tsc --noEmit passes clean"
files_changed:
  - taskflow/src-tauri/Cargo.toml
  - taskflow/src-tauri/src/lib.rs
  - taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx
```
