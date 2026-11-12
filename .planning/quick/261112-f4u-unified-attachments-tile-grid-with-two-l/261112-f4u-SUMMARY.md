# Quick Task 261112-f4u: Unified attachments tile grid - Summary

**One-liner:** Issue-detail Attachments now renders one mixed-order grid of uniform 4:3 AttachmentTile cards (2-line reserved filename caption, whole-tile preview, hover corner Download/Delete); AttachmentFileRow removed.

## Commits
- 30ec3e36: feat - attachment-format.ts (formatFileSize, getFileIcon, getAttachmentImageSrc, MAX_FULL_THUMB_BYTES), AttachmentTile + tests, getExtension exported, AttachmentThumbnail uses shared src helper
- c921736c: feat - AttachmentsSection single grid, imports repointed (DescriptionEditor, AttachmentPickerModal, AttachmentPreviewModal), WikiRenderer comment updated, AttachmentFileRow + test deleted, AttachmentsSection.test.tsx added

## Verification
- tsc clean; biome clean on touched files; full vitest suite (pre-commit) passed on both commits (4942 tests on commit 1).
- `grep -rn AttachmentFileRow src` is empty.

## Deviations from Plan
- Worktree base was e7e50155, not the expected 18b19b5a; reset --hard to 18b19b5a per the branch check.
- node_modules symlinked from main repo (untracked, not committed).
- Caption min-height uses `min-h-[2.75em]` (the plan's allowed fallback to `2lh`), not `2lh`.
- Delete/Download wrapper offset is `top-2.5 right-2.5` (tile has p-1 so this lands at 1.5 inside the thumb), per the plan's intent of top-1.5/right-1.5 over the thumb.
- Added `data-testid="attachment-tile"` to the tile root (the plan allowed this for the section test).
- No production code was bent to satisfy test mocks.

## Known Stubs
None.

## Threat Flags
None. Filename rendered only as React text / title attribute (T-f4u-01 mitigated).

## Self-Check: PASSED

## UAT (2026-11-12) — Approved
- cba6f45d: line-clamp-2 was overridden by `block` (names ran 3+ lines); caption block reserves 2 name lines + size so short names keep size directly beneath; roomier hover wash (p-1.5), column gap 12px.
- 751bb11e: file-type label stacked directly under the icon (was pinned to thumb bottom — "too low").
- 86285678: Attachments section no longer collapsible (chevron toggle = visual mess); always open.
