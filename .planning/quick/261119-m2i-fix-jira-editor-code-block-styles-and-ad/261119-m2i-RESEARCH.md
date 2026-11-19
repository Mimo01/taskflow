# Quick Task 261119-m2i: Code block styles + syntax highlighting - Research

**Researched:** 2026-11-19
**Domain:** TipTap/ProseMirror decorations, rehype pipeline, highlight.js/lowlight, Tailwind Typography and cascade layers
**Confidence:** HIGH (I read every claim in the source code or the installed packages. The rendered DOM still needs checking at execution time.)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Apply fixed styles AND syntax highlighting in BOTH the TipTap editor and the read-only
  `WikiRenderer` (`taskflow/src/routes/dashboard/WikiRenderer.tsx`) — a block must look the same
  while editing and after saving.
- Follow the app theme: light code surface with GitHub-light-style token colours in light mode,
  dark surface with GitHub-dark-style token colours in dark mode, on the app's muted surface tokens.
- Must not be hijacked by the global `highlight.js/styles/github-dark.css` import in
  `AttachmentPreviewModal.tsx` (global stylesheet, loaded once the modal module loads) — scope token
  colours so the wiki blocks stay theme-correct regardless.
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

### Deferred Ideas (OUT OF SCOPE)
None listed.
</user_constraints>

## Summary

**Root cause (confirmed in the CSS source, still to be checked in the DOM).** The editor content carries `prose prose-sm dark:prose-invert` from `WIKI_PROSE_CLASSES`. Typography sets `pre` to `color: var(--tw-prose-pre-code)` (gray-200) and `background: var(--tw-prose-pre-bg)` (gray-800) [VERIFIED: node_modules/@tailwindcss/typography/src/styles.js:1115-1116]. `CodeBlockView`'s `<pre>` overrides only the background (`bg-transparent`) and sits on `bg-muted/40`. The result in light mode is gray-200 text on a near-white surface, which is unreadable. `WikiRenderer` has no `pre`/`code` component override, so saved code blocks get the stock prose dark slab (gray-800 even in light mode). That is readable, but it does not match the editor or the theme decision.

**Global hljs CSS.** `AttachmentPreviewModal.tsx` is imported statically by `AttachmentsSection.tsx`, so `github-dark.css` is effectively always loaded on issue detail. It sets `.hljs { color:#c9d1d9; background:#0d1117 }` and `pre code.hljs { padding:1em }`, plus unscoped `.hljs-*` token colours. Some of those selectors have up to (0,3,0) specificity, e.g. `.hljs-title.class_.inherited__`. The stylesheet is **unlayered**, so it beats anything inside Tailwind's `@layer`s whatever the specificity.

**Primary recommendation:**
- Add `lowlight@3.3.0` as the only new dependency.
- Build one shared, TipTap-free module, `src/lib/wiki/highlight.ts`. It holds the language map, the lowlight instance with only the needed grammars, and a post-sanitize rehype plugin.
- Add a small custom ProseMirror decoration plugin in the editor (about 50 lines). Do NOT use `@tiptap/extension-code-block-lowlight`: it auto-detects.
- Style blocks with a `not-prose` frame and unlayered `.wiki-code :is(...)` token rules that switch theme through CSS variables under `.dark`.
- Never put the `hljs` class on any element.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|---|---|---|---|
| Language map + tokenising | `lib/wiki/highlight.ts` (pure) | — | Shared by editor + renderer; must stay TipTap-free (bundle-guard) |
| Editor highlighting | ProseMirror plugin (`components/wiki-editor/code-highlight.ts`) | CodeBlockView | Decorations render into NodeViewContent; schema untouched |
| Renderer highlighting | rehype plugin appended AFTER sanitize in WikiRenderer only | — | Keeps core pipeline / equivalence oracle unchanged |
| Surface + token colours | `index.css` (unlayered) + shared class constants in `lib/wiki/prose.ts` | — | Must beat unlayered github-dark.css |

## Standard Stack

