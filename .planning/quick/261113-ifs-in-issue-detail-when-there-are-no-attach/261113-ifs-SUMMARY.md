# Quick 261113-ifs Summary

Always-present dashed drop strip in the issue-detail Attachments section. It replaces the italic "No attachments" line and the separate drag overlay.

- Strip reads "No attachments" plus "Drop files here or browse" when empty, and only "Drop files here or browse" below the tile grid when populated.
- Clicking the strip opens a hidden file input. Picked and dropped files share one `uploadMutation` through a `startUpload` helper.
- Drag-over tints the strip ("Drop file to attach"). The old overlay div is removed.
- `handleDragLeave` ignores leaves into child elements, which avoids flicker.
- `AttachmentUpload.tsx` is untouched.

Commit: b04e9808 (2 files: AttachmentsSection.tsx and AttachmentsSection.test.tsx). Full vitest suite, biome and tsc passed.

## Deviations
- The worktree base differed from the required hash, so I ran `git reset --hard 41f43133`, as the instructions say to.
- Renamed the setters `setDropUpload*` to `setUpload*` along with the state variables.
