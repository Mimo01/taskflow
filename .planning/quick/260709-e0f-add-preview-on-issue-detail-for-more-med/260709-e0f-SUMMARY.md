---
phase: quick-260709-e0f
plan: 01
subsystem: ui
tags: [react, highlight.js, tauri-plugin-http, jira-attachments, preview-modal]

requires: []
provides:
  - "useAuthBlob shared auth-fetch-to-blob hook (blobUrl/loading/error/getText)"
  - "resolvePreviewKind mimeType+extension attachment classifier"
  - "highlightCode highlight.js core wrapper (curated language set)"
  - "AttachmentPreviewModal type-switching preview modal (image/text/code/pdf/video/audio/other)"
affects: [issue-detail, attachments]

tech-stack:
  added: ["highlight.js@11.11.1 (core build)"]
  patterns:
    - "Shared auth-fetch-to-blob hook consumed by both AuthImage and AttachmentPreviewModal (single implementation)"
    - "Single type-switching preview modal keyed on resolvePreviewKind, not per-type components"

key-files:
  created:
    - taskflow/src/routes/dashboard/issue-detail/useAuthBlob.ts
    - taskflow/src/routes/dashboard/issue-detail/resolvePreviewKind.ts
    - taskflow/src/routes/dashboard/issue-detail/resolvePreviewKind.test.ts
    - taskflow/src/routes/dashboard/issue-detail/highlightCode.ts
    - taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx
  modified:
    - taskflow/package.json
    - taskflow/src/services/jira/types.ts
    - taskflow/src/routes/dashboard/AuthImage.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentFileRow.tsx
  deleted:
    - taskflow/src/routes/dashboard/issue-detail/AttachmentLightbox.tsx

key-decisions:
  - "highlight.js@11.11.1 legitimacy verified directly against npm registry/API before install (25M weekly downloads, canonical highlightjs/highlight.js repo, BSD-3-Clause, 4 maintainers incl. automation bot) — matches RESEARCH.md's [ASSUMED] version exactly"
  - "Size guard truncates at ~256KB text length OR ~2MB reported attachment.size, whichever triggers first (shared truncateForPreview helper for text+code branches)"
  - "highlight.js/lib/core + per-language imports only (14 languages) to keep bundle small, per RESEARCH guidance — no hljs.registerAllLanguages"

requirements-completed: [MEDIA-PREVIEW]

duration: 55min
completed: 2026-07-09
---

# Quick Task 260709-e0f: Add preview on issue detail for more media types Summary

**Inline preview for text/code/pdf/video/audio attachments via a generalized AttachmentPreviewModal, with highlight.js syntax coloring for code and a shared useAuthBlob hook reused by AuthImage.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-09T08:10:00Z
- **Completed:** 2026-07-09T08:29:50Z
- **Tasks:** 4 (1 checkpoint + 3 auto)
- **Files modified:** 11 (5 created, 5 modified, 1 deleted)

## Accomplishments
- highlight.js dependency legitimacy verified live against the npm registry (Task 1 checkpoint), then installed at 11.11.1
- Single `useAuthBlob` hook now backs both `AuthImage` and the new preview modal — one auth-fetch implementation
- `resolvePreviewKind` classifies attachments into image/text/code/pdf/video/audio/other via mimeType-first, extension-fallback detection, with 18 unit tests
- `AttachmentPreviewModal` generalizes the old image-only lightbox into a type-switching modal: plain `<pre>` for text, highlight.js-colored `<pre><code>` for code, `<iframe>` for pdf, native `<video>`/`<audio>` for media, and a download-fallback card for unsupported/errored types
- `AttachmentsSection`/`AttachmentFileRow` wired so previewable non-image rows (and thumbnails) open the modal at a unified index; unsupported rows remain download-only

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify highlight.js package legitimacy (blocking gate)** - resolved inline (see Deviations/Checkpoint Resolution below); no code commit
2. **Task 2: Foundation — highlight.js dep, size field, useAuthBlob, resolvePreviewKind, highlightCode** - `237988fa` (feat)
3. **Task 3: Generalize AttachmentLightbox into AttachmentPreviewModal** - `6c048785` (feat)
4. **Task 4: Wire previewable non-image rows into the modal** - `9de3d8c2` (feat)
5. **Format fix for resolvePreviewKind.test.ts** - `75355a87` (style)

**Plan metadata:** commit pending (handled by orchestrator per Step 8 constraints)

## Files Created/Modified
- `taskflow/src/routes/dashboard/issue-detail/useAuthBlob.ts` - Shared auth-fetch-to-blob hook (blobUrl/loading/error/getText), extracted from AuthImage
- `taskflow/src/routes/dashboard/issue-detail/resolvePreviewKind.ts` - MIME+extension attachment classifier
- `taskflow/src/routes/dashboard/issue-detail/resolvePreviewKind.test.ts` - 18 unit tests covering the classification matrix
- `taskflow/src/routes/dashboard/issue-detail/highlightCode.ts` - highlight.js core wrapper, 14 registered languages, extension→language map, highlightAuto fallback
- `taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx` - Type-switching preview modal (image/text/code/pdf/video/audio/other)
- `taskflow/package.json` / `package-lock.json` - `highlight.js@11.11.1` dependency
- `taskflow/src/services/jira/types.ts` - `size?: number` added to `JiraAttachment`
- `taskflow/src/routes/dashboard/AuthImage.tsx` - Refactored to consume `useAuthBlob`; unchanged public behavior
- `taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx` - Unified `previewable` array; swapped `AttachmentLightbox` for `AttachmentPreviewModal`
- `taskflow/src/routes/dashboard/issue-detail/AttachmentFileRow.tsx` - Optional `onPreview` prop makes previewable rows clickable
- `taskflow/src/routes/dashboard/issue-detail/AttachmentLightbox.tsx` - Deleted (superseded by AttachmentPreviewModal)

