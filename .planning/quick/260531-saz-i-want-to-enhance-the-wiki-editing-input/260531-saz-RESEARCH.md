# Quick Task 260531-saz: WYSIWYG Wiki Editor — Research

**Researched:** 2026-05-31
**Domain:** Rich-text editing (TipTap/ProseMirror) ⇄ Jira wiki markup round-trip
**Confidence:** HIGH (stack/versions verified on npm; round-trip strategy MEDIUM — bespoke serializer, no off-the-shelf solution exists)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **WYSIWYG via TipTap/ProseMirror** with a **Source toggle** to view/edit raw Jira wiki markup. (Do NOT relitigate — the rich-editor choice is final.)
- Editor converts **⇄ Jira wiki markup** at load and save. Jira wiki markup is the canonical save format (what the Jira API stores).
- **Round-trip fidelity is the #1 constraint.** Markup the WYSIWYG can't model must NOT be silently dropped — preserve via passthrough nodes and/or keep raw mode authoritative.
- **Style coverage (all):** bold, italic, strikethrough, inline code, h1–h6, links; bullet/numbered lists, task lists, blockquotes, fenced code blocks w/ language, horizontal rules; `{panel}`/`{info}`/`{warning}`/`{note}` callouts, `{color}` text; tables, `@user` mentions (preserve `[~accountId]`/`[~username]`), image/attachment embeds.
- **Rollout:** issue Description + ALL comment editors (DescriptionEditor, CommentComposer, InlineComment, CommentCard edit mode). Extract a single reusable `<WikiEditor>` and replace the duplicated textarea editors — do not enhance each separately.
- Keep the existing `rehype-sanitize` allowlist / XSS protections from WikiRenderer.
- OK to add libraries (TipTap, optionally CodeMirror). Reuse the existing jira2md/WikiRenderer pipeline where it helps.

### Claude's Discretion
- Exact extension set within TipTap StarterKit + custom extensions.
- Source view = styled `<textarea>` vs CodeMirror 6.
- Lossless-preservation mechanism: passthrough nodes vs raw-mode authority.
- Whether @mention autocomplete lives inside the shared component or as a composable add-on.

### Deferred / Out of Scope
- Release/milestone descriptions and worklog comments stay plain-text for now (can adopt `<WikiEditor>` later).
</user_constraints>

## Summary

The codebase is a **Tauri desktop app** (no SSR — hydration concerns N/A), **React 19.1**, **Vite 8**, **Vitest 4**, with **React Compiler enabled** (`babel-plugin-react-compiler`). The canonical content format is **Jira Server/DC wiki markup** (`*bold*`, `h1.`, `[~username]`, `{panel}`, `||header||`), already rendered read-only by the sophisticated `WikiRenderer.tsx` pipeline (Jira → `preprocessJiraMarkup` → `jira2md` → markdown → `react-markdown` + GFM/breaks → `rehype-raw` → `rehype-sanitize` → HTML). All four edit surfaces today are a plain `<textarea>` + a 4-button toolbar that literally inserts `*`/`_`/`{code}`/`* ` strings.

**The hard part is the save direction.** `jira2md` is **Jira→markdown only** (and markdown→Jira via `to_jira`, see below). There is no robust HTML→Jira-wiki serializer in the ecosystem. The load direction (Jira → editor) can largely reuse the existing pipeline by producing HTML and feeding it to TipTap. The save direction (editor → Jira wiki) must be **purpose-built** as a ProseMirror-doc walker. Lossless preservation of constructs TipTap can't model is solved by a **`rawJira` passthrough node** (atom node holding verbatim source) plus making the **Source view the escape hatch / source of truth** when in raw mode.

