---
phase: quick-260709-e0f
verified: 2026-07-09T10:40:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open a .pdf attachment in the issue-detail attachment list"
    expected: "PDF renders inline inside the modal iframe (not a blank frame); if the Tauri webview cannot render it, a download fallback should appear instead of a blank screen"
    why_human: "PdfPreview only calls onFallback() on a network fetch error (useAuthBlob error flag) — it has no onError-equivalent for 'blob loaded but the embedding webview has no built-in PDF renderer', a known WKWebView/WebView2 limitation flagged in code review WR-05. Whether this silently blanks out can only be confirmed by opening a real PDF on the target platform."
  - test: "Open a .mp4/.webm/.mov attachment and a .mp3/.wav attachment"
    expected: "Video/audio plays with native HTML5 controls; unsupported codecs fall back to the download card instead of a broken player"
    why_human: "Real-time media playback and codec support cannot be verified by static analysis; only wired via onError -> setFallback(true)."
  - test: "Open a code attachment (e.g. .ts/.py/.json)"
    expected: "Content renders with real syntax coloring (keywords, strings, etc. in different colors against the github-dark theme), not a single flat text color"
    why_human: "Visual rendering of hljs token-span CSS classes against the imported theme stylesheet can only be confirmed by looking at the rendered UI; static grep only confirms highlightCode()/theme import are wired, not that colors actually render."
  - test: "Open a large (>256KB) text/log file and a large code file"
    expected: "Preview shows only the first ~256KB with a 'Showing first 256 KB — download for full file' notice"
    why_human: "Requires an actual large attachment to trigger the truncation branch end-to-end in the running app."
  - test: "Click a .zip or .docx attachment row"
    expected: "No preview affordance (no hover-underline, no click-to-open-modal); only Download/Delete buttons work"
    why_human: "Visual absence of a click affordance is best confirmed by interacting with the running UI, though code inspection strongly supports this (onPreview omitted when resolvePreviewKind === 'other')."
---

# Quick Task 260709-e0f: Add preview on issue detail for more media types — Verification Report

**Task Goal:** Add preview on issue detail for more media types (currently only images work): text (.txt/.md/.log/.csv) plain preview, code files syntax-highlighted via highlight.js, PDF inline preview, video inline preview, audio inline preview, unsupported types stay download-only.
**Verified:** 2026-07-09
**Status:** human_needed
**Re-verification:** No — initial verification

## Note on missing SUMMARY.md

No `260709-e0f-SUMMARY.md` exists in the task directory (only CONTEXT.md, RESEARCH.md, PLAN.md, REVIEW.md). Per the adversarial-verification mandate, this did not block verification — every claim below was checked directly against the working tree (file reads, `git log`, `tsc`, `vitest`, `biome`), not against SUMMARY narrative. The 3 execution-task commits (`237988fa`, `6c048785`, `9de3d8c2`) plus a follow-up format fix (`75355a87`) are present in `git log` and match the plan's 3 tasks; a code review (`260709-e0f-REVIEW.md`, status `issues_found`, 0 critical / 6 warning / 4 info) was completed after execution.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Text attachment (.txt/.md/.log/.csv) opens modal with plain monospace content | VERIFIED | `resolvePreviewKind.ts` maps these extensions to `'text'`; `TextPreview` in `AttachmentPreviewModal.tsx:67-108` renders `<pre className="...font-mono...whitespace-pre-wrap...">{shown}</pre>` with no highlighter |
| 2 | Code attachment (.json/.js/.ts/.py/etc.) opens modal with real syntax coloring via highlight.js, not plain text | VERIFIED | `CodePreview` (line 110-159) calls `highlightCode(shown, attachment.filename)` and injects into `<code className="hljs" dangerouslySetInnerHTML>`; `highlight.js/styles/github-dark.css` imported at top of module (line 1); `highlightCode.ts` registers 14 hljs languages and maps 18 extensions |
| 3 | PDF attachment renders inline in the modal | VERIFIED | `PdfPreview` (line 161-184) renders `<iframe src={blobUrl}>` sized `w-[90vw] h-[85vh]` — see Human Verification #1 for the "silently blank" edge case |
| 4 | Video attachment (.mp4/.webm/.mov) plays with native HTML5 controls | VERIFIED | `VideoPreview` (186-211) renders `<video controls src={blobUrl} onError={onFallback}>`; `resolvePreviewKind` maps these extensions/mimeType prefix to `'video'` |
| 5 | Audio attachment (.mp3/.wav) plays with native HTML5 controls | VERIFIED | `AudioPreview` (213-233) renders `<audio controls src={blobUrl} onError={onFallback}>` |
| 6 | Images still open in the same modal; navigation works across all previewable attachments | VERIFIED | `'image'` branch (283-293) keeps `<AuthImage>`; `AttachmentsSection.tsx` builds one `previewable` array (`attachments.filter(a => resolvePreviewKind(a) !== 'other')`) spanning images + non-images and passes it as `items` to the single modal; Prev/Next buttons + ArrowLeft/ArrowRight iterate `items.length` |
| 7 | Unsupported types (.zip/.docx) remain download-only with no broken preview affordance | VERIFIED | `resolvePreviewKind` returns `'other'` for these; `AttachmentsSection` excludes them from `previewable` and passes `onPreview={undefined}` to their `AttachmentFileRow`; `AttachmentFileRow` renders a plain non-interactive `<div>` (no hover-underline, no click handler) when `onPreview` is absent |
| 8 | Large text/code files truncate with a notice; media that fails to render shows a download fallback | VERIFIED | `truncateForPreview()` caps at 256 KB chars / attachment.size > 2 MB and renders `<TruncationNotice>`; PDF/video/audio all call `onFallback` (via hook `error` or media `onError`) which sets `fallback=true`, forcing `kind='other'` → `DownloadFallback` card with a Download button |