| Library | Version | Purpose | Notes |
|---|---|---|---|
| lowlight | 3.3.0 (latest, 2024-12) | hljs → hast token tree | Deps: `highlight.js ~11.11.0` (dedupes with installed 11.11.1), `@types/hast`, `devlop`. `createLowlight()` calls `HighlightJs.newInstance()`, so it gets its **own** hljs instance and does not touch `highlightCode.ts`'s global registry [VERIFIED: lowlight 3.3.0 tarball lib/index.js:37-38]. `highlight()` uses `classPrefix 'hljs-'` and a hast emitter. Nested scopes come out as `['hljs-title','function_']`, which matches github.css compound selectors. |
| highlight.js | 11.11.1 (installed) | grammars only, via `highlight.js/lib/languages/*` | Same module files already used by highlightCode.ts |

**Rejected:** `@tiptap/extension-code-block-lowlight@3.34.0`. Its peer deps fit (`lowlight ^2||^3`, `highlight.js ^11`, `@tiptap/* 3.34.0`), but its `getDecorations` calls `lowlight.highlightAuto(...)` whenever the language is null or unregistered [VERIFIED: package/src/lowlight-plugin.ts]. That breaks the locked "no auto-detect" decision for `{code}`, `{noformat}` and unknown languages. It also decides whether a language is registered by asking the *global* `highlight.js/lib/core` instance. **`rehype-highlight`** is rejected because it adds class `hljs` to `<code>`, and the unlayered github-dark `.hljs` would then paint `#0d1117` in light mode. Its behaviour is also only a few lines to reproduce.

**Install:** `npm install lowlight@^3.3.0` (in `taskflow/taskflow`)

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---|---|---|---|---|---|
| lowlight | npm | ~9 yrs, v3.3.0 2024-12-14 | github.com/wooorm/lowlight | unavailable | [ASSUMED] — well-known (wooorm/unified ecosystem, dependency of rehype-highlight & tiptap); no postinstall script. Planner: human-verify before install |

slopcheck could not be installed. `npm view lowlight scripts.postinstall` returned nothing.

## Language map (CODE_LANGUAGES → hljs grammar)

[VERIFIED: ls node_modules/highlight.js/lib/languages + aliases in xml.js / vbnet.js]

| Wiki value | hljs grammar | Wiki value | hljs grammar |
|---|---|---|---|
| actionscript | actionscript | json | json |
| applescript | applescript | kotlin | kotlin |
| bash | bash | perl | perl |
| c | c | php | php |
| **coldfusion** | **none → plain** | powershell | powershell |
| css | css | python | python |
| delphi | delphi | ruby | ruby |
| diff | diff | **sass** | **scss** (no indented-Sass grammar in hljs; scss is the closest fit) |
| erlang | erlang | scala | scala |
| go | go | sql | sql |
| groovy | groovy | swift | swift |
| **html** | **xml** (`html` is an xml alias) | typescript | typescript |
| java | java | **vb** | **vbnet** (`vb` is a vbnet alias) |
| javascript | javascript | xml | xml |
| yaml | yaml | | |

- Register: 27 grammars, i.e. every value above except coldfusion. `xml` uses `subLanguage` css/javascript for `<style>`/`<script>`, so both must be registered for HTML to highlight fully. Both are in the list. `typescript` does not need `javascript`.
- Use a strict explicit `Record<string, string | null>` keyed by wiki value. Do not fall back to hljs alias resolution, so `{code:js}` and similar values outside the list stay plain, as the decision requires.
- Add a test asserting every `CODE_LANGUAGES` value has a key in the map (`coldfusion: null`). The map must live in `lib/wiki/highlight.ts` and not in `components/wiki-editor/languages.ts`, because bundle-guard forbids eager entries from reaching `components/wiki-editor/*`. The test can import both.
- Unminified size of core plus these grammars is about 368 KB, much less after minification. Many of these grammars are already in the issue-detail graph through highlightCode.ts.

## Architecture Patterns

