# Phase 97: Round-Trip Engine - Research

**Researched:** 2026-11-16
**Domain:** Lossless Jira wiki markup to ProseMirror/TipTap JSON parser and canonical emitter, with raw atoms, a byte-identical no-op save and a runtime fallback ladder
**Confidence:** MEDIUM-HIGH (oracle behaviour and both renderer fixes were verified by running prototypes in this session; the parser grammar itself is design, not yet built)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Renderer fixes (Jira parity)**
- **D-01:** Fix WikiRenderer's mixed-nesting rendering in this phase. Under a bullet, `*#` must become a nested ordered list, and `#*` under a number a nested bullet list, as Jira does. The rich editor and the read-only view then show the same structure. This deliberately changes how existing issues with mixed nesting display (they become correct). Update the expectation of `lists/mixed-nesting.wiki`, and add WikiRenderer tests for the new behaviour.
- **D-02:** Also fix header-less tables. The renderer must no longer show the synthetic empty header row that `injectHeaderlessTableSeparators` injects for GFM. Header-less tables then look like Jira's (body rows only). The doc model carries a "no header row" table attribute, so the emitter never writes an empty `||` row.
- **D-03:** The Phase 96 rule "WikiRenderer.test.tsx passes unmodified" is lifted only for the tests that lock in the two old behaviours. Today the headerless-table tests around L984-L1110 assert the synthetic empty header. Every other existing test must still pass unchanged.

**Spelling preservation**
- **D-04:** An unedited text is returned as the original string (byte-identical, SAFE-03). The parser and emitter must also hold up once a text is edited, because SAFE-F1 is deferred and any edit re-emits the whole text.
- **D-05:** **Every source variant is kept as a node or mark attribute.** Examples: bullet marker `-` vs `*`, `{code:java}` vs `{code:language=java}`, heading spacing such as `h1.text` vs `h1. text`, `*bold*` vs `{*}bold{*}`, blank-line counts between blocks, emoticon tokens, mention form, escapes and `\\` breaks. For nodes it parsed, the emitter reuses the recorded spelling. An edited text should therefore diff in the Changes tab only where the user typed.
- **D-06:** Line endings: on load, detect whether the original mostly uses CRLF or LF. Emit every line of an edited text in that style. A mixed-ending text gets one style after its first edit, which renders the same. A new, empty text uses LF.
- **D-07:** **Trailing whitespace is stripped on edit**, on prose lines only. Inside `{code}` and `{noformat}` bodies trailing whitespace is content, so it is kept. Raw atoms are emitted exactly as written. An unedited text keeps it all, because D-04 returns the original string.
- **D-08:** Nodes the user creates use the forms the app already writes: today's textarea toolbar in `DescriptionEditor.tsx`, and `CommentComposer` for `[~username]`. Examples: `*` bullets, `{code:java}`, `[~username]`. Mentions are always modelled as a username and emitted as `[~username]`, never `[~accountid:...]`, per the 96 probe.

**Modelled vs raw**
- **D-09:** Aim to model all four hard constructs as real nodes in v1: panels inside table cells; lists and panels inside panels, and panels inside list items (`panels/panel-list-items.wiki`); `{color}` across several blocks (a mark per block, with spans that cross blocks merged back on emit using the recorded spelling); image attributes (`!a.png|thumbnail!`, `!a.png|width=300!`): an image atom keeping the filename and its raw parameter string. The cardinal rule still applies to every one of them. A construct counts as modelled only once the corpus proves that `render(emit(parse(x))) == render(x)` for it. Anything flaky is demoted to raw rather than shipped lossy (success criterion 5). Each construct needs placeholder-only fixtures that cover it.
- **D-10:** Raw atoms use the **smallest span**. An unknown macro inside a sentence, such as `{status}`, becomes an inline raw atom, and the paragraph around it stays editable. A multi-line unknown macro becomes a block raw atom. If the structure itself is broken (for example a malformed table), the whole block becomes raw. A raw atom stores its exact source substring and is emitted verbatim. Missing attachments and unknown-user mentions are not raw: they stay as their own atoms and keep the filename or username (96 probe follow-up).
- **D-11:** **Runtime fallback ladder.** When the equivalence check fails for a text, the engine compares it per top-level block. It demotes the blocks that don't match to block raw atoms and checks the whole text again. Only if that still fails does it report failure, and Phase 98 then opens the text in source mode (SAFE-05). The engine API returns a result that tells Phase 98 which case it got: rich, rich with demoted blocks, or failed.

### Claude's Discretion
- **Doc model and dependencies** (the user said "you decide"). The default is that the parser outputs TipTap/ProseMirror JSON. Phase 97 then adds `@tiptap/core` and `@tiptap/pm`, plus starter-kit/table only if the schema needs them, all at the spike's pinned `^3.34.0`. It defines the node and mark schema with no node views and no UI, and the tests validate every parsed doc against that real schema (`nodeFromJSON(...).check()`). Phase 98 then needs no mapping layer. Research may overturn this if a schema-free AST is clearly safer, but it must say why.
- **Module placement** (the user said "you decide"). The constraint: ProseMirror and TipTap must never land in the main bundle. WikiRenderer imports the `lib/wiki` barrel eagerly. So the parser, emitter and schema go in a separate module, for example `src/lib/wiki/editor/` or `components/wiki-editor/model/`. That module is never re-exported from `src/lib/wiki/index.ts`. Add a guard test that WikiRenderer's import graph contains no `@tiptap` or `prosemirror` module.
- **Sequencing** (the user said "you decide"). The suggested order: land the renderer fixes (D-01/D-02) first as their own plan and commit, so the parser builds against an oracle that already matches Jira, with no behaviour change mixed into parser work.
- **Unclosed or mismatched macros** (the user said "you decide"). Examples: `{panel}` with no closing tag, or `{code}` inside `{noformat}`. Research checks what the renderer (and, if cheap, Jira) does. The likely default is a raw atom from the opener to the end of its block or of the text, plus placeholder-only fixtures that lock the behaviour in.
- The table-driven escaping module design, the attribute names, and the exact shape of the engine API, provided it covers parse, emit, the no-op check and the fallback-ladder result.
- Adding normaliser rules to `equivalence.ts`, still under the Phase 96 D-06 rule: one justified rule at a time, each with a fixture.

