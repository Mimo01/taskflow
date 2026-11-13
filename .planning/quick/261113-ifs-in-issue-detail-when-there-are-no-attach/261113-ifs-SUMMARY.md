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

## UAT rework (6e33c4f7)

User found the strip too small and disliked it under populated tiles. Research (Jira, Linear, Trello, Asana, Slack): content views make the whole surface droppable and show the affordance only during a drag, with no permanent drop box. Reworked:
- Whole section is the drop target; a dashed overlay ("Drop to attach to KEY") appears only while an OS file drag (`types` includes `Files`) is over it.
- Populated: tiles only, no box. Empty: centred paperclip circle + "No attachments" + "Drop files here or browse" (browse opens picker); no dashed border.

**UAT:** approved 2026-11-13.
