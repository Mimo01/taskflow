# Quick Task 260709-e0f: Media-type previews on issue detail — Research

**Researched:** 2026-07-09
**Domain:** Tauri (WKWebView/WebView2) + React 19 attachment preview
**Confidence:** HIGH (codebase-anchored); MEDIUM (webview PDF/codec behavior)

## Summary

The issue-detail attachment UI already has a clean, reusable auth-fetch-to-blob pattern
(`AuthImage.tsx`) and a type-split in `AttachmentsSection.tsx` (`image/*` → thumbnail grid +
lightbox; everything else → a bare `AttachmentFileRow` with download only, **no preview**).
Adding new media types is a matter of (1) extracting the auth-blob fetch into a shared hook,
(2) generalizing the image-only `AttachmentLightbox` into a type-switching preview modal, and
(3) routing non-image rows into that modal instead of leaving them download-only.

**No syntax-highlighter dependency exists** in the project (react-markdown renders code blocks
plainly via `@tailwindcss/typography`). CSP is disabled (`"csp": null`), so blob URLs work
freely in `<iframe>`/`<embed>`/`<video>`/`<audio>` — native HTML5 elements cover PDF, video,
and audio with zero new dependencies.

**Primary recommendation:** Extract a `useAuthBlob(url)` hook from `AuthImage`, generalize
`AttachmentLightbox` → `AttachmentPreviewModal` that switches on `mimeType`, render text/code
via `<pre>` (monospace) with a size guard, PDF/video/audio via native HTML5 elements with the
blob URL. Only add a highlighter dependency if real syntax coloring is a hard requirement.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Text files (.txt, .md, .log, .csv) — render as plain (or lightly formatted) text inline
- PDF documents — render inline (embedded viewer or first-page render)
- Video (.mp4, .webm, .mov) — inline HTML5 video player
- Audio (.mp3, .wav) — inline HTML5 audio player
- Code files (.json, .js, .ts, .py, etc.) — syntax-highlighted text preview

### Claude's Discretion
- Single type-switching component vs one-per-type — **match the existing pattern** (do not
  introduce a second pattern).
- Fallback for unsupported types (.zip, .docx) — generic file icon + name + download link
  (this is the current `AttachmentFileRow` behavior).
- Text/code size limits — truncate very large files based on how attachments load.
- PDF approach — native `<embed>`/`<iframe>` vs JS PDF lib; pick lightest that works in Tauri
  without a heavy new dependency.

### Deferred Ideas (OUT OF SCOPE)
- None specified.
</user_constraints>

## How Attachments Work Today (codebase-anchored)

**Type shape** (`src/services/jira/types.ts:162`):
```ts
interface JiraAttachment { id: string; filename: string; content: string; thumbnail?: string; mimeType: string; }
```
`content` is the Jira REST binary URL; `mimeType` is server-provided. (Note: `AttachmentFileRow`
and `AttachmentLightbox` read `attachment.size`, but `size` is **not** on the interface — it
arrives untyped from the API. If the plan relies on `size` for a guard, add `size?: number` to
the interface. `[VERIFIED: codebase grep]`)

**Auth fetch → blob pattern** (`src/routes/dashboard/AuthImage.tsx`) — the canonical reusable
mechanism. `[VERIFIED: codebase]`
- Reads PAT via `readSecret('jira-pat')`, fetches `attachment.content` with
  `Authorization: Bearer <token>` using `fetch` from `@tauri-apps/plugin-http` (NOT the browser
  fetch — required so the request escapes the webview origin).
- `response.blob()` → `URL.createObjectURL(blob)` → renders; cleans up with
  `URL.revokeObjectURL` on unmount/URL change; handles cancel, `!ok`, and zero-byte errors.
- Also translates AIO bridge URLs to the direct download endpoint (edge case; not relevant to
  standard Jira attachments but the hook should preserve it).

**Type routing** (`src/routes/dashboard/issue-detail/AttachmentsSection.tsx:41`):
```ts
const images = attachments.filter((a) => a.mimeType.startsWith('image/'));
const nonImages = attachments.filter((a) => !a.mimeType.startsWith('image/'));
```
Images → `AttachmentThumbnail` grid → click opens `AttachmentLightbox` (image-only, uses
`AuthImage`). Non-images → `AttachmentFileRow` (icon + name + size + Download/Delete; **no
preview, not clickable for preview**). `getFileIcon` in `AttachmentFileRow.tsx:18` already
distinguishes `text/*` and `application/pdf` (→ `FileText`).

