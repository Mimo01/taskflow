---
phase: 260709-e0f-add-preview-on-issue-detail-for-more-med
reviewed: 2026-07-09T00:00:00Z
depth: quick
files_reviewed: 10
files_reviewed_list:
  - taskflow/package.json
  - taskflow/src/routes/dashboard/AuthImage.tsx
  - taskflow/src/routes/dashboard/issue-detail/AttachmentFileRow.tsx
  - taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx
  - taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/highlightCode.ts
  - taskflow/src/routes/dashboard/issue-detail/resolvePreviewKind.test.ts
  - taskflow/src/routes/dashboard/issue-detail/resolvePreviewKind.ts
  - taskflow/src/routes/dashboard/issue-detail/useAuthBlob.ts
  - taskflow/src/services/jira/types.ts
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 260709-e0f: Code Review Report

**Reviewed:** 2026-07-09
**Depth:** quick (extended with targeted reads per reviewer note)
**Files Reviewed:** 10 (`package-lock.json` excluded as a lock file; `AttachmentLightbox.tsx` confirmed deleted/replaced by `AttachmentPreviewModal.tsx` — not present in working tree)
**Status:** issues_found

## Summary

Reviewed the new attachment-preview feature (image/text/code/pdf/video/audio preview modal, shared auth-blob-fetch hook, syntax highlighting, preview-kind classification). The core auth-fetch → blob-URL lifecycle in `useAuthBlob.ts` is actually implemented carefully (cancellation flag checked both before and after the blob is materialized, ref-based revocation on cleanup) — no blob URL leak was provable. However, several correctness and robustness gaps remain: an unauthenticated fetch path that never checks `response.ok` (silently renders error-page bodies as file content), preview components that trigger a redundant full second fetch of the same resource, and file-size guards that only truncate the *displayed* text after the entire file has already been downloaded into memory — with no size guard at all for video/audio/PDF previews. None of these rise to Critical (no security/crash/data-loss), but several are real functional bugs that should be fixed before shipping.

## Warnings

### WR-01: Unauthenticated `getText()` path never checks `response.ok`

**File:** `taskflow/src/routes/dashboard/issue-detail/useAuthBlob.ts:123-127`
**Issue:** In the `!needsAuth` branch of `getText()`:
```ts
if (!needsAuth) {
  const resp = await fetch(resolvedSrc);
  return resp.text();
}
```
Unlike the authenticated branch a few lines below (which does `if (!response.ok) throw new Error(...)`), this path never checks `resp.ok`. If the external URL 404s, redirects to a login page, or 500s, the error page's HTML/text body is returned as if it were the file content, and `TextPreview`/`CodePreview` will happily render that garbage as the attachment body instead of showing the `[content not available]` error state.
**Fix:**
```ts
if (!needsAuth) {
  const resp = await fetch(resolvedSrc);
  if (!resp.ok) throw new Error('Failed to fetch attachment text');
  return resp.text();
}
```

### WR-02: `TextPreview`/`CodePreview` trigger a redundant duplicate fetch of the same resource

**File:** `taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx:68,111`
**Issue:** Both components call `useAuthBlob(attachment.content)` and only consume `{ loading, error, getText }` — but `useAuthBlob`'s internal `useEffect` unconditionally fetches the resource, converts it to a Blob, and creates (then later revokes) an object URL that is never used by either component. Separately, `getText()` performs a *second*, independent authenticated fetch of the exact same URL to get the text body. For a large log/code file this means two full downloads (and two `readSecret('jira-pat')` calls) per preview open/navigation, rather than one.
**Fix:** Split the hook so blob-URL creation is opt-in, e.g. add a `skipBlob` option (or a separate `useAuthText` hook that only does the text fetch) and have `TextPreview`/`CodePreview` use that instead of the full `useAuthBlob`.

### WR-03: Text/code preview size guard only truncates *display* after the full file is already downloaded

**File:** `taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx:21-31`
**Issue:** `MAX_PREVIEW_FILE_SIZE`/`MAX_PREVIEW_CHARS` only gate what gets *rendered* — `getText()` (via `useAuthBlob.getText`) always downloads and converts the entire attachment body via `blob.text()` before `truncateForPreview` ever runs. A large log file (e.g. hundreds of MB) will be fully fetched into memory and converted to a JS string, with truncation applied only cosmetically afterward, before the "truncated" notice is shown. Combined with WR-02's duplicate fetch, this doubles the memory/bandwidth cost.
**Fix:** Check `attachment.size` (or a `HEAD`/`Content-Length` probe) *before* fetching the body, and skip the full-text fetch entirely when the attachment is oversized, showing the "download for full file" fallback without ever downloading it inline.

### WR-04: No file-size guard at all for PDF/video/audio previews

**File:** `taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx:161-233`
**Issue:** `PdfPreview`, `VideoPreview`, and `AudioPreview` all call `useAuthBlob(attachment.content)` and render `blobUrl` directly with no size check whatsoever — unlike the (weak) guard that exists for text/code. A multi-hundred-MB or multi-GB video/PDF attachment will be fully downloaded into an in-memory `Blob` before any playback/render is attempted, with no upfront warning or opt-out.
**Fix:** Apply the same `attachment.size` guard used in `truncateForPreview` to these preview kinds — e.g. render `DownloadFallback` directly (without ever fetching) when `attachment.size` exceeds a configured cap.