### Shared module `src/lib/wiki/highlight.ts` (no TipTap imports)
```ts
import { createLowlight } from 'lowlight';
import java from 'highlight.js/lib/languages/java'; // …27 grammars
const lowlight = createLowlight({ actionscript, applescript, bash, c, css, delphi, diff, erlang, go,
  groovy, java, javascript, json, kotlin, perl, php, powershell, python, ruby, scss, scala, sql,
  swift, typescript, vbnet, xml, yaml });

const WIKI_TO_HLJS: Record<string, string | null> = { html: 'xml', sass: 'scss', vb: 'vbnet', coldfusion: null, /* identity for the rest */ };

export function hljsLanguageFor(wiki: string | null | undefined): string | null {
  if (!wiki || !Object.hasOwn(WIKI_TO_HLJS, wiki)) return null;
  return WIKI_TO_HLJS[wiki];
}
/** hast children, or null = render plain. Never auto-detects. */
export function highlightWikiCode(wiki: string | null | undefined, text: string) {
  const lang = hljsLanguageFor(wiki);
  return lang ? lowlight.highlight(lang, text).children : null;
}
/** Post-sanitize rehype plugin: <pre><code class="language-x"> → token spans. */
export function rehypeWikiHighlight() { /* visit element code whose parent is pre; read
  className 'language-*'; text = concat of text children; children = highlightWikiCode(...) ?? unchanged */ }
```