**Primary recommendation:** Add TipTap v3.24.0 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, plus `extension-table`/`-row`/`-cell`/`-header`, `extension-task-list`/`-task-item`, `extension-mention`). Reuse `WikiRenderer`'s `preprocessJiraMarkup` + `jira2md.to_markdown` to load (Jira→HTML→TipTap). Build a bespoke **ProseMirror→Jira-wiki serializer** keyed off node/mark types. Wrap unsupported markup in a custom `rawJira` atom node. Source toggle = CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/lang-markdown`) OR a styled `<textarea>` (textarea is the lower-risk MVP). Build a shared `<WikiEditor>` with a `variant` prop replacing all four surfaces. Round-trip Vitest tests are mandatory.

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|------------|-------------|-----------|
| WYSIWYG editing UI | Browser/Client (React) | Pure client-side editor; Tauri webview, no SSR |
| Jira→editor parse (load) | Client | Reuse `preprocessJiraMarkup` + `jira2md.to_markdown` already client-side |
| Editor→Jira serialize (save) | Client | New ProseMirror doc-walker serializer |
| Mention user lookup | Client → Jira API | Existing `fetchAssignableUsers` / `MentionPopover` data source |
| Persisting comment/description body | Jira API (`postComment`/`updateComment`/issue update) | Unchanged — body string stays Jira wiki markup |
| XSS sanitization | Client | Keep `rehype-sanitize` for rendering; add paste sanitization in TipTap |

## Standard Stack

### Core (verified npm 2026-05-31, all v3.24.0)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tiptap/react` | 3.24.0 | React bindings (`useEditor`, `EditorContent`) | Official TipTap React adapter; peer-deps `react ^19` confirmed [VERIFIED: npm registry] |
| `@tiptap/starter-kit` | 3.24.0 | Bundles document, paragraph, text, bold, italic, strike, code, code-block, heading, blockquote, lists (bullet/ordered/list-item/list-keymap), hard-break, horizontal-rule, **link**, underline, dropcursor, gapcursor | One install covers ~all core text + block styles. v3 StarterKit now **includes Link and Underline** (verified via `npm view @tiptap/starter-kit dependencies`) [VERIFIED: npm registry] |
| `@tiptap/pm` | 3.24.0 | ProseMirror peer bundle (model, state, view, transform) | Required peer of all TipTap pkgs; pin to same version [VERIFIED: npm registry] |

### Supporting (NOT in StarterKit — install separately)
| Library | Version | Purpose |
|---------|---------|---------|
| `@tiptap/extension-table` + `-table-row` + `-table-cell` + `-table-header` | 3.24.0 | Tables (Jira `||h||`/`|c|`) [VERIFIED: npm registry] |
| `@tiptap/extension-task-list` + `-task-item` | 3.24.0 | Checklists / task lists (Jira has no native checklist syntax — see pitfall) [VERIFIED: npm registry] |
| `@tiptap/extension-mention` (+ `@tiptap/suggestion`, transitive) | 3.24.0 | `@user` mentions → `[~username]` / `[~accountId:XXX]` [VERIFIED: npm registry] |

**Custom (build in-repo, no package):**
- `RawJiraNode` — atom passthrough node for unsupported markup (`{color}`, panels-as-nodes, any unknown macro).
- `JiraColorMark` / `JiraPanelNode` — custom mark/node if modeling color/panels in WYSIWYG rather than passthrough (discretion; passthrough is safer for v1).
- `jiraWikiSerializer.ts` — the ProseMirror→Jira-wiki doc walker.

### Source-view option (Claude's discretion)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| styled `<textarea>` (MVP, zero deps) | `@uiw/react-codemirror` 4.25.10 + `codemirror` 6.0.2 + `@codemirror/lang-markdown` 6.5.0 | CodeMirror gives syntax highlighting but adds ~150–200KB and there is no Jira-wiki CM language mode (markdown mode is an approximation). **Recommendation: ship `<textarea>` first**; CodeMirror is a later polish. [VERIFIED: npm registry] |

**Installation:**
```bash
npm install @tiptap/react@3.24.0 @tiptap/starter-kit@3.24.0 @tiptap/pm@3.24.0 \
  @tiptap/extension-table@3.24.0 @tiptap/extension-table-row@3.24.0 \
  @tiptap/extension-table-cell@3.24.0 @tiptap/extension-table-header@3.24.0 \
  @tiptap/extension-task-list@3.24.0 @tiptap/extension-task-item@3.24.0 \
  @tiptap/extension-mention@3.24.0
```
**Bundle-size impact:** TipTap core + StarterKit + the above extensions ≈ **120–180 KB min+gz** added to the chunk that imports `<WikiEditor>`. ProseMirror is the bulk. Mitigate by ensuring `<WikiEditor>` is in a route-split chunk (it already lives under `routes/dashboard`, which Vite code-splits). React Compiler is compatible — TipTap is plain hooks.