### Deferred Ideas (OUT OF SCOPE)
- SAFE-F1, per-block source-slice re-emit, stays a future requirement. D-05's attributes get most of the benefit without it.
- Storing real Jira HTML as golden files for lists only: still deferred. D-01 fixes the renderer instead.
- Reviewed todos not folded: `notifications-highlight-you-mention.md`, `priority-stripe-rest-rank.md`, `notifications-status-category-colours.md`, `notifications-due-date-overdue.md` (unrelated).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAFE-03 | Opening text in the editor and saving without edits writes it back byte-identical | Engine `saveWiki` short-circuits to the original string when `doc.eq(loadedDoc)` (see Pattern 4). Independent of transaction tracking. CRLF/trailing-whitespace fixtures exist (`whitespace/*`). |
| SAFE-04 | Unmodelable constructs are shown read-only as rendered blocks and saved verbatim | `rawBlock` / `rawInline` atoms hold the exact source substring; segmenter rules for unknown, unclosed and mismatched macros (Pattern 3, Pitfalls 4-6); D-11 ladder demotes at runtime. |
| SAFE-06 | Emoticons, `[~username]` mentions, escaping, `\\` breaks, CRLF/trailing whitespace keep original spelling | Spelling-as-attributes model (Pattern 2); oracle probe shows the renderer itself mangles `\*` escapes so only spelling preservation keeps them equal (Pitfall 3). |
</phase_requirements>

## Summary

The decisive finding of this research is that **the oracle (`wikiToHtml`) is a pile of regexes that diverges from real Jira in many places** (see "Oracle quirks" below), so "render(emit(parse(x))) == render(x)" is only reliably achievable by a parser that is **lossless by construction**: every source character ends up in a text node, a spelling attribute, or a raw atom, and the emitter replays the recorded spelling. If the parser is lossless, `emit(parse(x)) === x` byte-for-byte for every parsed input (modulo the documented D-06/D-07 normalisations), and equivalence follows automatically, even for constructs where the oracle is wrong (`{info:title=...}`, `{tip}`, lists inside panels, `\*` escapes all render as literal text in the oracle, yet will round-trip, because their spelling is replayed). The corpus harness should therefore assert the stronger spelling-fidelity property (`emit(parse(x)) === x`) in addition to the equivalence property, plus a seeded token-fuzz losslessness test over arbitrary markup soup.

Use the TipTap/ProseMirror JSON default. `getSchema()` from `@tiptap/core` works in plain Node with no DOM, extensions without node views, and `schema.nodeFromJSON(json).check()` validates content expressions, so Phase 97 can ship the real schema. Reuse StarterKit and `@tiptap/extension-table` nodes via `.extend({ addAttributes })` rather than writing a parallel schema; Phase 98 then adds node views by extending the same extension objects. A schema-free AST would force Phase 98 to write a mapping layer and gives up `check()` validation for nothing.

Both Jira-parity renderer fixes were prototyped and verified against the real pipeline in this session: D-01 (mixed `*#`/`#*` nesting) is a ~10-line pre-jira2md rewrite of mixed-marker lines into sentinel-protected markdown list prefixes, restored in `wikiToMarkdown`; D-02 (header-less tables) keeps the GFM synthetic header but marks its first cell with `<span data-wiki-headerless>` and a new rehype step (placed right after `rehypeRaw`, before sanitize, so the sanitize schema is untouched) drops that `<thead>`. The prototype keeps all four `injectHeaderlessTableSeparators` unit tests in WikiRenderer.test.tsx passing as written (the marker is cell content, line counts and regexes still match), so D-03's allowance may be needed only for the end-to-end assertions, if at all.

**Primary recommendation:** Land D-01/D-02 first (own plan). Then build `src/lib/wiki/editor/` (schema from real TipTap extensions + a lossless line/inline parser + spelling-replaying emitter + engine API with `doc.eq` no-op and the D-11 ladder), gate "modelled" status with the corpus, and demote to raw anywhere the oracle uses a heuristic (inline single-line tables, mixed `||`/`|` rows, `{code:language=...}`, unclosed macros).

## Architectural Responsibility Map