**Score:** 8/8 truths verified (all via static/automated evidence; 5 need human confirmation for real-device rendering behavior — see below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `useAuthBlob.ts` | Shared auth-fetch-to-blob hook, `{ blobUrl, loading, error, getText }` | VERIFIED | Exists, exports `useAuthBlob`; preserves `resolveAttachmentUrl` AIO-bridge translation, `readSecret('jira-pat')` + Bearer header, Tauri `plugin-http` fetch, `response.ok`/zero-byte checks, cancellation guard, ref-based `revokeObjectURL` cleanup |
| `AuthImage.tsx` | Refactored to consume `useAuthBlob` | VERIFIED | `grep -c "useAuthBlob"` = 3 (import + destructure use) |
| `resolvePreviewKind.ts` | MIME + extension detection → preview kind | VERIFIED | Exports `resolvePreviewKind`, matches full behavior matrix (mimeType-first, extension-fallback for generic mimes) |
| `resolvePreviewKind.test.ts` | Unit coverage for detection matrix | VERIFIED | `npx vitest run` → 18/18 tests pass |
| `highlightCode.ts` | highlight.js core wrapper, language registration, filename→language mapping | VERIFIED | Exports `highlightCode`; registers 14 languages via `hljs.registerLanguage`, falls back to `highlightAuto` for unmapped extensions |
| `AttachmentPreviewModal.tsx` | Type-switching modal (image/text/code/pdf/video/audio) | VERIFIED | Switch on `resolvePreviewKind(current)` with all 6 branches + `other`/error fallback; keyboard nav, backdrop close, caption preserved |
| `AttachmentLightbox.tsx` | Deleted (replaced by modal) | VERIFIED | File absent from working tree; `grep -rl "AttachmentLightbox" src/` returns nothing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `AttachmentsSection.tsx` | `AttachmentPreviewModal` | row/thumbnail click opens modal at unified previewable index | WIRED | `handleThumbnailClick`/`handlePreviewClick` compute `previewable.indexOf(...)`; `<AttachmentPreviewModal items={previewable} .../>` rendered unconditionally at bottom of section |
| `AttachmentPreviewModal.tsx` | `useAuthBlob` | blob fetch per non-image type | WIRED | Called in `TextPreview`, `CodePreview`, `PdfPreview`, `VideoPreview`, `AudioPreview` |
| `AttachmentPreviewModal.tsx` | `resolvePreviewKind` | branch selection on attachment | WIRED | `const kind = fallback ? 'other' : resolvePreviewKind(current)` drives the switch |
| `AttachmentPreviewModal.tsx` | `highlightCode` | code branch renders highlight.js HTML | WIRED | `CodePreview` calls `highlightCode(shown, attachment.filename)`, injects via `dangerouslySetInnerHTML` |
| `AuthImage.tsx` | `useAuthBlob` | refactor to consume shared hook | WIRED | Confirmed via grep count above |
| `AttachmentFileRow.tsx` | `AttachmentsSection.tsx` (`onPreview`) | click affordance for previewable non-image rows only | WIRED | `onPreview={resolvePreviewKind(file) !== 'other' ? () => handlePreviewClick(file) : undefined}` |

### Behavioral Spot-Checks / Automated Verification

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| highlight.js in package.json deps | `grep '"highlight.js"' package.json` | `"highlight.js": "^11.11.1"` | PASS |
| resolvePreviewKind unit tests | `npx vitest run resolvePreviewKind.test.ts` | 18/18 passed | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | 0 errors (after `npm install` — see note below) | PASS |
| Biome clean on all 7 modified TS/TSX files | `npx biome check <files>` | "Checked 7 files... No fixes applied" | PASS |
| Full issue-detail test suite | `npx vitest run src/routes/dashboard/issue-detail` | 68 passed / 10 failed / 2 skipped | 10 failures are in `AioTestRunsSection.test.tsx`, a file NOT in this phase's `files_modified` list and last touched by an unrelated commit (`feeddd23`, `260528-20i`); pre-existing/unrelated failure, not a regression from this phase |
| `AttachmentLightbox` removed | `grep -rl "AttachmentLightbox" src/` | no matches | PASS |

**Important environment note:** On first run, `npx tsc --noEmit` failed with 15 `TS2307: Cannot find module 'highlight.js/...'` errors because `node_modules/highlight.js` was physically absent even though `package.json` and `package-lock.json` both correctly declared `highlight.js@11.11.1` (lock file has a valid `resolved`/`integrity` entry). Running `npm install highlight.js@11.11.1` fixed this immediately (1 package added) and `tsc --noEmit` then passed with 0 errors. `node_modules` is gitignored, so this is most plausibly a stale/uninstalled local environment rather than a code defect — but it does mean this repo checkout, as found, would fail `npm run check` until `npm install` is (re-)run. Flagging as a warning, not a blocker, since package.json/lock are correct and a normal `npm install` step (which any fresh clone or CI run performs) resolves it.

### Anti-Patterns / Code Review Findings (carried from 260709-e0f-REVIEW.md)

| File | Issue | Severity | Impact |
|------|-------|----------|--------|
| `useAuthBlob.ts:123-127` | Unauthenticated `getText()` path never checks `response.ok` — error-page bodies could render as file content for external (non-Jira) URLs | Warning | Edge case (external URL only); doesn't affect the primary Jira-attachment flow |
| `AttachmentPreviewModal.tsx:68,111` | `TextPreview`/`CodePreview` call full `useAuthBlob` (creates unused blob URL) AND `getText()` (separate fetch) — duplicate download per open | Warning | Performance/bandwidth, not correctness |
| `AttachmentPreviewModal.tsx:21-31` | Size guard truncates only the *rendered* text; `getText()` still downloads the entire file into memory first | Warning | A huge log file will be fully fetched before truncation is cosmetically applied |
| `AttachmentPreviewModal.tsx:161-233` | No size guard at all for PDF/video/audio previews — a very large attachment is fully downloaded into memory with no upfront size check | Warning | Could cause a hang/OOM on a huge media attachment; not covered by any must-have literal wording (which only requires failure-based fallback, present) |
| `AttachmentPreviewModal.tsx:161-184` | `PdfPreview`'s `<iframe>` has no `onError` — a webview that can't render a `blob:` PDF (older WKWebView) may show a blank frame instead of falling back to download | Warning | See Human Verification #1 |
| `AttachmentsSection.tsx:42-43`, `AttachmentFileRow.tsx:19-24` | `.mimeType.startsWith(...)` called directly (no `?? ''` guard) while `resolvePreviewKind` defensively guards `mimeType ?? ''` — inconsistent; a Jira attachment with missing `mimeType` would crash these two call sites | Warning | Real-world Jira occasionally omits `mimeType` for exotic file types |
| `highlightCode.ts` / `resolvePreviewKind.ts` | `EXTENSION_TO_LANGUAGE` and `CODE_EXTENSIONS` list the same 19 extensions independently — future drift risk | Info | Maintenance only |
| `AuthImage.tsx:22` | Unsafe cast `(e as unknown as React.MouseEvent<...>)` in keyboard handler | Info | Latent footgun, harmless today |
| `AttachmentsSection.tsx:44,216` | `resolvePreviewKind(file)` computed twice per non-image row per render | Info | Redundant computation only |
| `AttachmentPreviewModal.tsx:276-277` | Modal doesn't reconcile `previewOpen` state if `items` shrinks to exclude `current` while open | Info | Rare race, not user-triggered in normal flow |

No `TBD`/`FIXME`/`XXX` unresolved debt markers found in any of the 7 modified files. None of the review findings are Critical; all 6 Warnings are robustness/performance gaps, not violations of the stated must-haves.

### Requirements Coverage

Quick-task plan declares `requirements: [MEDIA-PREVIEW]`. No `.planning/REQUIREMENTS.md` exists in this repo (quick-task workflow, not a full milestone) — requirement is task-local and covered by the CONTEXT.md decisions, all of which map to VERIFIED truths above.

### Human Verification Required

See frontmatter `human_verification` — 5 items, all real-time/visual behaviors (PDF rendering inside the actual Tauri webview, video/audio codec playback, visible syntax-highlight coloring, large-file truncation end-to-end, and the absence of a click affordance on unsupported-type rows) that cannot be confirmed by static analysis alone.

### Gaps Summary

No blocking gaps. All 8 stated must-have truths are supported by real, wired, non-stub code (verified by direct file reads, not SUMMARY narrative), and the automated verification suite specified in the PLAN (tsc, biome, vitest, greps) passes after a one-time `npm install` to materialize the already-declared `highlight.js` dependency. A prior code review surfaced 6 legitimate Warning-level robustness gaps (duplicate fetches, missing size guards for PDF/video/audio, missing `response.ok` check on the unauthenticated text path, PDF iframe missing an error affordance, inconsistent `mimeType` guarding) — none of these break a stated must-have, but they are real quality debt worth a fast-follow. Status is `human_needed` rather than `passed` purely because several truths (PDF rendering in-webview, media codec playback, visible syntax coloring, large-file truncation) are inherently runtime/visual behaviors that this verifier cannot exercise without launching the app.

---

_Verified: 2026-07-09_
_Verifier: Claude (gsd-verifier)_
