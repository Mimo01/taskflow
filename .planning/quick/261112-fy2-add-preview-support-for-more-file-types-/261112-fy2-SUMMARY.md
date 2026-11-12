---
phase: quick-261112-fy2
plan: 01
subsystem: issue-detail attachments
tags: [attachments, preview, highlight.js]
key-files:
  modified:
    - taskflow/src/routes/dashboard/issue-detail/resolvePreviewKind.ts
    - taskflow/src/routes/dashboard/issue-detail/highlightCode.ts
    - taskflow/src/routes/dashboard/issue-detail/attachment-format.ts
  created:
    - taskflow/src/routes/dashboard/issue-detail/highlightCode.test.ts
    - taskflow/src/routes/dashboard/issue-detail/attachment-format.test.ts
requirements: [QUICK-261112-fy2]
completed: 2026-11-12
---

# Quick 261112-fy2: Preview more attachment file types

Structured `application/*` MIME types (xml, json, yaml, sql, javascript, shell, `+xml`/`+json`) now preview as highlighted code or text instead of falling to the Download fallback, with many more text/code/media extensions recognised.

## Changes
- `resolvePreviewKind.ts`: `isTextualMime`, `codeLanguageFor` (extension plus Dockerfile filename), MIME params stripped and lowercased, extended extension maps, MIME-family fallback (xml/json to code, unknown textual to text). Binary types (zip, docx, xlsx) remain `other`.
- `highlightCode.ts`: registers 14 new hljs languages and uses the shared `codeLanguageFor`.
- `attachment-format.ts`: textual MIME tiles use the FileText icon.
- Tests: resolver matrix, a guard that every mapped language is registered, xml output escaped, and modal tests for xml/json and the 2 MB cap.

## Commits
- 43253904: classifier, languages, tests
- 8e164390: tile icon and modal coverage

## Deviations
None to production code; AttachmentPreviewModal.tsx unchanged. In the modal test, the 2 MB cap assertion uses `findByText('Download')` because the toolbar also has an icon-only "Download" button, so a role query matched twice.

## Self-Check: PASSED
Full pre-commit suite (vitest, biome, tsc) passed on both commits.
