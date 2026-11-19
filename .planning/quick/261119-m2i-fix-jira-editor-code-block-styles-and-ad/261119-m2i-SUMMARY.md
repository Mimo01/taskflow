---
phase: quick-261119-m2i
plan: 01
subsystem: wiki-editor
tags: [wiki, code-block, syntax-highlighting, lowlight, tiptap, theme]
requires: []
provides:
  - lib/wiki/highlight.ts (strict language map, lowlight instance, rehypeWikiHighlight)
  - editor decoration plugin for codeBlock highlighting
  - shared WIKI_CODE_FRAME / WIKI_CODE_PRE and unlayered .wiki-code token CSS
affects: [WikiRenderer, CodeBlockView]
tech-stack:
  added: [lowlight@^3.3.0]
  patterns: [post-sanitize rehype plugin, PM inline decorations, unlayered theme CSS variables]
key-files:
  created:
    - taskflow/src/lib/wiki/highlight.ts
    - taskflow/src/lib/wiki/highlight.test.ts
    - taskflow/src/components/wiki-editor/code-highlight.ts
  modified:
    - taskflow/package.json
    - taskflow/package-lock.json
    - taskflow/src/lib/wiki/prose.ts
    - taskflow/src/index.css
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
    - taskflow/src/lib/wiki/editor/bundle-guard.test.ts
    - taskflow/src/components/wiki-editor/extensions.ts
    - taskflow/src/components/wiki-editor/nodeviews/CodeBlockView.tsx
    - taskflow/src/components/wiki-editor/nodeviews/nodeviews.test.tsx
key-decisions:
  - "lowlight + custom PM plugin instead of tiptap code-block-lowlight (it auto-detects) or rehype-highlight (adds the hljs class)"
  - "Token CSS is unlayered so it competes on specificity with the global unlayered github-dark.css"
  - "Replaced Object.hasOwn with a typeof guard: tsconfig lib lacks es2022 and biome flags hasOwnProperty.call"
requirements-completed: [QUICK-261119-m2i]
duration: ~25min
completed: 2026-11-19
---

# Quick 261119-m2i: Jira editor code block styles and syntax highlighting

Code blocks in the wiki editor and WikiRenderer now share one `not-prose` muted frame with foreground text, and the 27 mapped CODE_LANGUAGES values get GitHub-light/dark token colours via lowlight (editor: ProseMirror decorations; renderer: post-sanitize rehype plugin).

## Commits

- 8356c964: Task 2, shared highlighter, token CSS, WikiRenderer wiring, lowlight install
- 17b8093c: Task 3, editor decoration plugin, CodeBlockView restyle
- Task 1 (lowlight legitimacy) was approved by the user via the orchestrator; no commit.

## Root cause

Tailwind Typography's `pre` rule (gray-200 text) leaked through CodeBlockView's `bg-transparent` pre onto the near-white `bg-muted/40`. Confirmed from the Typography source; fix is `not-prose` on the frame plus explicit `text-foreground`. After the fix the headless render (below) shows dark text on the muted surface in light mode. I did not re-render the pre-fix state, so the "before" is source-confirmed, not screenshot-confirmed.

## Contrast (WCAG, tokens vs resolved muted code surface)

Surface = `bg-muted/40` over background, resolved to greys: dark `#151515`, light `#fbfbfb`.

| Token | Light colour : ratio | Dark colour : ratio |
|---|---|---|
| keyword | #cf222e : 5.18 (GitHub #d73a49 was 4.42, replaced) | #ff7b72 : 7.24 |
| title | #6f42c1 : 6.29 | #d2a8ff : 9.38 |
| attr/number | #005cc5 : 6.08 | #79c0ff : 9.39 |
| string | #032f62 : 12.79 | #a5d6ff : 11.88 |
| built_in | #bc4c00 : 4.86 (#e36209 was 3.37, replaced) | #ffa657 : 9.43 |
| comment | #6a737d : 4.65 | #8b949e : 5.94 (already >= 4.5, no change needed) |
| name/tag | #116329 : 7.14 (#22863a was 4.47, replaced) | #7ee787 : 11.88 |
| bullet | #735c0f : 6.21 | #f2cc60 : 11.81 |
| section | #005cc5 : 6.08 | #58a6ff : 7.23 (#1f6feb was 3.94, replaced) |
| plain foreground | 19.13 | 17.5 |

Diff addition/deletion use GitHub's current light pairs (#116329 on #dafbe1, #82071e on #ffebe9) and the github-dark pairs for dark.

## Visual proof (github-dark.css loaded globally in the page)

- /Users/mimo/Documents/Projects/taskflow/.claude/worktrees/agent-ae146d855791326e0/.planning/quick/261119-m2i-fix-jira-editor-code-block-styles-and-ad/261119-m2i-shot-light.png
- /Users/mimo/Documents/Projects/taskflow/.claude/worktrees/agent-ae146d855791326e0/.planning/quick/261119-m2i-fix-jira-editor-code-block-styles-and-ad/261119-m2i-shot-dark.png

Both inspected: editor (left) and renderer (right) blocks match apart from the editor header; surface is muted (no #0d1117 slab in light mode); light and dark tokens are theme-correct; HTML shows css/js sub-highlighting; diff shows add/remove backgrounds; bare {code}, {noformat} are uncoloured.

## Verification

- vitest `src/components/wiki-editor src/lib/wiki` (82 files, 1130 tests) pass; WikiRenderer tests pass; tsc clean; biome clean on touched files (2 pre-existing warnings elsewhere in wiki-editor, untouched).

## Deviations from Plan

1. [Rule 3 - Blocking] `Object.hasOwn` fails tsc (lib below es2022) and biome rejects `hasOwnProperty.call`. `hljsLanguageFor` uses a `typeof lang === 'string'` guard instead; behaviour identical, `'toString'` resolves to plain (tested).
2. [Rule 1/quality] Light keyword/builtin/name and dark section colours use GitHub's newer shades rather than the exact github.css values, because the originals measured below 4.5:1 (see table). Plan allowed adjusting for contrast.
3. Environment: worktree base was reset to 84e4d392 per the branch check; `npm install` was run in the worktree's taskflow/ (lockfile change is only the lowlight addition).
4. Pre-commit hook reported "no TypeScript changes staged, skipping tsc and tests" in the worktree, so I ran vitest, tsc and biome manually before each commit.

## Observations (out of scope)

- In the renderer preview, a `{noformat}` block placed at the very end of the document shows a trailing "```" after the text. This comes from the existing jira2md/preprocess path (untouched by this task) and likely depends on the missing trailing newline in my preview text. Not investigated further.

## Known Stubs

None.

## Threat Flags

None. T-m2i-01 mitigated: highlight runs post-sanitize, emits text and span.hljs-* only; regression test confirms `<script>` in `{code:html}` stays literal text.

## Self-Check: PASSED

Created files exist; commits 8356c964 and 17b8093c are on the branch.