## Package Legitimacy Audit

> slopcheck was **unavailable** at research time (no pip/slopcheck on host). Per protocol, packages are marked `[ASSUMED]` and the planner should gate the install behind a `checkpoint:human-verify` task. Mitigating evidence: all `@tiptap/*` packages are published under the official `@tiptap` npm org by the TipTap/ueberdosis team, all resolve to the same coordinated `3.24.0` release, and peer-deps cross-reference each other — strong authenticity signals.

| Package | Registry | Version | Source Repo | slopcheck | Disposition |
|---------|----------|---------|-------------|-----------|-------------|
| `@tiptap/react` | npm | 3.24.0 | github.com/ueberdosis/tiptap | unavailable | Approved ([ASSUMED] — verify) |
| `@tiptap/starter-kit` | npm | 3.24.0 | ueberdosis/tiptap | unavailable | Approved ([ASSUMED]) |
| `@tiptap/pm` | npm | 3.24.0 | ueberdosis/tiptap | unavailable | Approved ([ASSUMED]) |
| `@tiptap/extension-table` (+row/cell/header) | npm | 3.24.0 | ueberdosis/tiptap | unavailable | Approved ([ASSUMED]) |
| `@tiptap/extension-task-list` (+task-item) | npm | 3.24.0 | ueberdosis/tiptap | unavailable | Approved ([ASSUMED]) |
| `@tiptap/extension-mention` | npm | 3.24.0 | ueberdosis/tiptap | unavailable | Approved ([ASSUMED]) |

**Removed (SLOP):** none. **Flagged (SUS):** none (slopcheck unavailable; verify install before merge).

## Architecture Patterns

### Data Flow

```
LOAD (Jira → WYSIWYG):
  jiraWikiText
    → preprocessJiraMarkup()  [REUSE WikiRenderer; handles emoticons, mentions, panels, color, tables, hardbreaks]
    → jira2md.to_markdown()   [REUSE]
    → micromark/marked → HTML  (or feed markdown to a markdown TipTap input rule)
    → generateJSON(html, extensions)  [@tiptap/html or editor.commands.setContent]
    → ProseMirror doc           ← custom nodes parse <mention>, <span data-color>, <div data-callout>, <rawjira>

EDIT (WYSIWYG)  ⇄  Source toggle (raw Jira textarea/CodeMirror)
    on toggle→Source: serialize current doc → Jira wiki
    on toggle→WYSIWYG: re-run LOAD on the raw text

SAVE (WYSIWYG → Jira):
  ProseMirror doc
    → jiraWikiSerializer (custom doc walker)  → Jira wiki markup string
    → onChange(value)  → existing postComment / updateComment / issue update (UNCHANGED)
```

### Recommended structure
```
src/components/wiki-editor/
├── WikiEditor.tsx              # shared component (the public API)
├── extensions/
│   ├── RawJiraNode.ts          # atom passthrough for unsupported markup
│   ├── JiraColorMark.ts        # optional: {color} as a mark
│   ├── JiraPanelNode.ts        # optional: panels as nodes (else passthrough)
│   └── mentionConfig.ts        # extension-mention + suggestion wired to fetchAssignableUsers
├── serialize/
│   ├── jiraWikiSerializer.ts   # ProseMirror doc → Jira wiki markup
│   └── jiraWikiSerializer.test.ts
├── load/
│   └── jiraToTiptap.ts         # reuse preprocessJiraMarkup + jira2md → HTML/JSON
└── SourceView.tsx              # textarea (MVP) or CodeMirror
```