**Download path** (`AttachmentsSection.handleDownload`): auth-fetch blob → `Uint8Array` →
Rust `save_attachment(bytes, filename)` command (`src-tauri/src/lib.rs:35`). Preview does **not**
need this — preview stays in-memory via blob URL.

**CSP:** `src-tauri/tauri.conf.json` → `"security": { "csp": null }` — no CSP restrictions on
blob URLs in `<iframe>`/`<embed>`/`<video>`/`<audio>`. `[VERIFIED: codebase]`

## Recommended Approach Per Type

| Type | Extensions | Detection | Render | New dep? |
|------|-----------|-----------|--------|----------|
| Text | .txt .md .log .csv | `mimeType.startsWith('text/')` (+ ext fallback for .md/.log/.csv which Jira may send as `application/octet-stream`) | `blob.text()` → `<pre className="font-mono text-xs whitespace-pre-wrap overflow-auto">` with size guard | No |
| Code | .json .js .ts .py … | extension allowlist (Jira mimeType often generic) | `<pre>` monospace (MVP) **or** highlighter (see below) | Optional |
| PDF | .pdf | `mimeType === 'application/pdf'` | `<iframe src={blobUrl}>` or `<embed type="application/pdf">` | No |
| Video | .mp4 .webm .mov | `mimeType.startsWith('video/')` | `<video controls src={blobUrl}>` | No |
| Audio | .mp3 .wav | `mimeType.startsWith('audio/')` | `<audio controls src={blobUrl}>` | No |
| Other | .zip .docx … | fallback | Current `AttachmentFileRow` (icon + download) | No |

**MIME detection guidance:** Extend the existing `startsWith` checks. Jira reliably sets
`image/*`, `application/pdf`, `video/*`, `audio/*`, `text/plain`. For `.md/.log/.csv/.json` and
code files it frequently returns `text/plain` or `application/octet-stream`, so add an
**extension-based fallback map** (derive from `attachment.filename`) layered on top of `mimeType`.
Do not invent a new detection subsystem — one helper `resolvePreviewKind(attachment)` returning
`'image'|'text'|'code'|'pdf'|'video'|'audio'|'other'`. `[VERIFIED: codebase pattern]`

### Syntax highlighting decision
There is **no** highlighter in the project (`shiki`/`prismjs`/`highlight.js`/`react-syntax-highlighter`
all absent from `node_modules` and `package.json`; react-markdown renders code blocks plainly).
`[VERIFIED: codebase grep + node_modules scan]`

- **Lightest (recommended for MVP):** plain `<pre>` monospace for both text and code. Zero new
  deps, consistent, matches "simplest" discretion. Satisfies the letter of the text/code
  requirement minus coloring.
- **If coloring is required:** add **`highlight.js`** (v11.11.1) using `highlight.js/lib/core`
  and register only the needed languages (json/js/ts/python/etc.) to keep the bundle small —
  `hljs.highlight(code, { language }).value` into `<pre><code dangerouslySetInnerHTML>`. Lighter
  and simpler than `shiki` (v4.3.1, async WASM/oniguruma) or `react-syntax-highlighter` (v16.1.1,
  bundles all of prism/hljs). All three ` [ASSUMED]` — versions confirmed to exist on npm but
  discovered from training, not authoritative docs; verify + slopcheck before install.

Recommend the plan **start with plain `<pre>`** and treat highlight.js as a fast-follow toggle,
to avoid a dependency add on a quick task unless the user insists on coloring.

## Architecture (match existing pattern)

The existing pattern is a **single type-switching modal** (`AttachmentLightbox`), not one
component per type. Follow it:

1. **Extract `useAuthBlob(url)` hook** from `AuthImage` → returns `{ blobUrl, error, loading }`
   (and optionally a `text` accessor / lazy `blob.text()`). Refactor `AuthImage` to consume it so
   there is one auth-fetch implementation. Preserve AIO-bridge URL translation and blob cleanup.
2. **Generalize `AttachmentLightbox` → `AttachmentPreviewModal`**: keep the overlay/keyboard/nav
   chrome, but the body switches on `resolvePreviewKind(attachment)`. Image branch keeps
   `AuthImage`; new branches render `<pre>`/`<iframe>`/`<video>`/`<audio>` off `useAuthBlob`.
3. **Make non-image rows previewable**: in `AttachmentsSection`, either (a) build a unified list
   where every previewable attachment opens the modal, or (b) keep the image grid and make
   `AttachmentFileRow` clickable to open the modal at that item. Non-previewable types keep the
   plain row + download.

## Don't Hand-Roll

