# Quick Task 260709-e0f: Add preview on issue detail for more media types (currently only images work): add .txt and other suggested types - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Task Boundary

Extend the issue-detail attachment preview so it supports more media types beyond images. Currently only images render a preview; everything else presumably falls back to a plain link/name. Add support for text files, PDFs, video, audio, and code files, with a sane fallback for anything still unsupported.

</domain>

<decisions>
## Implementation Decisions

### Media types in scope
- Text files: .txt, .md, .log, .csv — render as plain text (or lightly formatted) inline
- PDF documents — render inline (embedded viewer or first-page render)
- Video: .mp4, .webm, .mov — inline HTML5 video player
- Audio: .mp3, .wav — inline HTML5 audio player
- Code files: .json, .js, .ts, .py, etc. — syntax-highlighted text preview

### Claude's Discretion
- **Architecture:** whether preview rendering is a single type-switching component or one component per media type. Match whatever pattern the existing image preview code already follows — don't introduce a second pattern if one already exists.
- **Fallback for unsupported types** (e.g. .zip, .docx): generic file icon + name + download link is the likely right call for consistency, but defer to what's simplest given the current attachment UI.
- Text/code preview size limits (truncate very large files vs render in full) — use judgement based on how attachments are currently loaded (fetched fully vs streamed).
- PDF rendering approach (native `<embed>`/`<iframe>` vs a JS PDF library) — pick based on what's easiest in this Tauri app without adding a heavy new dependency, unless research turns up a clearly better lightweight option.

</decisions>

<specifics>
## Specific Ideas

No specific library or component references given — open to standard approaches for a Tauri + React app.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