### Editor plugin (custom, about 50 lines)
- Add it as `addProseMirrorPlugins()` inside the existing `CodeBlock.extend({...})` in `buildEditorExtensions`. Plugins are not schema, so schema-parity is unaffected.
- State: `init` and `apply` rebuild a `DecorationSet` when `tr.docChanged`. Otherwise map it.
- For each `codeBlock` node, skip it when `attrs.open === '{noformat}'` or `highlightWikiCode` returns null. Otherwise walk the hast and emit `Decoration.inline(from, to, { class: classes.join(' ') })`, with `from` starting at `pos + 1`. This is the same flatten-walk as tiptap's `parseNodes`.
- Optional cheapness: cache the decoration offsets per block in a `WeakMap<PMNode, …>`. ProseMirror nodes are persistent, so unchanged blocks keep their identity.
- A language change through `setCodeLanguage` uses `setNodeMarkup`, which is a doc change, so blocks are re-highlighted automatically.
- Inline decorations render inside a node view's `contentDOM` (NodeViewContent), so CodeBlockView's SearchableSelect and noformat label stay untouched [ASSUMED: standard ProseMirror behaviour; tiptap's own lowlight demo uses a ReactNodeViewRenderer language select]. Verify with a jsdom test.
- The clipboard and emit paths serialise the schema and never see decorations, so the round-trip cannot be affected.

### Renderer wiring (WikiRenderer.tsx only)
```tsx
rehypePlugins={[...wikiRehypePlugins([rehypeIssueKeys(activeJiraProject)]), rehypeWikiHighlight]}
```
- **Order: AFTER sanitize.** Sanitize already keeps `code.className` matching `/^language-./` (defaultSchema), so the language survives. The new spans contain only text plus `hljs-*` classes. Nothing gets past sanitize, and `wikiSanitizeSchema` stays unchanged.
- Do NOT add the plugin to `wikiRehypePlugins` or `wikiMarkdownToHtml`. They are the equivalence oracle (D-07: presentation plugins excluded) and the corpus/pipeline tests compare their output.
- Language source: `{code:java}` goes through jira2md (`/\{code(:([a-z]+))?…\}/`) to "```java", then remark produces `<pre><code class="language-java">`. `{noformat}` and bare `{code}` produce plain "```", so there is no class and nothing is highlighted.
- Add `pre` and `code` overrides to `markdownComponents` that wrap the block in the shared frame (below). Inline `{{mono}}` `<code>` must keep its current prose styling, so style only the `pre`.

### Styling
- **Frame:** put `not-prose` on the block wrapper: NodeViewWrapper in the editor, a wrapper `div` around `pre` in the renderer. Typography's selectors are all `:not(:where([class~="not-prose"] *))` [VERIFIED: typography src/index.test.js]. This removes the prose `pre` colour and background cleanly instead of fighting them with overrides.
- Export shared constants from `lib/wiki/prose.ts`, e.g. `WIKI_CODE_FRAME` (`not-prose wiki-code my-2 rounded-md border border-border bg-muted/40 overflow-hidden`) and `WIKI_CODE_PRE` (`m-0 overflow-x-auto p-3 font-mono text-xs whitespace-pre text-foreground density-compact:p-2 density-comfortable:p-4`).
- The `density-*:prose-pre:p-*` rules in `WIKI_PROSE_CLASSES` stop applying under `not-prose`, so the density padding moves onto the `pre`.
- **Tokens: unlayered CSS** in `index.css`, outside `@layer base`, using one rule per github group with `:is()`:
  ```css
  .wiki-code { --hl-keyword:#d73a49; --hl-title:#6f42c1; --hl-attr:#005cc5; --hl-string:#032f62; --hl-builtin:#e36209;
    --hl-comment:#6a737d; --hl-name:#22863a; --hl-subst:var(--foreground); --hl-bullet:#735c0f;
    --hl-add-fg:#22863a; --hl-add-bg:#f0fff4; --hl-del-fg:#b31d28; --hl-del-bg:#ffeef0; }
  .dark .wiki-code { --hl-keyword:#ff7b72; --hl-title:#d2a8ff; --hl-attr:#79c0ff; --hl-string:#a5d6ff; /* …github-dark values */ }
  .wiki-code :is(.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,
    .hljs-template-variable,.hljs-type,.hljs-variable.language_) { color: var(--hl-keyword); }
  /* …title, attr, string, built_in, comment, name, subst, section(bold), bullet,
     emphasis(italic, color inherit), strong(bold), addition, deletion */
  ```
  - `:is()` takes its most specific argument, so every rule scores at least (0,4,0) and beats every global github-dark selector, which maxes out at (0,3,0).
  - Being unlayered puts these rules on the same cascade level as github-dark.css, so specificity decides.
  - github.css and github-dark.css have **identical selector lists** [VERIFIED: diff of selectors], so the same groups work for both themes.
  - Dark mode is the `.dark` class on `<html>` (`services/theme.ts:55`; `@variant dark (&:is(.dark *))`).
  - Copy the exact dark hex values from `node_modules/highlight.js/styles/github-dark.css`.
  - Include `.hljs-emphasis`, `.hljs-strong` and `.hljs-subst`: github-dark gives them colour `#c9d1d9`, which would otherwise leak into light mode.

## Don't Hand-Roll
| Problem | Don't build | Use |
|---|---|---|
| Tokenising | regex highlighters / parsing hljs HTML strings | lowlight hast output |
| Removing prose pre styles | stacked `!important` overrides | `not-prose` on the frame |

## Common Pitfalls
1. **`hljs` class on the container.** The unlayered github-dark `.hljs` / `pre code.hljs` gives a `#0d1117` background and 1em padding. Never emit it. lowlight's `.children` never includes it.
2. **Token CSS inside `@layer`.** The unlayered github-dark rules win whatever the specificity. Keep the `.wiki-code` rules at top level.
3. **Auto-detect leak.** The stock tiptap lowlight plugin calls `highlightAuto` on null or unknown languages. Use the custom plugin.
4. **Bundle guard.** `bundle-guard.test.ts` forbids WikiRenderer's static graph from reaching `@tiptap/*`, `prosemirror*` or `lib/wiki/editor/`, and main.tsx's graph from reaching `components/wiki-editor/*` beyond the lazy wrapper and types. Therefore `lib/wiki/highlight.ts` must not import `components/wiki-editor/languages.ts` or anything from TipTap.
5. **Equivalence and corpus tests.** Putting highlighting in the core `wikiRehypePlugins` would add spans to `wikiToHtml` and break `equivalence.test.ts` and `pipeline.test.tsx`. It belongs in WikiRenderer only.
6. **Recompute cost.** Rebuilding every block on every keystroke is fine for wiki sizes. The WeakMap cache is cheap insurance.
7. **Dark contrast.** github-dark colours were tuned for `#0d1117`. On `muted` (`oklch(0.269)`) dark comments `#8b949e` drop to about 4:1. Check with a screenshot (memory: screenshot before restyling, inspect DOM first).
8. **React Compiler.** The lowlight instance is a module-level, immutable-after-init constant, so there is no stale-read risk. Extension lists stay module-scope (EDIT-09).
9. **Scoped edits.** Don't bulk-replace `code` / `language` identifiers (memory).

## Validation Architecture
Framework: vitest 4 + jsdom (`taskflow/taskflow/vitest.config.ts`). Quick: `npx vitest run src/lib/wiki/highlight.test.ts src/components/wiki-editor`.

| Behaviour | Test | File |
|---|---|---|
| Every CODE_LANGUAGES value is mapped (coldfusion→null); vb/html/sass aliasing; `js`/null → null | unit | new `lib/wiki/highlight.test.ts` |
| `highlightWikiCode('java', 'public class X {}')` contains an `hljs-keyword` span; text concat equals input | unit | same |
| Editor: `{code:java}` block has `.hljs-keyword` inside the `code` of CodeBlockView; `{noformat}` and bare `{code}` have no `[class*=hljs-]`; `setCodeLanguage` to null removes the spans | jsdom | `nodeviews/nodeviews.test.tsx` (existing harness) |
| Emit round-trip unchanged | existing | `lib/wiki/editor/roundtrip.test.ts`, `code-block.test.ts`, `schema-parity.test.ts` |
| Renderer: `{code:java}` gives spans; `{noformat}` gives plain; `<script>` in a code body still renders as literal text | jsdom | `routes/dashboard/WikiRenderer.test.tsx` |
| Bundle isolation | existing | `lib/wiki/editor/bundle-guard.test.ts` (add `lib/wiki/highlight.ts` to the guarded entries) |

Visual check (manual): light and dark, editor and renderer, with the issue-detail attachment modal loaded (github-dark.css present).

## Security
- V5 / XSS: highlighting runs after sanitize, and its output contains only text nodes and `span.className` from the fixed `hljs-*` prefix. React escapes the text. Add a regression test with `<script>` inside `{code:html}`.

## Assumptions Log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Inline decorations appear inside a ReactNodeViewRenderer's NodeViewContent | Low. The jsdom test proves it in the first task. |
| A2 | lowlight is legitimate (slopcheck unavailable) | Low. It is a well-known wooorm package. |
| A3 | sass→scss gives acceptable highlighting for indented Sass | Cosmetic only |

## Open Questions
1. Should the renderer show a small language label header to match the editor's header bar? Recommendation: same frame, no header, because the read view needs no select. Confirm at UAT.
2. Should `{code:js}`, `{code:sh}` and other values outside the list stay plain? Strict mapping per decision means yes.

## Environment
lowlight is not installed (`npm install lowlight@^3.3.0`). Everything else is present: highlight.js 11.11.1, @tailwindcss/typography 0.5.19, TipTap 3.34.0.

## Sources
- Installed: `@tailwindcss/typography/src/styles.js`, `highlight.js/styles/github{,-dark}.css`, `highlight.js/lib/languages/*`
- Tarballs: `@tiptap/extension-code-block-lowlight@3.34.0` (src/lowlight-plugin.ts, code-block-lowlight.ts), `lowlight@3.3.0` (lib/index.js)
- Codebase: CodeBlockView.tsx, extensions.ts, schema.ts, panel-commands.ts, pipeline.ts, preprocess.ts:676-720, WikiRenderer.tsx, prose.ts, bundle-guard.test.ts, services/theme.ts, index.css