### WR-05: PDF iframe has no failure detection for "webview can't render this blob"

**File:** `taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx:161-184`
**Issue:** `PdfPreview` only calls `onFallback()` when `useAuthBlob`'s `error` flag is set (i.e., the network fetch failed). It does not handle the case where the fetch succeeds but the embedding webview (Tauri's WKWebView/WebView2) has no built-in PDF renderer for a `blob:` URL in an `<iframe>` — unlike `VideoPreview`/`AudioPreview`, which at least wire `onError={onFallback}` on the media element, `<iframe>` has no equivalent generic renderer-failure signal here, so a broken/blank PDF preview will silently show nothing instead of falling back to `DownloadFallback`.
**Fix:** At minimum wire `onError` on the iframe (covers navigation failures) and consider feature-detecting PDF viewer support, or default straight to `DownloadFallback` for `pdf` kind if this is a known limitation on the target Tauri webview.

### WR-06: Inconsistent handling of `mimeType` possibly being empty/missing across files

**File:** `taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx:42-43`, `taskflow/src/routes/dashboard/issue-detail/AttachmentFileRow.tsx:19-24`
**Issue:** `resolvePreviewKind.ts` defensively does `attachment.mimeType ?? ''` before calling `.startsWith`, implying the author expects `mimeType` may be falsy at runtime despite `JiraAttachment.mimeType: string` being typed as required (`taskflow/src/services/jira/types.ts:167`). `AttachmentsSection.tsx` (`a.mimeType.startsWith('image/')`) and `AttachmentFileRow.tsx`'s `getFileIcon(mimeType)` (`mimeType.startsWith(...)`) call `.startsWith` directly with no guard. If the Jira API ever omits `mimeType` for an attachment (real-world Jira instances sometimes do for exotic file types), these two call sites will throw a `TypeError` and crash the whole `AttachmentsSection`, whereas `resolvePreviewKind` degrades gracefully.
**Fix:** Either tighten the type to guarantee non-empty `mimeType` at the data layer, or apply the same `?? ''` guard consistently at all three call sites.

## Info

### IN-01: Extension→language/kind maps duplicated across two files

**File:** `taskflow/src/routes/dashboard/issue-detail/highlightCode.ts:32-52`, `taskflow/src/routes/dashboard/issue-detail/resolvePreviewKind.ts:5-25`
**Issue:** `EXTENSION_TO_LANGUAGE` and `CODE_EXTENSIONS` currently list the identical 19 extensions, but they're independently maintained. A future addition of a new code extension to one map and not the other will silently misclassify files (e.g. `resolvePreviewKind` says "code" but `highlightCode` falls back to `highlightAuto`, or vice versa).
**Fix:** Extract a single shared `CODE_EXTENSION_LANGUAGE_MAP` (extension → hljs language name) and derive both `CODE_EXTENSIONS` (`Object.keys(...)`) and `EXTENSION_TO_LANGUAGE` from it.

### IN-02: Unsafe type cast in `AuthImage`'s keyboard handler

**File:** `taskflow/src/routes/dashboard/AuthImage.tsx:22`
**Issue:** `onClick(e as unknown as React.MouseEvent<HTMLImageElement>)` casts a `KeyboardEvent` to `MouseEvent` purely to satisfy the type checker. It happens to be harmless today because the only caller (`AttachmentsSection.handleThumbnailClick`) ignores the event argument, but it's a latent footgun for any future caller that reads mouse-specific properties (`clientX`, `button`, etc.) off the "mouse" event.
**Fix:** Change the `onClick` prop type to accept a union (`React.MouseEvent | React.KeyboardEvent`) or a plain callback with no event argument, and drop the cast.

### IN-03: `resolvePreviewKind(file)` computed twice per row per render

**File:** `taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx:44,216`
**Issue:** `previewable` is computed once via `attachments.filter((a) => resolvePreviewKind(a) !== 'other')`, then `resolvePreviewKind(file)` is called again per non-image row to decide whether to pass `onPreview`. Not a correctness bug, just redundant computation that could drift if the two call sites' logic ever diverges.
**Fix:** Compute a `Map<string, PreviewKind>` (keyed by attachment id) once and reuse it for both the filter and the row-level check.

### IN-04: Modal doesn't reset `previewOpen`/`previewIndex` when the underlying attachment disappears

**File:** `taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx:276-277`
**Issue:** If `items` (the `previewable` list) shrinks while the modal is open — e.g. another user/process removes the attachment and a refetch updates `attachments` — `current = items[currentIndex]` can become `undefined`, and the function returns `null`. The modal is still logically "open" (`previewOpen` stays `true` in the parent), so nothing renders but the parent's state isn't reconciled; re-triggering the same preview open state later could show a stale/blank result until `previewIndex` happens to be clamped by a subsequent user action.
**Fix:** In `AttachmentPreviewModal`, call `onClose()` (or clamp `currentIndex`) when `current` is `undefined` rather than silently rendering `null`.

---

_Reviewed: 2026-07-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