| Problem | Don't build | Use instead |
|---------|-------------|-------------|
| Auth blob fetch for each type | New fetch per component | Extract & reuse `AuthImage`'s logic as `useAuthBlob` |
| PDF rendering | Bundle pdf.js | Native `<iframe>`/`<embed>` (CSP is null, webview renders PDF) |
| Video/audio player | Custom controls | Native `<video controls>` / `<audio controls>` |
| MIME/type detection | New detection lib | Extend existing `mimeType.startsWith` + filename-ext fallback |

## Common Pitfalls / Gotchas

1. **Whole-file-into-memory:** the blob pattern loads the entire attachment into RAM. Add a
   **size guard** before previewing large files (e.g. text/code > ~1–2 MB → truncate with a
   "showing first N KB — download for full" notice; video/pdf > ~25–50 MB → skip preview, show
   download). Use `attachment.size` (add to interface). `[VERIFIED: pattern reasoning]`
2. **Blob URL cleanup:** every new preview branch must `revokeObjectURL` on unmount/change, as
   `AuthImage` already does — a shared hook centralizes this. Leaks otherwise accumulate.
3. **`.mov` codec on Windows WebView2:** macOS WKWebView plays H.264 `.mov`/`.mp4` fine; Windows
   WebView2 (Chromium) may not play ProRes/non-H.264 `.mov`. Provide a graceful "cannot play this
   format — download" fallback on `<video>` `onError`. `[ASSUMED: webview codec behavior]`
4. **PDF in old WKWebView:** modern macOS WKWebView renders PDF via PDFKit in `<iframe>`/`<embed>`;
   historically flaky on very old macOS. Add an `onError`/empty-render fallback to the download
   row. `[ASSUMED]`
5. **Text encoding:** `blob.text()` assumes UTF-8. Non-UTF-8 logs/csv may show mojibake —
   acceptable for a preview; note it.
6. **`.md` rendering:** decisions allow plain text; rendering `.md` through the existing
   `WikiRenderer` is Jira-wiki-oriented and will mis-handle standard Markdown — prefer plain
   `<pre>` for `.md` unless CommonMark rendering via bare `react-markdown` is explicitly wanted.

## Package Legitimacy Audit

Only relevant **if** a highlighter is added (recommended default: none).

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| highlight.js@11.11.1 | npm (exists) | not run | `[ASSUMED]` — verify + slopcheck before install; only if coloring required |
| shiki@4.3.1 | npm (exists) | not run | `[ASSUMED]` — heavier alternative, not recommended |
| react-syntax-highlighter@16.1.1 | npm (exists) | not run | `[ASSUMED]` — heaviest, not recommended |

MVP path adds **zero** packages.

## Files The Plan Will Touch

- `src/routes/dashboard/AuthImage.tsx` — extract `useAuthBlob` hook (new file, e.g.
  `src/routes/dashboard/issue-detail/useAuthBlob.ts`), refactor to consume it.
- `src/routes/dashboard/issue-detail/AttachmentLightbox.tsx` → generalize into
  `AttachmentPreviewModal.tsx` (type-switching body).
- `src/routes/dashboard/issue-detail/AttachmentsSection.tsx` — route non-image rows into modal;
  keep unsupported-type fallback.
- `src/routes/dashboard/issue-detail/AttachmentFileRow.tsx` — make row clickable / add preview
  affordance for previewable types.
- New helper: `resolvePreviewKind(attachment)` (type + filename-ext detection).
- `src/services/jira/types.ts` — add `size?: number` to `JiraAttachment` if used for guards.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|-------|---------------|
| A1 | Jira sends generic mimeType for code/.md/.csv, needing ext fallback | Detection misses types; low risk (ext fallback covers it) |
| A2 | Native `<iframe>`/`<embed>` renders PDF in WKWebView/WebView2 | PDF preview blank; mitigated by download fallback |
| A3 | `.mov`/codec support varies by webview | Some videos won't play; mitigated by onError fallback |
| A4 | highlight.js/shiki/rsh versions (npm-confirmed, training-sourced) | Wrong version pinned; verify before install |

## Sources

- **Primary (HIGH):** Codebase — `AuthImage.tsx`, `AttachmentsSection.tsx`,
  `AttachmentLightbox.tsx`, `AttachmentFileRow.tsx`, `AttachmentThumbnail.tsx`,
  `services/jira/types.ts`, `services/jira/attachments.ts`, `src-tauri/tauri.conf.json`,
  `src-tauri/src/lib.rs`, `package.json`, `node_modules` scan.
- **Secondary (MEDIUM):** npm registry (highlighter versions exist). Webview PDF/codec behavior
  from training knowledge — flagged ASSUMED.
