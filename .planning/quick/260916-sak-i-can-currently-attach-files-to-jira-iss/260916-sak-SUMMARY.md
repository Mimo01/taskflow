---
phase: quick-260916-sak
plan: 01
subsystem: ui
tags: [react, jira-wiki-markup, react-markdown, rehype-sanitize, comment-composer]

requires: []
provides:
  - attachmentRef(att)/isImageAttachment(att) shared markup helper (taskflow/src/lib/attachment-markup.ts)
  - AttachmentPickerModal — filterable image/file picker for referencing an issue's attachments
  - CommentComposer: Paperclip toolbar button, Edit/Preview tabs, paste/drop upload+insert
  - WikiRenderer: resolved [^filename] references render as styled file chips (icon + filename)
affects: [issue-detail, wiki-rendering, comment-composer]

tech-stack:
  added: []
  patterns:
    - "Jira wiki attachment markup: !filename! for images, [^filename] for non-images, resolved-URL fallback for hazardous filenames"
    - "wiki-attachment-chip class as the detection signal between preprocessJiraMarkup (raw HTML emission) and the `a` override in markdownComponents (chip rendering)"

key-files:
  created:
    - taskflow/src/lib/attachment-markup.ts
    - taskflow/src/lib/attachment-markup.test.ts
    - taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.test.tsx
    - taskflow/src/routes/dashboard/CommentComposer.attachments.test.tsx
  modified:
    - taskflow/src/routes/dashboard/CommentComposer.tsx
    - taskflow/src/routes/dashboard/IssueDetailView.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx

key-decisions:
  - "Chip rendering skips LinkContextMenu wrapping (unlike other external links) — using it as the render prop caused ContextMenuTrigger's own cn('select-none', className) to silently drop the chip's className AND its icon children (base-ui render-prop child/className replacement, proven empirically). Chip still reuses the shared handleClick so it routes through the same openExternal boundary."
  - "Fixed a real pre-existing bug in wikiSanitizeSchema (Rule 1): defaultSchema.attributes.a already ships its own ['className', 'data-footnote-backref'] tuple, and hast-util-sanitize's findDefinition() only honors the FIRST className tuple found per key — the plan's assumption that appending a second 'className' entry after the spread would work was incorrect. Replaced the inherited tuple with one merging both allowed values (data-footnote-backref, wiki-attachment-chip) instead of appending a shadowed second entry."
  - "Deferred: no shared WikiToolbar extraction between CommentComposer and DescriptionEditor — out of quick-task budget, per CONTEXT discretion note"

requirements-completed: [SAK-01, SAK-02, SAK-03, SAK-04]

duration: ~55min
completed: 2026-09-16
---

# Quick Task 260916-sak: Comment Attachment References Summary

**Comment composer gains an "Insert attachment" picker, Edit/Preview tabs with live image/chip resolution, and upload-on-paste/drop — plus a real rehype-sanitize className bug fixed along the way.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- Users can click a Paperclip button in the comment composer toolbar to open a filterable picker of the issue's current attachments and insert a reference at the cursor
- Selecting an image inserts `!filename!`; selecting a non-image inserts `[^filename]`; hazardous filenames (containing `!`, `|`, `]`) fall back to a resolved-URL form so they can never break the wiki-markup regexes
- The composer's new Preview tab renders inserted references live through WikiRenderer — images show inline, non-image references show as styled file chips
- Pasting or dropping a new file into the composer uploads it to the issue and inserts its reference in one motion, with an inline pending/error state
- Resolved `[^filename]` references anywhere in the app (comments, descriptions, wiki text) now render as an icon + filename chip instead of a bare link
- Found and fixed a genuine bug in the existing `wikiSanitizeSchema`: the `className` allowlist on `<a>` never actually worked because `rehype-sanitize`'s default schema already owns a `className` tuple for footnote back-references, and only the first matching tuple is honored

## Task Commits

Each task was committed atomically:

1. **Task 1: Markup helper + attachment picker modal** - `33d1b437` (feat)
2. **Task 2: Wire picker, preview tab, and paste/drop upload into CommentComposer** - `0a55a3ef` (feat)
3. **Task 3: Render resolved [^filename] references as styled file chips** - `a80ea8df` (feat)

_All three tasks were TDD (RED+GREEN combined per project convention — pre-commit hook runs the full suite)._

## Files Created/Modified

