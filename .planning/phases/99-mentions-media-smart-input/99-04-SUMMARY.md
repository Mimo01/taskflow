---
phase: 99-mentions-media-smart-input
plan: 04
subsystem: wiki-editor
tags: [tiptap, nodeviews, mentions, images, emoticons]
requires: [99-01]
provides:
  - "MentionView, ImageView, AttachmentChip, EmoticonView React node views"
  - "EMOTICONS table and emoticonGlyph() (shared with the ':' autocomplete)"
  - "WikiNodeViews slots for mention/image/attachment/emoticon"
affects: [99-02, 99-03, 99-05]
key-files:
  created:
    - taskflow/src/components/wiki-editor/nodeviews/MentionView.tsx
    - taskflow/src/components/wiki-editor/nodeviews/ImageView.tsx
    - taskflow/src/components/wiki-editor/nodeviews/AttachmentChip.tsx
    - taskflow/src/components/wiki-editor/nodeviews/EmoticonView.tsx
    - taskflow/src/components/wiki-editor/nodeviews/media-views.test.tsx
    - taskflow/src/components/wiki-editor/suggestion/emoticon-data.ts
    - taskflow/src/components/wiki-editor/suggestion/emoticon-data.test.ts
  modified:
    - taskflow/src/components/wiki-editor/extensions.ts
    - taskflow/src/components/wiki-editor/rich-extensions.ts
    - taskflow/src/components/wiki-editor/schema-parity.test.ts
key-decisions:
  - "Image display ignores params and never writes attrs, so |width= round-trips verbatim"
  - "Image source order: local preview, host attachment via AuthImage, http(s) URL via AuthImage, filename chip"
requirements-completed: [INPUT-01, INPUT-02, INPUT-06]
completed: 2026-11-17
---

# Phase 99 Plan 04: Media node views Summary

Mentions, images, `[^file]` attachments and emoticons now render in the editor like the read view, with the saved wiki text unchanged.

## Tasks

1. Emoticon table and four node views, and 2. wiring plus tests: one combined commit a5ccf4a (RED/GREEN combined because the pre-commit hook runs the full suite).

- MentionView: WikiRenderer pill; resolved from `useHost().userMap`, muted raw username when unresolved, username in tooltip, reactive to host changes.
- ImageView: `max-w-full rounded-md`, no lightbox, click selects the node (ring-1 ring-ring), `draggable={false}`.
- EmoticonView shows the glyph; renderHTML emits `src` so copy/paste round-trips mention id, image name/params and attachment name.
- Node views are created with `ReactNodeViewRenderer(..., { as: 'span' })` for the inline atoms.

## Deviations from Plan

**1. [Rule 1 - Test] Node views render asynchronously in tests**
- Tiptap mounts React node views after the first render, so media-views.test.tsx uses `waitFor` before asserting. No production change.

**2. Pre-commit hook flakiness under load**
- The full-suite hook timed out (5s) on EpicDetailSheet, IssueDetailSheet, WorklogsPage and FindBar while sibling agents drove machine load to ~60. All pass in isolation (src/routes/dashboard: 2111 pass). The commit succeeded without `--no-verify` once load dropped.

## Known Stubs
None.

## Threat Flags
None. All text rendered as React children; remote images only via AuthImage; image params never written.

## Self-Check: PASSED
- All created files exist; commit a5ccf4a exists; tsc clean; wiki-editor and wiki suites green.
