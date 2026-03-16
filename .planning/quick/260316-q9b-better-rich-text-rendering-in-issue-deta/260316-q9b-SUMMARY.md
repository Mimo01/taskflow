---
phase: quick
plan: 260316-q9b
subsystem: ui
tags: [react-markdown, rehype-raw, jira, rich-text, lightbox, mentions, callouts]

requires:
  - phase: none
    provides: existing WikiRenderer with jira2md pipeline
provides:
  - Enhanced WikiRenderer with mention badges, image lightbox, and callout panels
  - AuthImage component for authenticated Jira attachment loading
  - ImageLightbox component for fullscreen image preview
  - preprocessJiraMarkup function for Jira wiki pre-processing
affects: [issue-detail, wiki-rendering]

tech-stack:
  added: [rehype-raw]
  patterns: [jira-markup-preprocessing, custom-react-markdown-components, authenticated-image-fetch]

key-files:
  created:
    - taskflow/src/routes/dashboard/ImageLightbox.tsx
    - taskflow/src/routes/dashboard/AuthImage.tsx
  modified:
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/services/jira.ts

key-decisions:
  - "preprocessJiraMarkup runs BEFORE jira2md to convert mentions and panels to custom HTML tags"
  - "rehype-raw plugin enables custom HTML passthrough in react-markdown pipeline"
  - "mention component uses Record<string, unknown> intersection type to bypass strict Components typing"
  - "AuthImage fetches attachment URLs via Tauri HTTP client for authenticated image loading"
  - "Attachment filename-to-URL map and user display name map passed as props to WikiRenderer"

patterns-established:
  - "Jira markup preprocessing: convert non-standard wiki syntax to HTML before jira2md conversion"
  - "Custom react-markdown components: define as Record<string, unknown> to support non-standard elements"

requirements-completed: [RICH-TEXT]

duration: 20min
completed: 2026-03-16
---

# Quick Task 260316-q9b: Better Rich Text Rendering in Issue Detail Summary

**Jira mentions as pill badges, info/warning/note/panel callout boxes, inline images with authenticated fetch and fullscreen lightbox**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-16T18:03:37Z
- **Completed:** 2026-03-16T18:23:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- User mentions (`[~username]`, `[~accountId:xxx]`) render as styled pill badges with display name resolution
- Info/warning/note/panel callouts render as color-coded bordered boxes instead of raw markup
- Images render inline with max-width constraint, clickable to open fullscreen lightbox overlay
- Jira attachment images load via authenticated HTTP fetch (AuthImage component)
- IssueDetailContent passes attachment map and user map to WikiRenderer for resolution
- 23 WikiRenderer tests all passing with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for mentions, callouts, images** - `a78dbeb` (test)
2. **Task 1 GREEN: Implement preprocessor, renderers, lightbox** - `2bfe119` (feat)
3. **Task 2: Comprehensive test coverage** - `1585630` (test)
4. **Task 3: Visual verification + auth image fix** - `7f947d1` (fix)

_Note: Task 1 followed TDD with RED/GREEN commits. Task 3 checkpoint included additional fixes for authenticated images and mention display names._

## Files Created/Modified
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` - Enhanced with preprocessJiraMarkup, custom react-markdown components for mentions/callouts/images
- `taskflow/src/routes/dashboard/ImageLightbox.tsx` - Fullscreen overlay for image viewing with Escape/click-to-close
- `taskflow/src/routes/dashboard/AuthImage.tsx` - Authenticated image loading via Tauri HTTP client for Jira attachments
- `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` - 23 tests covering mentions, callouts, images, mixed content, and regression
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` - Builds attachment/user maps from issue data, passes to WikiRenderer
- `taskflow/src/services/jira.ts` - Added attachment field to API fetch, JiraAttachment type

## Decisions Made
- Used `rehype-raw` to enable custom HTML tag passthrough in react-markdown (mentions use `<mention>` custom element)
- `preprocessJiraMarkup` runs before jira2md to handle markup jira2md does not understand
- Components map typed as `Record<string, unknown>` to support non-standard `mention` element without TS errors
- AuthImage component uses Tauri HTTP client to fetch authenticated attachment URLs, converting to blob for display
- Attachment filename-to-URL map built from issue.fields.attachment array; user display name map from comment authors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Jira attachment images require authenticated fetch**
- **Found during:** Task 3 (visual verification)
- **Issue:** Jira attachment image URLs require authentication; standard `<img>` tags returned 401
- **Fix:** Created AuthImage component that fetches via Tauri HTTP with auth headers, added attachment field to API, built filename-to-URL map
- **Files modified:** AuthImage.tsx, WikiRenderer.tsx, IssueDetailContent.tsx, jira.ts
- **Verification:** Images load correctly in running app
- **Committed in:** 7f947d1

**2. [Rule 2 - Missing Critical] Mention display name resolution**
- **Found during:** Task 3 (visual verification)
- **Issue:** Mentions showed raw usernames/accountIds instead of display names
- **Fix:** Built user name lookup map from issue comment authors, passed to WikiRenderer preprocessor
- **Files modified:** WikiRenderer.tsx, IssueDetailContent.tsx
- **Verification:** Mentions show display names in running app
- **Committed in:** 7f947d1

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes essential for correct real-world rendering. No scope creep.

## Issues Encountered
- Integration test for mixed content initially failed because Jira wiki image syntax (`!image.png!`) requires blank lines between different content types for markdown parsing -- fixed with proper spacing in test input
- react-markdown Components type does not allow custom element names -- resolved with Record<string, unknown> type assertion

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- WikiRenderer now handles all common Jira rich text elements
- Future enhancement: table rendering, color text, emoji shortcodes if needed

---
*Quick task: 260316-q9b*
*Completed: 2026-03-16*
