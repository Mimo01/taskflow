# Quick Task 261119-m2i: Fix Jira editor code block styles and add syntax highlighting - Context

**Gathered:** 2026-11-19
**Status:** Ready for planning

<domain>
## Task Boundary

User request: "In the jira editor we can enter code block. It has broken styles and the text is hard to read. I want you to fix it up. Next, I want to add syntax highlighting for the supported languages."

1. Fix the broken / low-contrast styling of code blocks in the TipTap wiki editor
   (`taskflow/src/components/wiki-editor/nodeviews/CodeBlockView.tsx`).
2. Add syntax highlighting for the languages in `CODE_LANGUAGES`
   (`taskflow/src/components/wiki-editor/languages.ts`).

</domain>

<decisions>
## Implementation Decisions

### Scope
- Apply fixed styles AND syntax highlighting in BOTH the TipTap editor and the read-only
  `WikiRenderer` (`taskflow/src/routes/dashboard/WikiRenderer.tsx`) — a block must look the same
  while editing and after saving.

### Theme
- Follow the app theme: light code surface with GitHub-light-style token colours in light mode,
  dark surface with GitHub-dark-style token colours in dark mode, on the app's muted surface tokens.
- Must not be hijacked by the global `highlight.js/styles/github-dark.css` import in
  `AttachmentPreviewModal.tsx` (global stylesheet, loaded once the modal module loads) — scope token
  colours so the wiki blocks stay theme-correct regardless.

### No language / noformat
- `{code}` with no language and `{noformat}` render as plain monospace — no highlighting, no auto-detect.
- Unknown/unsupported language value → plain (no auto-detect).

### Claude's Discretion
- Highlight mechanism (e.g. lowlight + ProseMirror decorations / `@tiptap/extension-code-block-lowlight`
  vs custom plugin) — must not change the document model / wiki emit round-trip (open/close attrs,
  language spellings) and must not break existing CodeBlockView features (language SearchableSelect,
  noformat label).
- Mapping Jira language names to highlight.js grammars (e.g. vb → vbnet, html → xml, sass → scss,
  delphi, coldfusion, actionscript, applescript, erlang, perl, scala). Languages without an hljs grammar
  fall back to plain.
- Bundle size: register only needed hljs languages (core import), consistent with `highlightCode.ts`.

</decisions>

<specifics>
## Specific Ideas

- Suspected root cause of unreadable text: the editor content carries Tailwind Typography `prose`
  classes (`PROSE` in `wiki-editor/extensions.ts`); prose's `pre` rules set light text for a dark
  background while CodeBlockView's `<pre>` is `bg-transparent` over `bg-muted/40` → light-on-light.
  Verify in the rendered DOM before fixing (memory: inspect DOM before CSS).
- highlight.js ^11.11.1 is already a dependency.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