### Pattern: reuse the existing load pipeline
`preprocessJiraMarkup` already emits HTML-ish output (`<mention data-id>`, `<div data-callout>`, `<span data-color>`, `<img>`, `<br/>`) that TipTap can parse if you register matching `parseHTML` rules on custom nodes/marks. **Do not rewrite Jira→HTML.** Refactor `WikiRenderer` to export the pipeline up to the HTML/markdown string so `<WikiEditor>` can share it (avoids two divergent parsers — this is the same lesson as the `jira.ts` dual-file gotcha in MEMORY).

### Anti-patterns to avoid
- **Two parsers.** Don't write a second Jira→HTML path; reuse `preprocessJiraMarkup`.
- **Lossy save.** Don't `JSON.stringify`/round-trip through markdown for save — markdown can't express `{panel:title=}`, `{color}`, Jira tables, `[~accountId]`. Walk the PM doc directly.
- **Clobbering raw on no-op.** If the user opens the editor and saves without meaningful edits, naive serialize can normalize whitespace/syntax. See Source-toggle pitfall.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Jira→markdown | custom parser | existing `jira2md.to_markdown` + `preprocessJiraMarkup` | Years of edge-case fixes already in WikiRenderer (tables, emoticons, hardbreaks) |
| Rich editing model | contenteditable from scratch | TipTap/ProseMirror | Locked decision; selection/undo/IME handled |
| @mention dropdown UX | new popover | `@tiptap/extension-mention` + reuse `fetchAssignableUsers` data | Suggestion plugin handles positioning/keyboard |
| HTML serialization | manual DOM walk | `@tiptap/html` `generateHTML`/`generateJSON` for the load path | Maps PM schema ⇄ HTML correctly |
| **markdown→Jira** | — | **jira2md `to_jira()` exists** but is markdown-only and lossy for panels/color/mentions | Use ONLY as a fallback for plain content; primary save is the bespoke PM serializer |

**Key insight:** The editor→Jira serializer is the one thing that genuinely must be built — nothing in the ecosystem maps a ProseMirror doc to Jira wiki markup with panel/color/mention/table fidelity.

## Round-Trip Mapping (editor → Jira wiki) — the heart of the task

Map each PM node/mark to Jira syntax in `jiraWikiSerializer.ts`:

| PM node/mark | Jira wiki output |
|---|---|
| bold mark | `*text*` |
| italic mark | `_text_` |
| strike mark | `-text-` |
| code mark (inline) | `{{text}}` |
| heading level N | `hN. text` |
| paragraph | text + blank line |
| hardBreak | `\\` |
| bulletList / listItem | `* item` (nest: `** `) |
| orderedList | `# item` (nest: `## `) |
| taskList / taskItem | Jira has no checklist syntax → render `(/) ` / `(x) ` prefix OR wrap in `rawJira` (decision: emoticon-prefix is the lossless-ish convention; document it) |
| blockquote | `bq. line` (single) or `{quote}…{quote}` (multi-line) |
| codeBlock (lang) | `{code:lang}\n…\n{code}` |
| horizontalRule | `----` |
| link mark | `[text|url]` (or `[url]` if text==url) |
| table | `||h1||h2||`\n`|c1|c2|` |
| mention node | `[~accountId:XXX]` if id looks like an accountId, else `[~username]` |
| image | `!filename.png!` (resolve back from attachment URL→filename) |
| `{color}` | `{color:#hex}text{color}` — model as `JiraColorMark` or passthrough |
| `{panel/info/warning/note}` | `{panel:title=…}…{panel}` etc. — model as node or passthrough |
| **RawJiraNode** | emit `node.attrs.raw` **verbatim** |

### Lossless preservation strategy (recommended)
1. **`RawJiraNode`** — a ProseMirror **atom** node (`atom: true, group: 'block'`/`inline`) storing the original Jira source string in `attrs.raw`. During LOAD, any macro `preprocessJiraMarkup` can't faithfully model (or that the serializer can't round-trip) is captured into a `rawJira` node and rendered read-only in the WYSIWYG (e.g. a chip "raw Jira macro — edit in Source"). On SAVE it emits `attrs.raw` unchanged. This is the standard ProseMirror passthrough pattern.
2. **Source view as authority** — the Source toggle holds the canonical raw string. The safest v1: **when the user has touched Source, that raw string is what saves** unless they re-enter WYSIWYG and edit. This guarantees zero data loss for anything the WYSIWYG round-trip can't guarantee.
3. **Pragmatic minimum to avoid data loss:** model bold/italic/strike/code/headings/lists/links/tables/mentions/code-blocks/hr/blockquote natively (high-confidence round-trip); route `{color}`, panels, and any unknown macro through either a typed node OR `rawJira`. Other Jira editors (e.g. the Atlassian editor itself) keep an authoritative ADF/source model and treat the WYSIWYG as a view — mirror that by keeping Source authoritative.