This is a client-side desktop app (Tauri webview, no server tier for this phase). Tiers here are code layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mixed-list / header-less-table render fixes | Render pipeline (`lib/wiki/preprocess.ts`, `pipeline.ts`) | WikiRenderer consumers (20 files) | The pipeline is the single shared oracle and renderer; fixing it there fixes every surface and the harness at once. |
| Wiki to doc parser, doc to wiki emitter, schema | Pure model module (`lib/wiki/editor/`) | none | Pure functions, no React, lazy-loaded later; keeps ProseMirror out of the main bundle. |
| Equivalence check, fallback ladder | `lib/wiki/equivalence.ts` (existing) driven by engine | Phase 98 UI consumes the result kind | One shared `isEquivalent` for CI and runtime (Phase 96 D-05). |
| No-op / byte-identical save | Engine API (`saveWiki`) | Phase 98 host contract ("keep original string until a user transaction") | Doc equality, not dirty flags, decides. |
| Bundle isolation guard | Test layer (vitest import-graph scan) | `lib/wiki/index.ts` barrel (never re-exports editor) | Guard must fail at CI, not at bundle-analysis time. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tiptap/core` | 3.34.0 (npm, modified 2026-11-13) | `Node.create`/`Mark.create`, `getSchema`, extension API | Locked by Phase 96 spike decision; `getSchema` verified working in plain Node. |
| `@tiptap/pm` | 3.34.0 | Single pinned ProseMirror bundle (`prosemirror-model` 1.25.x etc.) | Avoids duplicate `prosemirror-*` copies; import PM only from here. |
| `@tiptap/starter-kit` | 3.34.0 | paragraph, heading, lists, blockquote, codeBlock, hardBreak, hr, bold/italic/strike/underline/link/code | Provides the schema nodes Phase 98 needs commands for; extend with spelling attrs. |
| `@tiptap/extension-table` | 3.34.0 | `Table`, `TableRow`, `TableCell`, `TableHeader` (all four exported from the one package, verified) | Same. |

Verified in a scratch install (not the repo): `getSchema([StarterKit, Table, TableRow, TableCell, TableHeader])` yields nodes `paragraph, blockquote, bulletList, codeBlock, doc, hardBreak, heading, horizontalRule, listItem, orderedList, text, table, tableRow, tableCell, tableHeader` and marks `link, bold, code, italic, strike, underline`. Content expressions: `table: tableRow+`, `tableCell: block+`, `listItem: paragraph block*`, `bulletList: listItem+`. `[VERIFIED: scratch install + node run, 2026-11-16]`

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | | Sup/sub/cite marks, panel, color, raw atoms, mention, emoticon, image, escape nodes | Write as small custom `Node.create`/`Mark.create` extensions. Do NOT add `@tiptap/extension-subscript/superscript/mention/image`; their schemas can't carry spelling attrs and mention/suggestion UI is Phase 99. |
| `diff` ^9 | existing | Already used by the harness | Failure reports. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TipTap JSON + real schema | Schema-free own AST | Smaller dependency surface in 97, but Phase 98 must write and test a mapping layer, and `check()` validation is lost. Rejected. |
| Custom parser | `jira2md`/`marked`/`generateJSON` path | Lossy, was the cause of the reverted 2026-05-31 build. Rejected (SUMMARY Resolved Tension). |
| Own seeded fuzz generator | `fast-check` | Adds a dependency for ~30 lines of test code. Use a small seeded PRNG in the test. |

**Installation (inner app dir `taskflow/taskflow/`):**
```bash
npm install @tiptap/core@^3.34.0 @tiptap/pm@^3.34.0 @tiptap/starter-kit@^3.34.0 @tiptap/extension-table@^3.34.0
```
`@tiptap/react` is Phase 98's. Install scripts: none (`scripts.postinstall` empty for all four). Add to `dependencies` (they ship in the lazy chunk, not devDependencies).

**Version verification:** `npm view` returned 3.34.0 for all four on 2026-11-16 (created 2020-11 / 2023-02 / 2020-11 / 2021-01; repository `github.com/ueberdosis/tiptap`).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @tiptap/core | npm | ~6 yrs | not queried | github.com/ueberdosis/tiptap | unavailable | Approved by user at Phase 96 Plan 02 gate `[CITED: 96-SPIKE-FINDINGS.md]` |
| @tiptap/pm | npm | ~3.8 yrs | not queried | github.com/ueberdosis/tiptap | unavailable | same |
| @tiptap/starter-kit | npm | ~6 yrs | not queried | github.com/ueberdosis/tiptap | unavailable | same |
| @tiptap/extension-table | npm | ~5.8 yrs | not queried | github.com/ueberdosis/tiptap | unavailable | same |

slopcheck could not be installed (no `pip` in this environment), so per protocol these are not tagged `[VERIFIED]`. Mitigating evidence: the user approved exactly these packages at the Phase 96 gate, all are ueberdosis packages with a shared repository, no install scripts, and registry ages of 3-6 years. The planner should still make the install task a `checkpoint:human-verify` only if the user wants a repeat gate; the existing approval is on record.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged [SUS]:** none (slopcheck not run)

## Architecture Patterns

### System Architecture Diagram

```
                     wiki text (string, maybe CRLF)
                              |
                  [loadWiki(text, maps)]  engine
                              |
        +---------------------+-----------------------+
        |                                             |
  parseWiki(text)                               (oracle, unchanged)
  1. detect eol, normalise \r\n|\r -> \n         wikiToNormalizedHtml
  2. block scan (line oriented, source-driven)          ^
     heading / hr / bq / list run / table run /         |
     {code}{noformat} / {quote} / panel family /        |
     {color} block / unknown macro (segmenter) /        |
     paragraph  -> each block records gap+spelling      |
  3. inline tokenizer per text span                     |
     escape, \\ break, emoticon, mention, attachment,   |
     image, link, marks, {{mono}}, unknown {macro}      |
  4. anything not provable -> rawBlock/rawInline        |
        |   (exact source substring)                    |
        v                                               |
   PM JSON doc  --check()--> wikiSchema                 |
        |                                               |
   emitWiki(doc) = replay spellings, then \n -> eol     |
        |                                               |
        +------ isEquivalent(text, emitted) ------------+
                     |            |
                 equal          not equal
                  |               |
        also idempotent?     per-block compare (slices from parse)
                  |               |  demote mismatching blocks -> rawBlock
            kind:'rich'           |  re-check whole text
                                  +--> equal: kind:'rich-demoted'
                                  +--> still not: kind:'failed' (Phase 98: source mode)

   saveWiki(loaded, currentDoc): currentDoc.eq(loaded.doc) ? loaded.original : emitWiki(currentDoc)
```

### Recommended Project Structure
```
taskflow/src/lib/wiki/
├── index.ts                  # barrel, MUST NOT re-export ./editor
├── preprocess.ts / pipeline.ts / equivalence.ts   # existing; D-01/D-02 edits here
└── editor/                   # never imported by WikiRenderer's graph
    ├── schema.ts             # wikiExtensions (module-scope const), wikiSchema = getSchema(...)
    ├── parse/                # blocks.ts, inline.ts, macros.ts (segmenter), tables.ts, lists.ts
    ├── emit.ts               # doc -> wiki, replays spelling, final eol pass
    ├── escape.ts             # table-driven escaping (context x char)
    ├── engine.ts             # loadWiki / saveWiki / ladder / result types
    ├── index.ts              # public surface for Phase 98 (parseWiki, emitWiki, loadWiki, saveWiki, wikiSchema)
    └── __tests__ or *.test.ts  # corpus run, fuzz, guard, schema validity
