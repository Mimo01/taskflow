---
status: resolved
trigger: "On issue detail, there is a problem with the attachments section. Drag and dropping files into it doesnt work. Some image files do not render the preview"
created: 2026-10-07
updated: 2026-10-07
---

## Symptoms

- **Expected:** Dropping files onto the attachments section on issue detail uploads them; all image attachments render a preview
- **Actual:** Drag-and-drop of files into the section does nothing; some image files show no preview
- **Errors:** Not provided
- **Timeline:** Unknown (related earlier session: attachment-download-broken, resolved; note Tauri/WKWebView blob gotcha — blob: URLs may blank, data: URIs work)
- **Reproduction:** Open issue detail -> attachments section -> drop a file; view issues with various image attachments (which formats fail is unknown — investigate)
- **Likely area:** taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx; Tauri window config `dragDropEnabled` (Tauri intercepts HTML5 drop events by default on desktop)

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

## Eliminated

## Resolution

root_cause: "DnD: Tauri dragDropEnabled default intercepts native drops. Preview: image with generic MIME (octet-stream) classified as file, not image; thumbnail also relied on Jira thumbnail endpoint."
fix: "dragDropEnabled:false; AuthImage fallbackSrc; thumbnail prefers full content <=2MB; resolvePreviewKind image extension fallback used by AttachmentsSection split"
verification: "User confirmed working 2026-10-07"
files_changed: []