## Source Toggle Pattern

- **Single source of truth:** keep `value` (Jira wiki string) in the parent. WYSIWYG mode renders from `value` via LOAD; Source mode edits `value` directly.
- **Toggle WYSIWYG→Source:** run `jiraWikiSerializer(editor.state.doc)` → set as Source text.
- **Toggle Source→WYSIWYG:** run LOAD on the edited Source text → `editor.commands.setContent(json)`.
- **Avoid serialize↔parse drift / clobbering:** track a `dirty` flag. If the WYSIWYG doc was **not edited** since the last LOAD, do NOT re-serialize on toggle — reuse the untouched original `value`. Only serialize when `editor.state.doc` actually changed (compare via a transaction-seen flag, not deep-equality of serialized output). This is the documented fix for "no-op edit rewrites the markup."
- **Recommendation:** Source = styled `<textarea>` with `font-mono` (matches current DescriptionEditor) for MVP. CodeMirror 6 is optional polish; there is no Jira-wiki CM mode, so markdown highlighting would be only approximate.

## @mention Integration

- Use `@tiptap/extension-mention` with the `suggestion` utility. Wire `suggestion.items` to the **existing** `fetchAssignableUsers(jiraBaseUrl, token, projectKey, query)` (same call `MentionPopover` already makes via React Query).
- Render the suggestion popup with a React component reusing the existing avatar/row markup from `MentionPopover.tsx` (`CachedAvatar`, displayName + name). Can keep `MentionPopover` as the render body inside TipTap's `suggestion.render`.
- **Serialization:** the mention node stores `attrs.id`. Current codebase inserts `[~${user.name}]` (the Jira **Server/DC username**, not accountId — confirmed: `JiraAssignableUser.name`). `[~accountId:XXX]` is the Cloud form `preprocessJiraMarkup` also handles. Serializer rule: `id` containing only the account-id shape → `[~accountId:${id}]`; otherwise `[~${id}]`. Store both display name (for the node label) and `id` (for save).
- `useMentionUserMap` + `MENTION_RE = /\[~(?!accountId:)([^\]]+)\]/g` already resolves usernames→display names for rendering — reuse to label mention nodes on LOAD.
- **Discretion call:** wire mention as a composable extension passed into `<WikiEditor>` (so DescriptionEditor, which has no project context today, can opt in). CommentComposer/InlineComment already have `issueKey`→`projectKey`.

## Shared `<WikiEditor>` Component Shape

```ts
interface WikiEditorProps {
  value: string;                 // Jira wiki markup (canonical)
  onChange: (v: string) => void; // emits Jira wiki markup
  variant?: 'description' | 'comment' | 'inline'; // toolbar density + min-height
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;            // description ~120, comment ~80, inline ~64
  mention?: {                    // optional — composable
    projectKey: string;
    jiraBaseUrl: string;
  };
  attachments?: AttachmentMap;   // for !image! resolution on load
  users?: UserMap;               // mention display-name resolution on load
  autoFocus?: boolean;
  onSubmit?: () => void;         // comment/inline: Cmd/Ctrl+Enter to submit
  submitOnEnter?: boolean;       // inline composer convenience
  showSourceToggle?: boolean;    // default true
  id?: string;
}
```