```
Place new fixtures in `lib/wiki/__fixtures__/<group>/` (shared with the existing corpus; `.gitattributes` `-text` already covers it) and add them to `REQUIRED_FIXTURES` in `corpus-coverage.test.ts` (the "exactly 37" assertion must be bumped deliberately).

### Pattern 1: Lossless parse, spelling-replaying emit (the core idea)
**What:** Every node carries the delimiter spelling it was parsed with; the emitter writes `attrs.spelling ?? canonicalForm`. Nodes the user creates have no recorded spelling, so they get the canonical form (D-08). Two kinds of fidelity:
- **Atoms** (emoticon, mention, escape, image, attachment, rawInline, rawBlock, hardBreak): store the exact source token in `attrs.src` (immutable, since atoms are never partially edited).
- **Containers** (heading, list, panel, table, cell, code, marks): store only delimiter spelling (`sep`, `marker`, `open`, `close`, `bodyLead`, `bodyTail`, `gap`, `form`), never the content.
**Whitespace between constructs** lives in attrs using `\n` only; one final pass `out.replace(/\n/g, eol)` applies D-06. Doc attrs: `eol: 'lf'|'crlf'`, `tail` (count of trailing newlines after the last block). Block global attr `gap` (blank lines before the block; the first block's `gap` is the leading blank count; default 1 for user-created blocks). Add `gap` to all block types via a single extension's `addGlobalAttributes`.
**When to use:** always. It is what makes equivalence hold on constructs the oracle renders wrongly.

### Pattern 2: Doc model (recommended names; planner may rename)
| Wiki | Node/mark | Key attrs (spelling) |
|------|-----------|----------------------|
| text block | `paragraph` | `gap` |
| `hN. x` | `heading` | `level`, `sep` (whitespace after the dot, `''` for `h1.Text`) |
| `----` | `horizontalRule` | `src` (dash run length) |
| `* # -` lists | `bulletList` / `orderedList` > `listItem` > `paragraph` + nested lists | `marker` (`*`/`-`/`#`), list item `indent`/`sep` after marker |
| `bq. x` / `{quote}` | `blockquote` | `form: 'bq'|'macro'`, macro `bodyLead/bodyTail` |
| `{code..}` / `{noformat}` | `codeBlock` (content = body text verbatim, trailing whitespace kept) | `open` (full opener incl. params), `close` (`{code}`/`{noformat}`), `bodyLead`, `bodyTail`, `language` derived |
| panel family | `panel` (content `block+`) | `type` (`panel/info/note/warning/tip`), `params` (raw text after `:`), `bodyLead`, `bodyTail` (for inline-in-cell panels both are `''`) |
| table | `table` > `tableRow` > `tableHeader`/`tableCell` > `paragraph`… | table: `headerless: true`; row: `indent`; cell: `padL`, `padR` (spaces inside the pipes) |
| `*b*` `{*}b{*}` etc. | marks `bold/italic/strike/underline` (StarterKit) + custom `sup/sub/cite/mono` | `form` |
| `{color:x}...{color}` | mark `color` | `value`, `open` (exact opener); multi-block: one mark per block + `span` id so emit merges |
| `[label|url]`, `[url]` | `link` mark | `form: 'named'|'bare'` |
| `(/)` etc. | `emoticon` inline atom | `src` (the token) |
| `[~user]`, `[~accountId:x]` | `mention` inline atom | `id`, `src` (emit `src` if present, else `[~id]`; resolves D-05 vs D-08) |
| `\*` etc. | `escape` inline atom | `src` (`\*`), displays the char |
| `\\` or newline in a paragraph | `hardBreak` | `src` (`\\`, ` \\ `, `\n`); new breaks: `\n` in prose, `\\` inside table cells |
| `!file.png|params!`, `!https://..!` | `image` inline atom | `name`, `params` (raw string after `|`), `src` |
| `[^file]`, `[Label|^file]` | `attachment` inline atom | `name`, `label?`, `src` |
| anything else | `rawBlock` / `rawInline` | `raw` (exact substring) |
`{tip}`: model as `panel` type `tip` (Jira supports it; the renderer shows it literal, see Oracle quirks, and equivalence holds through spelling).