## Decisions Made
- Verified highlight.js legitimacy live (npm registry + downloads API) rather than trusting RESEARCH.md's `[ASSUMED]` flag — confirmed 11.11.1 is the correct, current 11.x latest
- Combined the TDD RED/GREEN cycle for Task 2 into a single `feat` commit (test + implementation together) rather than splitting into separate `test`/`feat` commits — see Deviations
- Size guard checks both text length (~256KB) and attachment.size (~2MB) via one shared `truncateForPreview` helper to avoid duplicating the guard logic across text/code branches

## Checkpoint Resolution (Task 1)

Performed the package legitimacy verification directly (per orchestrator instruction) instead of pausing for a separate human turn:
- `npm view highlight.js` / registry API: latest `11.11.1`, license `BSD-3-Clause`, repo `git://github.com/highlightjs/highlight.js.git`, 4 maintainers (incl. `highlightjs_bot` automation account)
- `api.npmjs.org` downloads: 25,069,821 downloads in the trailing week
- Conclusion: legitimate, canonical, high-trust package; matches RESEARCH.md's assumed version exactly. Approved and installed `highlight.js@11.11.1`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] biome-ignore comment placement/rule-name fixes for a11y and naming-convention lints**
- **Found during:** Task 3 (AttachmentPreviewModal creation)
- **Issue:** Initial `biome check` run surfaced `lint/a11y/useMediaCaption` (wrong suppression rule name used: `mediaHasCaption`), a `lint/style/useNamingConvention` warning on `__html` (a required React DOM API property name), and several `useExhaustiveDependencies` warnings/ineffective suppressions
- **Fix:** Corrected suppression rule names to match biome's actual rule IDs, moved `biome-ignore` comments to the line immediately preceding the flagged hook/JSX (matching the pattern already used in `chart.tsx`/`ConnectionsSection.tsx`), and reformatted the JSX for `dangerouslySetInnerHTML`
- **Files modified:** `AttachmentPreviewModal.tsx`
- **Verification:** `npx biome check` on all task-3/4 files returns clean (no errors, no warnings)
- **Committed in:** `6c048785` (Task 3 commit)

**2. [Rule 1 - Bug] Fixed resolvePreviewKind.test.ts biome formatting**
- **Found during:** post-Task-4 full `npm run check`
- **Issue:** Two `expect(...).toBe(...)` lines in the new test file exceeded the formatter's line-length rule and were flagged as format errors
- **Fix:** Ran `npx biome format --write` on the file to auto-format per project style
- **Files modified:** `resolvePreviewKind.test.ts`
- **Verification:** `npx biome check` on the file is clean; `npx vitest run` for the file still passes (18/18)
- **Committed in:** `75355a87`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — lint/format correctness, no scope creep)
**Impact on plan:** Both fixes were tooling-hygiene corrections required to satisfy the plan's own `<verify>` steps (tsc + biome clean). No behavior changes.

## TDD Gate Compliance

Task 2 was marked `tdd="true"` with a `<behavior>` block, which should trigger the RED→GREEN commit sequence. In practice, the test file (`resolvePreviewKind.test.ts`) and its implementation (`resolvePreviewKind.ts`) were written together and committed in a single `feat` commit (`237988fa`) rather than as separate `test(...)` (RED) then `feat(...)` (GREEN) commits. The test suite was run and confirmed passing (18/18) before committing, so the behavior contract in the plan was honored, but the git history does not show the RED phase as a separate failing-test commit. Documented here per the TDD Gate Enforcement rule since a strict RED commit is absent from git log.

## Issues Encountered
- Task 3's `<verify>` step runs `npx tsc --noEmit` across the whole repo, but `AttachmentsSection.tsx` still imported the (about to be deleted) `AttachmentLightbox` until Task 4's wiring changes landed. Resolved by implementing Task 3 and Task 4's file edits together before running any tsc/biome verification, then splitting the actual git commits along each task's declared file list (as documented in the plan frontmatter) so per-task commits stay atomic and attributable.
- Full-repo `npx vitest run` surfaces 14 pre-existing failures (10 in `AioTestRunsSection.test.tsx`, 1 in `jira.test.ts`, 3 in `CommandPalette.test.tsx`) unrelated to any file this plan touches. Confirmed pre-existing by running the identical test files against the pre-dispatch base commit (`fba060b4`) in an isolated `git worktree` — same failures reproduce there. Logged to `deferred-items.md` in this task's directory; not fixed (out of scope per the executor's scope-boundary rule).

## Next Phase Readiness
- MEDIA-PREVIEW requirement satisfied: text/code/pdf/video/audio attachments preview inline; images unaffected; unsupported types remain download-only
- No blockers. The 14 pre-existing test failures noted above are unrelated and were already present before this task started.

## Self-Check: PASSED

All 9 created/modified files confirmed present, `AttachmentLightbox.tsx` confirmed deleted, all 4 commit hashes (`237988fa`, `6c048785`, `9de3d8c2`, `75355a87`) confirmed present in git log.

---
*Quick task: 260709-e0f*
*Completed: 2026-07-09*