**Per-consumer differences (so the shared API covers all four):**
| Consumer | Differences to absorb |
|----------|----------------------|
| `DescriptionEditor` | `variant='description'`, larger min-height, no submit button (parent modal saves), currently has Edit/Preview tabs → replaced by inline WYSIWYG + Source toggle. No mention today (can add). |
| `CommentComposer` | `variant='comment'`, has `@mention` + a "Comment" send button (keep button in parent, pass `onSubmit`). Currently owns all mention state — moves into editor. |
| `InlineComment` | `variant='inline'`, compact (`rows={3}`), Submit/Cancel buttons in parent, also renders a comment LIST with edit mode. Editor replaces only the composer + edit textareas. |
| `CommentCard` edit mode (in `IssueDetailPage`) | same as inline edit — `variant='comment'`, controlled value, parent Save/Cancel. |

Buttons (Comment/Submit/Save/Cancel) stay in the **parent** — `<WikiEditor>` is a controlled input that emits Jira wiki via `onChange`, exactly replacing the `<Textarea value/onChange>` it supersedes. This is a near drop-in swap at each call site.

## Common Pitfalls

### Pitfall 1: No native Jira checklist syntax
**What goes wrong:** TipTap task list has no 1:1 Jira wiki equivalent. **Avoid:** serialize as `(/) `/`(x) ` emoticon prefixes (which WikiRenderer already maps to ✅/❌) or wrap in `rawJira`. Document the chosen convention; round-trip test it.

### Pitfall 2: No-op edit rewrites markup (drift)
**What goes wrong:** Opening then saving an unchanged field re-serializes and normalizes whitespace/syntax, producing a spurious diff in Jira. **Avoid:** dirty-flag; only serialize when the doc actually changed (Source-toggle section).

### Pitfall 3: Paste sanitization
**What goes wrong:** `rehype-sanitize` protects the *render* path, but TipTap accepts pasted HTML directly into the editor. **Avoid:** rely on TipTap's schema (it only keeps nodes/marks you register — unknown tags/attrs are dropped, so `<script>` can't survive), and keep `WikiRenderer`'s sanitize for any preview. Add `editorProps.transformPastedHTML` if pasting rich external HTML is a concern. The saved output is Jira wiki text, re-rendered through the existing sanitized `WikiRenderer` — XSS surface unchanged.

### Pitfall 4: SSR/hydration — N/A
This is a Tauri webview SPA. No SSR. `useEditor` runs client-side only. (Listed because the section template asks — explicitly not a risk here.)

### Pitfall 5: Controlled-value sync
**What goes wrong:** TipTap is internally uncontrolled; pushing `value` back into `setContent` on every keystroke breaks the cursor. **Avoid:** initialize from `value` once; emit via `onUpdate`→`onChange`; only call `setContent` when `value` changes from *outside* (e.g. external reset) and differs from the serialized doc. Standard TipTap controlled pattern.