### Pattern 3: Source-driven segmenter for macros (unknown, unclosed, mismatched)
Scan block starts for `^\{name(:params)?\}`. Known paired macros: `code`, `noformat`, `quote`, `panel`, `info`, `note`, `warning`, `tip`, `color`. For a known opener find the first matching closer exactly like the oracle's non-greedy regex (same-name bare closer, may cross blank lines). Rules, all verified against the oracle (see probe table):
1. **Unclosed known macro:** raw block from the opener line to the end of its block (next blank line or end of text). The oracle renders these as literal paragraph text, so raw is render-identical.
2. **Mismatched closer** (`{noformat}...{code}`; the oracle's code-extraction regex accepts either closer for either opener and yields garbage): `rawBlock` spanning opener to closer.
3. **Unknown macro with a bare same-name closer later** (`{expand:title=..}...{expand}`): `rawBlock` opener-to-closer.
4. **Unknown macro with no closer** (`{status:...}`, `{toc}`, `{anchor}`): `rawInline` for just the token; the paragraph stays editable (D-10).
5. **Opener grammar gate = what the oracle accepts.** `codeBlock` only when the opener matches jira2md's own grammar `\{code(:([a-z]+))?([:|]?(title|borderStyle|borderColor|borderWidth|bgColor|titleBGColor)=.+?)*\}`. The oracle does NOT convert `{code:language=java}` or `{code:Java}` (renders literal text), so those become `rawBlock` per success criterion 5. Same for `{info:title=..}`/`{warning:title=..}`: see Open Question 2.
6. **Color value gate:** `{color:X}` models only when `X` matches `^(#[0-9a-fA-F]{3,8}|[A-Za-z]+)$`; otherwise `rawInline`/`rawBlock` (CSS-injection defence from the reverted build's review CR-01; the value will reach `style=` in Phase 98).
7. **Heuristic regions in the oracle become raw:** a line matching `splitInlineSingleLineTables`' INLINE_SEP_RE (`tables/single-line-inline.wiki`) becomes a `rawBlock` (its NodeView renders it as a real table through WikiRenderer); a table row that does not close within `mergeOpenTableRows`' 50-line cap; any table with a mixed `||`/`|` row (oracle renders literal `||h1||h2|`); a table cell holding `{code}` (oracle mangles it).

### Pattern 4: Engine API and the no-op contract
```typescript
// editor/engine.ts (sketch; names are discretionary)
export type WikiLoad =
  | { kind: 'rich'; original: string; doc: PMJSON }
  | { kind: 'rich-demoted'; original: string; doc: PMJSON; demoted: number[] } // top-level block indexes
  | { kind: 'failed'; original: string; reason: string };            // Phase 98: source mode (SAFE-05)

export function loadWiki(text: string, maps?: EquivalenceMaps): WikiLoad;
export function saveWiki(loaded: Extract<WikiLoad, {doc: unknown}>, current: PMNode): string {
  return current.eq(schema.nodeFromJSON(loaded.doc)) ? loaded.original : emitWiki(current);
}
```
No-op is decided by structural doc equality (`Node.eq`), never by a dirty flag, so focus, toggles and selection changes cannot rewrite text. `loadWiki` must never throw: wrap parse/emit/`check()` in try/catch and return `failed`.

D-11 ladder: `parseWiki` returns `{ doc, slices }` where `slices[i]` is the exact source substring (gap included) of top-level block `i`; concatenating slices reproduces the input. On whole-text mismatch (or non-idempotent emit), for each block compare `isEquivalent(slice, emitBlock(i))`; replace mismatching blocks by `rawBlock{raw: slice}`; re-check whole text; else `failed`. `isEquivalent` already fails closed on oracle exceptions.

### Pattern 5: Bundle-isolation guard test
A node-environment vitest (`// @vitest-environment node`) that BFS-walks static imports from `src/routes/dashboard/WikiRenderer.tsx` (regex over `from '…'`/`import '…'`; resolve `@/` to `src/`, relative paths, `.ts/.tsx/index.ts`; ignore `import()` dynamic edges and `import type`), and fails if it reaches any file under `src/lib/wiki/editor/` or any bare specifier matching `^(@tiptap/|prosemirror)`. Also assert `src/lib/wiki/index.ts` text does not contain `editor`. Mutation self-test: run the walker over a tiny temp graph containing a tiptap import and assert it reports it (project rule: gates must be shown to bite).

### Pattern 6: D-01 mixed nesting (prototyped, verified)
In `preprocess.ts` add `convertMixedListMarkers(wiki)`, run immediately BEFORE `normalizeTableCellInlineFormatting` (it must run before the `^[ \t]*\d+\.\s+` rule at ~L802, which would rewrite a produced `1.` back to `#`):
```typescript
export function convertMixedListMarkers(wiki: string): string {
  return wiki.replace(/^[ \t]*([*#]{2,})[ \t]+(?=\S)/gm, (m, marks: string) => {
    if (!(marks.includes('*') && marks.includes('#'))) return m;      // pure runs stay on jira2md
    let indent = 0;
    for (let i = 0; i < marks.length - 1; i++) indent += marks[i] === '*' ? 2 : 3; // parent content offset
    return `\x00LI${indent}${marks.at(-1) === '*' ? 'b' : 'o'}\x00`;
  });
}
```
and in `wikiToMarkdown` after the CODEBODY restore: `.replace(/\x00LI(\d+)([bo])\x00/g, (_, n, k) => ' '.repeat(+n) + (k === 'b' ? '* ' : '1. '))`. The sentinel starts the line so no jira2md/ordered/bullet regex can touch it (jira2md's bullet rule would otherwise strip indentation from `   * x`). Verified output: `* a / *# b *x* / *# c / ** d` gives `<ul><li>a<ol><li>b <strong>x</strong></li><li>c</li></ol><ul><li>d</li></ul></li></ul>` and `# n / #* x / ## g` nests the bullet list under `n`. Add `\x00` to the biome-ignore comment pattern already used. `[VERIFIED: prototype run against the real pipeline in a scratch test, since deleted]`

### Pattern 7: D-02 header-less tables (prototyped, verified)
In `injectHeaderlessTableSeparators` make the first synthetic header cell `<span data-wiki-headerless></span>` instead of a blank (the other cells stay `' '`). Add a rehype plugin in `pipeline.ts`, placed in `wikiRehypePlugins` right after `rehypeRaw` and before `...presentation` and sanitize:
```typescript
function rehypeDropHeaderlessThead() {
  return (tree: HastElement) => visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'thead' || index === undefined || !parent) return;
    if (!JSON.stringify(node).includes('dataWikiHeaderless')) return;
    parent.children.splice(index, 1);
    return ['skip', index];
  });
}
```
(Write it with proper hast types; `unist-util-visit` is already imported.) Because it runs before sanitize, `wikiSanitizeSchema` stays unchanged (security boundary). Verified output for `|a|b|\n|c|d|`: `<table><tbody>...</tbody></table>`; header-row tables keep their `<thead>`; named-link cells unaffected. Marker, not "all-empty thead" detection, so a genuine empty `|| ||` header row is preserved. The four `injectHeaderlessTableSeparators` unit tests in WikiRenderer.test.tsx still pass with the marker; only update assertions that expect an empty `<thead>` if any fail. `[VERIFIED: prototype]`

### Anti-Patterns to Avoid
- **Decoding then re-encoding spelling** (escapes to chars, emoticons to Unicode, `{*}` to `*`): this is exactly what corrupted the reverted build.
- **Output-scanning to find raw spans** or parsing via `wikiToHtml` + `generateJSON` (96 spike: loses color, images, panel types, emoticons).
- **Widening `wikiSanitizeSchema`** to make a round trip pass.
- **Module-scope `/g` regex with `.test`/`.exec`** in parser tables: `lastIndex` is hidden mutable state (React Compiler/vitest divergence). Use sticky regexes created per call, `matchAll`, or `replace`.
- **Re-exporting the editor module from `lib/wiki/index.ts`** or importing it from `equivalence.ts`.
- **Inventing task lists** from `(/)`/`(x)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Doc validation | Own tree walker | `schema.nodeFromJSON(json).check()` | Enforces content expressions; works in Node (verified). |
| Doc equality for no-op | JSON.stringify compare / dirty flag | `Node.eq` | Handles attrs and marks structurally. |
| Unified diffs of failures | New diff code | existing `checkCorpus` + `formatCorpusFailures` | Already prints path, hunk and emitted text. |
| Equivalence check | Second comparison | existing `isEquivalent` | Same function for CI and runtime (96 D-05). |
| Table/list/code/marks schema | Parallel hand-written schema | StarterKit + `extension-table` extended with spelling attrs | Phase 98 commands/keymaps come free. |
| Emoticon set | A second token list | Export one `JIRA_EMOTICON_TOKENS` next to `JIRA_EMOTICON_MAP` and test they agree | One source of truth; order matters (`(*r)` before `(*)`, `(flagoff)` before `(flag)`). |
| Attachment markup | New forms | `lib/attachment-markup.ts` (`attachmentRef`) | Hazardous-filename rule already defined. |

**Key insight:** the hard part is not any single construct but the oracle's regex quirks; replaying spelling sidesteps them, while hand-rolling "smarter" canonicalisation reintroduces them.

## Runtime State Inventory

Not applicable (greenfield module plus two renderer fixes; no rename/migration). One adjacent note: the D-01/D-02 renderer fixes change the displayed HTML of existing stored issues that contain mixed nesting or header-less tables. No stored data changes.

## Common Pitfalls

### Pitfall 1: Believing the oracle equals Jira
**What goes wrong:** Parser models a construct "correctly" per Jira, but the oracle renders it literally, so someone "fixes" the parser to match the oracle's garbage.
**Why:** Oracle quirks (table below). **How to avoid:** equivalence compares oracle-to-oracle, so spelling replay passes regardless; never bend the parser toward oracle output, and record oracle divergences as known (Open Question 2).
**Warning signs:** fixture passes only because both sides are equally wrong.

### Pitfall 2: Blank-line and adjacency drift
**What goes wrong:** Emitting `\n\n` between every block changes rendering where the source had `h3. X\nBody` (gap 0) or `* b\ntext2` (oracle treats `text2` as a lazy continuation of the list item).
**How to avoid:** `gap` attr per block (0 allowed), default 1 only for user-created blocks. Fixture `inline/headings-rule.wiki` has all-gap-0 adjacency.

### Pitfall 3: Escapes are broken in the oracle, so edited-text escaping can't be verified by it
**What goes wrong:** `\*star\*` renders as literal `<strong>star</strong>` text and `\[bracket\]` as `<bracket>` in WikiRenderer, while real Jira shows `*star*`. Only `\+`, `\{`, `\}`, `\\` behave. If the emitter escapes a typed `*` as `\*`, Jira is right but WikiRenderer shows garbage.
**How to avoid:** Parsed escapes stay as `escape` atoms replaying `src` (passes). For newly typed text, escape minimally and only where our own tokenizer would otherwise parse markup (verify with the property `parse(emit(textNode)) == textNode` per char per context), never inside code/noformat/mono. Flag the renderer limitation (Open Question 3). Hazards: `Wow!!!` (oracle garbles `!!!`), `C:\\temp` (`\\` is a break).

### Pitfall 4: `{code}`/`{noformat}` body handling
**What goes wrong:** Oracle strips exactly one trailing `\n` and injects a leading `\n`; `{noformat}` renders with a stray trailing ``` (oracle bug); bodies containing `{code}` inside `{noformat}` mispair.
**How to avoid:** `codeBlock` content = body text verbatim; `bodyLead`/`bodyTail` record the separators; the mismatched-closer rule (Pattern 3.2); the code body is NOT inline-parsed (emoticons/escapes/`<`/`&` inside stay verbatim).

### Pitfall 5: Cells are not blocks in the oracle
**What goes wrong:** Lists, `{code}`, newline handling inside cells either flatten (`mergeOpenTableRows` turns `\n` into a space and panels into `<span data-callout>`) or break. A panel in a cell is inline-only (`{info}Check{info}` on one row line).
**How to avoid:** Split cells with the oracle's bracket-aware walk (`[display|url]` is one token; `\|` is an escaped pipe). Cell content: inline paragraph(s) plus `panel` with `bodyLead/bodyTail = ''` for same-line callouts. A multi-line cell (open row) records its newline as a `hardBreak{src:'\n'}`. Anything else in a cell becomes `rawInline`. Header-less + header rows: a row is a header row only if every cell uses `||`.

### Pitfall 6: Two images on one line
Oracle output for `!a.png|thumbnail! !b.png|width=300!` on one line is garbage (`![](a.png! !b.png)`, jira2md's greedy `!(.+)!`). Spelling replay keeps it equal; do not try to model around it. Fixtures put images on separate lines.

### Pitfall 7: React Compiler / module state
Build `wikiExtensions` and `wikiSchema` once at module scope as constants; keep parser tables as frozen arrays; do not read mutable module state or cache across calls. vitest does not run the Compiler, so a stale-closure bug would only show in the app (memory: 3f45fcd2). Keep everything in `editor/` pure.

### Pitfall 8: Per-block ladder compares out of context
A block's render can depend on its neighbours (list continuation, table merge, open panels). Per-block `isEquivalent(slice, emitBlock)` is a heuristic; the whole-text recheck after demotion is the authority. Slices must tile the input exactly (test: `slices.join('') === normalisedInput`).

### Pitfall 9: Lone `\r`, mixed endings, last line
Normalise `\r\n` and lone `\r` to `\n` (as the oracle does), record `eol` by majority (CRLF count > bare LF count), record `tail`. Whitespace-only lines (`   ` in `trailing-whitespace.wiki`) are blank lines for gap purposes; D-07 strips their spaces on edit.

### Pitfall 10: Mixed-nesting jumps
`#*# deep` after `## g` (non-contiguous ancestry) is rendered by the prototype as a sibling in the `g` list; Jira's behaviour here is unproven. Do not put it in a fixture; any list run whose ancestry is non-contiguous becomes `rawBlock`.

## Code Examples

### Schema at module scope (no node views)
```typescript
// Source: @tiptap/core getSchema, verified in Node 26 with @tiptap/core 3.34.0
import { getSchema, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';

const RawBlock = Node.create({
  name: 'rawBlock', group: 'block', atom: true, selectable: true,
  addAttributes() { return { raw: { default: '' }, gap: { default: 1 } }; },
});
export const wikiExtensions = [StarterKit.configure({ /* disable what we replace */ }), Table.extend({
  addAttributes() { return { ...this.parent?.(), headerless: { default: false } }; },
}), TableRow, TableCell, TableHeader, RawBlock /* ... */];
export const wikiSchema = getSchema(wikiExtensions); // module scope: created once
```
Validate every parsed doc in tests: `wikiSchema.nodeFromJSON(doc).check()`.

### Corpus run plus the stronger fidelity assertion
```typescript
// editor/roundtrip.test.ts  (// @vitest-environment node)
const failures = checkCorpus(WIKI_CORPUS, (s) => emitWiki(parseWiki(s).doc), MAPS);
expect(failures, formatCorpusFailures(failures)).toEqual([]);
for (const { path, wiki } of WIKI_CORPUS) {
  const doc = parseWiki(wiki).doc;
  wikiSchema.nodeFromJSON(doc).check();
  const once = emitWiki(doc);
  expect(emitWiki(parseWiki(once).doc)).toBe(once);              // idempotence
  if (!HAS_TRAILING_WS.has(path)) expect(once).toBe(wiki);        // spelling fidelity (D-05/D-06)
  for (const raw of rawAtoms(doc)) expect(wiki.replace(/\r\n?/g, '\n')).toContain(raw); // raw verbatim
  expect(saveWiki(loadWiki(wiki, MAPS), currentDocOf(wiki))).toBe(wiki);                // no-op, SAFE-03
}
```

## Oracle quirks verified this session (probe table)

Run with the real `wikiToHtml`, 2026-11-16 `[VERIFIED: scratch vitest run]`:

| Input | Oracle renders | Implication |
|-------|----------------|-------------|
| `* a / *# b / ** d` | `*# b` literal after `<br>` (the D-01 bug) | Fix per Pattern 6 |
| `\|a\|b\|` rows | `<thead><th></th>…` synthetic header (the D-02 bug) | Fix per Pattern 7 |
| `{tip}…{tip}`, `{info:title=X}`, `{warning:title=X}` | literal paragraph text (only `{panel}`, `{panel:title=}`, bare `{info}/{note}/{warning}` render as panels) | Model as `panel`; equal via spelling (Open Q2) |
| `{panel}` with a list inside | list shown as literal `* Item` lines | equal via spelling |
| `{panel}A{info}B{info}{panel}` | nested divs, works | panel-in-panel modelled |
| unclosed `{panel:title=T}` / `{code}` | literal paragraph, rest of text normal | rawBlock to end of block |
| `{noformat}a {code}b{code} c{noformat}` | broken `<pre>` + stray text | mismatched closers raw |
| `{code:language=java}` / `{code:title=a.java\|borderStyle=solid}` | first literal text; second a plain code block | gate on jira2md grammar |
| `\*star\* \_u\_ \[b\] Wow!!!` | `<strong>`/`<em>`/`<bracket>` as literal text, `!!!` garbled | Pitfall 3 |
| `{color:red}` over several lines/blocks | one `<span>` swallowing `<p>`s (invalid nesting) | multi-block `{color}` is the likeliest D-09 demotion |
| `\|\|h1\|\|h2\|` (mixed row) | literal text | table raw |
| `\|{code}a{code}\|y\|` | mangled | cell raw |
| `h1.Text` | `<h1>` (oracle normalises `h1.` + `\S`) | keep `sep` spelling |
| `- a / - b` | `<ul>` | `-` bullet marker kept as `marker` |
| `a\n\n\n\nb` | two paragraphs | blank-line count is spelling only |
| `{quote}` with a list | blockquote containing `<ul>` | ok |
| `a ---- b` | `<del>--</del>` | `----` hr only when whole line |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `wikiToHtml` + `generateJSON` import path | Source-level parser to PM JSON | Phase 96 spike | no `@tiptap/html`, no second parser |
| Dirty-flag no-op | `doc.eq` against the loaded doc | this phase | immune to focus/toggle writes |
| Synthetic empty `<thead>` for header-less tables | Marker + rehype drop | this phase | renderer matches Jira |

**Deprecated/outdated:** the Phase 96 "WikiRenderer.test.tsx untouched" rule is lifted only for D-03's two behaviours.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jira DC itself treats unclosed macros as literal text (the oracle does; Jira not probed) | Pattern 3 | Low: raw atom renders via the oracle anyway, and bytes are preserved |
| A2 | Jira renders `{info:title=..}`, `{warning:title=..}`, `{tip}` as real panels (known Jira syntax, but the 96 probe only tested `{panel:title}`) | Pattern 2, Open Q2 | Medium: if wrong, modelling them as panels shows a panel in the editor that Jira shows as text; spelling still round-trips |
| A3 | Jira allows `-` as a bullet marker only for flat lists (oracle handles flat `- a`) | Pattern 2 | Low: nested `-` runs demote to raw |
| A4 | Sentinel-prefixed list lines (`\x00LI..\x00`) cannot be reached by any later regex in the pipeline | Pattern 6 | Low: verified on mixed fixtures; fixture additions (list inside `{quote}`, after `{code}`, in table-free prose) should cover it |
| A5 | slopcheck-equivalent legitimacy of the 4 `@tiptap` packages (user-approved in Phase 96; slopcheck unavailable) | Package Legitimacy Audit | Low |
| A6 | New breaks default to `\n` in prose and `\\` in cells | Pattern 2 | Low: D-08 lists no toolbar break; confirm in Phase 98 |

## Open Questions

1. **Multi-block `{color}` (D-09)**
   - Known: the oracle renders it as one invalid `<span>` containing `<p>`s; spelling replay can still round-trip it.
   - Unclear: whether per-block marks plus merge-on-emit is stable under edits (splitting a paragraph inside a span).
   - Recommendation: implement per-block color marks with a shared `span` id; if the fixtures or the fuzz test show any instability, demote cross-block color to `rawBlock` rather than ship lossy. Intra-paragraph color (corpus: `macros/color.wiki`) is modelled for sure.
2. **Oracle renders `{info:title=}`, `{warning:title=}`, `{tip}`, lists-in-panels as literal text**
   - Known: round trip is fine either way. The Phase 98 editor will show real panels while read-only WikiRenderer views show literal text until the renderer learns them.
   - Recommendation: model as panels now (Jira-correct, parity of spelling); raise a follow-up to extend the pipeline in the spirit of D-01/D-02. Not required for this phase; needs a user call if they want it in scope.
3. **Escaping and the renderer's broken `\*`**: accept Jira-correct escaping for newly typed text and document the renderer gap (Pitfall 3), or add a renderer fix. Recommend: accept and track.
4. **List item with a panel or `{code}` after it (`* item\n{panel}…`)**: oracle renders the panel as a sibling of the list. Parse it as sibling blocks (gap 0); the "panels inside list items" part of D-09 therefore means panels adjacent to items, not a nested node, unless a fixture proves otherwise (listItem content `paragraph block*` would permit it).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node / npm | everything | yes | node v26.12.1 | none needed |
| vitest | tests | yes | 4.1.0 (jsdom default) | use `// @vitest-environment node` per file for lib/wiki harness tests |
| npm registry | installing 4 packages | yes | 3.34.0 | none needed |
| slopcheck | legitimacy gate | no (`pip` missing) | none | user-approved record from Phase 96 (see audit) |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 (installed 4.1.0), jsdom default, Testing Library for WikiRenderer tests |
| Config file | `taskflow/vitest.config.ts` (existing, globals on, setup `src/test/setup.ts`) |
| Quick run command | `cd taskflow && npx vitest run src/lib/wiki src/routes/dashboard/WikiRenderer.test.tsx` |
| Full suite command | `cd taskflow && npm run test` (pre-commit runs the full suite, plus tsc and biome; combine RED/GREEN in one commit per TDD task) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAFE-03 | Unedited load/save returns the original byte-for-byte (CRLF, trailing ws, every fixture) | unit | `npx vitest run src/lib/wiki/editor/engine.test.ts` | Wave 0 |
| SAFE-03 | Token-fuzz: `emit(parse(x)) === x` for seeded random markup soup (modulo D-06/D-07) and `parse` never throws | property | `npx vitest run src/lib/wiki/editor/lossless.fuzz.test.ts` | Wave 0 |
| SAFE-04 | Unknown/unclosed/mismatched macros are raw atoms, `raw` is a substring of the source, emitted verbatim | unit | `npx vitest run src/lib/wiki/editor/raw.test.ts` | Wave 0 |
| SAFE-04 | D-11 ladder: forced mismatch demotes block (`rich-demoted`), unfixable gives `failed`; slices tile the input | unit (mutation-style: asserts failure is reported) | `npx vitest run src/lib/wiki/editor/ladder.test.ts` | Wave 0 |
| SAFE-06 | Emoticon tokens, mentions (both forms), escapes, `\\`/newline breaks, CRLF/trailing ws keep spelling | unit | `npx vitest run src/lib/wiki/editor/spelling.test.ts` | Wave 0 |
| Success 1 | Whole corpus: `checkCorpus(WIKI_CORPUS, s => emitWiki(parseWiki(s).doc), MAPS)` is empty, plus idempotence and `check()` | corpus | `npx vitest run src/lib/wiki/editor/roundtrip.test.ts` | Wave 0 |
| D-01 | Mixed `*#`/`#*` renders nested lists; `mixed-nesting.wiki` expectation; pure runs unchanged | unit/render | `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx src/lib/wiki/pipeline.test.tsx` | extend existing |
| D-02 | Header-less table renders `<tbody>` only; genuine `|| ||` header kept; sanitize schema diff is empty | unit/render | same | extend existing |
| Module isolation | WikiRenderer import graph has no `@tiptap`/`prosemirror`/`lib/wiki/editor`; guard bites on a synthetic graph | node unit | `npx vitest run src/lib/wiki/editor/bundle-guard.test.ts` | Wave 0 |
| Edits | Scripted edits (append paragraph, bold a word, edit a table cell) re-emit with untouched blocks byte-identical | unit | `npx vitest run src/lib/wiki/editor/edit.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** quick run command (under ~60 s)
- **Per wave merge:** `npm run test` plus `npx tsc --noEmit` and biome on touched files
- **Phase gate:** full suite green before `/gsd-verify-work`; `git diff` of `WikiRenderer.test.tsx` limited to D-03's two behaviours

### Wave 0 Gaps
- [ ] `src/lib/wiki/editor/*.test.ts` files listed above (none exist)
- [ ] New placeholder-only fixtures (examples): `tables/panel-in-cell-multi.wiki`, `tables/headerless-with-links.wiki`, `panels/panel-in-panel.wiki`, `panels/list-in-panel-nested.wiki`, `lists/mixed-deep.wiki`, `lists/dash-bullets.wiki`, `macros/unclosed-panel.wiki`, `macros/unclosed-code.wiki`, `macros/mismatched-closer.wiki`, `macros/color-multi-block.wiki`, `macros/inline-status.wiki`, `images/params.wiki` (width/thumbnail, separate lines), `whitespace/mixed-eol.wiki`, `whitespace/blank-lines.wiki`, `whitespace/code-trailing-ws.wiki`, `inline/heading-no-space.wiki`, `inline/brace-bold.wiki`, `escapes/regressions.wiki` (`(/)` spelling, flattened-`*#`, lost panel title); each added to `REQUIRED_FIXTURES` (bump the "exactly 37" count deliberately) with host/mention allowlists respected
- [ ] Install the four `@tiptap` packages

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | Total, non-throwing parser (fail to raw/`failed`); color value allowlist regex; schema `check()`; no HTML passthrough in the doc |
| V6 Cryptography | no | n/a |
| V14 Config / dependencies | yes | pinned `^3.34.0`, no install scripts, one publisher |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSS/attr injection via `{color:...}` value reaching `style=` in Phase 98 | Tampering | Allowlist `^(#[0-9a-fA-F]{3,8}|[A-Za-z]+)$` at parse; else raw atom (review CR-01 of the reverted build) |
| XSS through raw atoms | Tampering | Raw atoms are displayed through WikiRenderer (sanitized) in Phase 98, never `innerHTML`; `raw` is only ever re-emitted as wiki text |
| Weakening sanitize to pass round-trips | Tampering | D-02 drop happens before sanitize; schema object unchanged (add a test asserting no new tags/attrs) |
| ReDoS / super-linear scans on huge pasted descriptions | Denial of service | Linear line scanner, bounded lookahead (reuse the 50-line open-row cap), avoid nested-quantifier regexes; fuzz test includes long inputs |
| Parser throw crashing the editor | Denial of service | `loadWiki` catches everything and returns `failed` (source mode) |
| Dependency supply chain | Tampering | see Package Legitimacy Audit |

## Sources

### Primary (HIGH confidence)
- This session's scratch runs (deleted afterwards, repo tree clean): oracle probes over fixtures and ad hoc inputs; D-01/D-02 prototypes; `getSchema` + `nodeFromJSON().check()` in Node 26 with `@tiptap/core`/`pm`/`starter-kit`/`extension-table` 3.34.0.
- Repo code: `taskflow/src/lib/wiki/{preprocess,pipeline,equivalence,corpus.fixtures}.ts`, `node_modules/jira2md/index.js` (list/code/panel/header regexes), `WikiRenderer.test.tsx` L984-L1110.
- `.planning/phases/96-*/96-SPIKE-FINDINGS.md`, `96-CONTEXT.md`; `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS,STACK}.md`.
- npm registry (`npm view`): versions, ages, repository, empty `postinstall`.

### Secondary (MEDIUM confidence)
- Jira wiki grammar knowledge for `{tip}`, `{info:title=}`, `-` bullets (training data; A2/A3).

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, since the packages are locked by the spike and `getSchema` was run.
- Renderer fixes (D-01/D-02): HIGH, prototyped end to end.
- Architecture (lossless spelling replay, ladder): MEDIUM-HIGH, a design argument backed by the probe table, not yet built.
- Table/nested-list modelling and multi-block color: MEDIUM; fixtures will decide what stays modelled.
- Pitfalls: HIGH for oracle quirks (observed), MEDIUM for Jira-side behaviour (A1, A2).

**Research date:** 2026-11-16
**Valid until:** 2026-12-16 (stable; re-check `@tiptap` minor versions at install)