- `taskflow/src/lib/attachment-markup.ts` - `attachmentRef`/`isImageAttachment` pure markup helper
- `taskflow/src/lib/attachment-markup.test.ts` - unit tests for the markup helper
- `taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx` - filterable image/file picker dialog
- `taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.test.tsx` - picker tests
- `taskflow/src/routes/dashboard/CommentComposer.tsx` - Paperclip button, Edit/Preview tabs, paste/drop upload
- `taskflow/src/routes/dashboard/CommentComposer.attachments.test.tsx` - composer attachment-feature tests
- `taskflow/src/routes/dashboard/IssueDetailView.tsx` - passes `issue.fields.attachment` into CommentComposer
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` - chip class emission + chip rendering + sanitize schema fix
- `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` - chip rendering + regression + XSS guard tests

## Decisions Made

- **No LinkContextMenu wrapping on the chip anchor.** All other external links in WikiRenderer route through `LinkContextMenu` (right-click "Open in browser" menu). Wiring the chip the same way caused the chip's own `className` and icon children to be silently dropped — `ContextMenuTrigger`'s `cn('select-none', className)` and base-ui's render-prop child handling replaced them rather than merging. Verified empirically via a throwaway debug test. The chip instead renders a plain `<a>` that still reuses the shared `handleClick` (so left-click still routes through `openExternal`/internal-path resolution) but forgoes the right-click menu. This is a minor UX delta from other links, not a regression — chips are functionally new, not a change to prior behavior.
- **wikiSanitizeSchema fix (Rule 1 — bug, not scope creep).** The plan explicitly said "do NOT touch wikiSanitizeSchema — className is already allowlisted on `a`." That assumption turned out to be wrong: `rehype-sanitize`'s `defaultSchema.attributes.a` already contains its own `['className', 'data-footnote-backref']` tuple (for markdown footnote back-references), and `hast-util-sanitize`'s `findDefinition()` returns only the *first* tuple matching a given attribute name it finds while scanning the array — a second, later `['className', 'wiki-attachment-chip']` entry appended after the spread was silently unreachable, so every chip's class was being sanitized down to an empty string. Fixed by filtering out the inherited tuple and replacing it with one array that lists both allowed values. Proven via a throwaway pipeline test before and after the fix (documented in the commit body).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `wikiSanitizeSchema`'s `className` allowlist on `<a>` never worked**
- **Found during:** Task 3 (chip rendering)
- **Issue:** The plan's premise that `className` was "already allowlisted" on `a` was based on the attribute NAME being present in the schema array, but `hast-util-sanitize` requires values to be explicitly allowlisted via a `[name, ...values]` tuple, and `defaultSchema` already ships its own conflicting tuple for `data-footnote-backref`. Appending a second tuple was silently shadowed — every `wiki-attachment-chip` class was stripped to an empty string by sanitize, so the chip branch in `markdownComponents.a` never activated.
- **Fix:** Replaced the inherited `['className', 'data-footnote-backref']` tuple with `['className', 'data-footnote-backref', 'wiki-attachment-chip']`, filtering the old entry out of the spread first so the new one isn't shadowed.
- **Files modified:** `taskflow/src/routes/dashboard/WikiRenderer.tsx`
- **Verification:** Reproduced the empty-className bug with a throwaway pipeline test against the raw `unified`/`rehype-sanitize` pipeline before the fix; confirmed the fix restores `wiki-attachment-chip` all the way through to the rendered DOM via the new WikiRenderer.test.tsx assertions.
- **Committed in:** `a80ea8df` (Task 3 commit)

**2. [Rule 1 - Bug] Chip rendering dropped when wrapped in LinkContextMenu**
- **Found during:** Task 3 (chip rendering)
- **Issue:** Following the existing pattern of wrapping external links in `<LinkContextMenu render={<a>...}>` caused the chip's `className` and icon children to be replaced by `ContextMenuTrigger`'s own props/children (`select-none` class, no icon in output) — a base-ui render-prop composition issue, not something introduced by this task's own code, but it would have silently broken the chip feature if left as originally planned.
- **Fix:** Chip anchor renders as a plain `<a>` reusing `handleClick` directly, without `LinkContextMenu`.
- **Files modified:** `taskflow/src/routes/dashboard/WikiRenderer.tsx`
- **Verification:** WikiRenderer.test.tsx chip tests assert the icon (`svg`) and `wiki-attachment-chip` class both survive to the rendered DOM.
- **Committed in:** `a80ea8df` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs blocking the planned feature from working at all)
**Impact on plan:** Both fixes were required for Task 3's stated behavior to actually work; no scope creep beyond making the plan's own acceptance criteria achievable.

## Issues Encountered

None beyond the two auto-fixed items above (both diagnosed and resolved within Task 3).

## Known Gaps (documented per plan's <output> instructions, not oversights)

- `InlineComment.tsx:298` and `MergeRequestDetailPage.tsx:236` still pass `attachments={{}}` to `WikiRenderer`, so a `[^file]` reference in those two surfaces still degrades to a code span rather than a chip — both were explicitly out of scope for this quick task.
- No shared `WikiToolbar` component was extracted between `CommentComposer` and `DescriptionEditor` — the CONTEXT discretion note permitted extraction only if it fit the quick-task budget; it did not, so both composers keep their own inline toolbar JSX.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Feature is complete and fully tested (2728/2728 tests passing, `npm run check` clean on all touched files, `tsc --noEmit` clean, zero `@tiptap` imports, `DescriptionEditor.tsx` untouched).
- If a future task wants chip rendering in `InlineComment.tsx`/`MergeRequestDetailPage.tsx`, it only needs to pass a real `attachments` map — no further WikiRenderer changes required.

---
*Phase: quick-260916-sak*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 9 created/modified files verified present on disk. All 3 task commits (33d1b437, 0a55a3ef, a80ea8df) verified present in git log.