### Pitfall 6: React Compiler
The repo runs `babel-plugin-react-compiler`. TipTap uses refs/imperative editor instances — ensure `useEditor` deps are stable. Generally compatible; watch for the compiler memoizing the editor instance incorrectly (use the documented `useEditor` hook, not manual `new Editor()`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16 + jsdom 29 |
| Quick run | `npm test` (`vitest run`) — or scope to file |
| Full suite | `npm test` then `npm run check` (biome + tsc) and `npm run build` |

### Requirement → Test Map (essential)
| Behavior | Test type | Command |
|----------|-----------|---------|
| Jira→editor→Jira **round-trip** for each style (bold/italic/strike/code/headings/lists/tasks/quote/codeblock/hr/links/tables/mentions/panels/color/image) | unit | `vitest run src/components/wiki-editor/serialize/jiraWikiSerializer.test.ts` |
| Unsupported macro preserved verbatim (`rawJira`) | unit | same file |
| Source toggle: no-op edit does NOT change `value` | unit/integration | `vitest run` WikiEditor test |
| Mention serializes to `[~username]` / `[~accountId:XXX]` | unit | serializer test |
| Existing `WikiRenderer.test.tsx` still green (XSS guard T-54-07-01) | unit | unchanged |

### Wave 0 Gaps
- [ ] `src/components/wiki-editor/serialize/jiraWikiSerializer.test.ts` — the round-trip matrix (THE critical test; mirror the fixtures already exercised in WikiRenderer.test.tsx).
- [ ] `src/components/wiki-editor/WikiEditor.test.tsx` — toggle + controlled-value + mention.

## Security Domain

| ASVS | Applies | Control |
|------|---------|---------|
| V5 Input Validation | yes | TipTap schema drops unknown nodes/marks; keep `rehype-sanitize` allowlist for render |
| V6 Cryptography | no | — |

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| XSS via pasted HTML into editor | Tampering/Elevation | TipTap schema whitelist; `transformPastedHTML`; output is Jira-wiki text re-sanitized by WikiRenderer on render |
| Stored XSS in comment/description | Tampering | Unchanged — existing `wikiSanitizeSchema` strips `<script>`/`on*`/`<iframe>` at render |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All `@tiptap/*` are authentic (slopcheck unavailable) | Pkg Audit | Low — official org, coordinated versions; verify at install |
| A2 | `jira2md.to_jira()` exists for the fallback path | Don't Hand-Roll | Low — even if absent, primary serializer is bespoke and doesn't depend on it |
| A3 | TipTap StarterKit v3 includes Link + Underline | Stack | Verified via npm deps list; low risk |
| A4 | Task-list serialization convention (`(/)`/`(x)` emoticon) is acceptable to user | Pitfall 1 | Medium — confirm UX expectation; otherwise use rawJira |
| A5 | Mentions use `[~username]` (Server/DC `name`) as primary form | Mention | Low — confirmed in CommentComposer + types; Cloud `[~accountId:]` also handled |

## Open Questions (RESOLVED)

1. **Task-list round-trip convention** — `(/)`/`(x)` emoticon prefix vs `rawJira` passthrough? Recommend emoticon prefix (already rendered by WikiRenderer) but confirm.
   - RESOLVED (D-OQ1, PLAN): emoticon-prefix `(/) `/`(x) ` convention, round-trip asserted in the serializer test matrix.
2. **Panels/color in WYSIWYG vs passthrough** — model as editable nodes (nicer UX) or `rawJira` chips (safer, lossless)? Recommend passthrough for v1, editable later.
   - RESOLVED (D-OQ2, PLAN): `{color}` as editable `JiraColorMark`, `{panel}/{info}/{warning}/{note}` as editable-body `JiraCalloutNode`; anything not faithfully reproducible falls through to `RawJiraNode` passthrough.
3. **Should DescriptionEditor keep a Preview tab** or rely solely on WYSIWYG + Source? Recommend WYSIWYG-is-the-preview, drop the tab.
   - RESOLVED (D-OQ3, PLAN): drop the Edit/Preview tabs — the WYSIWYG view is the preview, Source toggle covers raw editing.

## Environment Availability
| Dependency | Available | Notes |
|------------|-----------|-------|
| npm / Vite 8 / Vitest 4 | ✓ | confirmed in package.json |
| TipTap v3.24.0 on npm | ✓ | verified `npm view` |
| slopcheck | ✗ | unavailable — packages marked [ASSUMED], gate install with human-verify |

## Sources
### Primary (HIGH)
- `npm view @tiptap/*` (versions, peer-deps, StarterKit dependency list) — 2026-05-31
- Codebase: `WikiRenderer.tsx`, `CommentComposer.tsx`, `DescriptionEditor.tsx`, `InlineComment.tsx`, `MentionPopover.tsx`, `useMentionUserMap.ts`, `jira/types.ts`, `package.json`
### Secondary (MEDIUM)
- ProseMirror passthrough/atom-node pattern; TipTap controlled-value pattern (training knowledge — verify against current TipTap v3 docs during planning)

## Metadata
**Confidence breakdown:**
- Standard stack / versions: HIGH (npm-verified)
- Load path (Jira→editor): HIGH (reuses proven pipeline)
- Save path (editor→Jira serializer): MEDIUM (bespoke, no ecosystem solution — round-trip tests de-risk)
- Lossless preservation: MEDIUM (passthrough node + Source-authority is sound but needs the convention decisions in Open Questions)
**Research date:** 2026-05-31
**Valid until:** ~2026-06-30 (TipTap v3 is stable; re-check minor version at install)
