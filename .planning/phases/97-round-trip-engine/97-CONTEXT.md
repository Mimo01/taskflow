# Phase 97: Round-Trip Engine - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase builds a source-level Jira wiki parser that produces an editor document, and a canonical emitter that writes the document back as wiki. It covers core text, tables, panels, `{color}` and mixed `*#` nesting, plus raw atoms for anything that isn't modelled. Three things must hold:
- Every corpus fixture renders identically after parse → emit.
- An unedited text is returned byte-for-byte.
- SAFE-06 spellings survive.

This phase also fixes two WikiRenderer divergences from Jira that the Phase 96 probe found: mixed list nesting, and the empty header row injected into header-less tables.

Not in this phase:
- any editor UI, node views or toolbar (Phase 98);
- the rich/source toggle and the source-mode fallback notice (SAFE-05, Phase 98);
- mentions popover, paste and media (Phase 99);
- host adoption (Phase 100);
- per-block source-slice re-emit (SAFE-F1, a future requirement).

</domain>

<decisions>
## Implementation Decisions

### Renderer fixes (Jira parity)
- **D-01:** Fix WikiRenderer's mixed-nesting rendering in this phase. Under a bullet, `*#` must become a nested ordered list, and `#*` under a number a nested bullet list, as Jira does. The rich editor and the read-only view then show the same structure. This deliberately changes how existing issues with mixed nesting display (they become correct). Update the expectation of `lists/mixed-nesting.wiki`, and add WikiRenderer tests for the new behaviour.
- **D-02:** Also fix header-less tables. The renderer must no longer show the synthetic empty header row that `injectHeaderlessTableSeparators` injects for GFM. Header-less tables then look like Jira's (body rows only). The doc model carries a "no header row" table attribute, so the emitter never writes an empty `||` row.
- **D-03:** The Phase 96 rule "WikiRenderer.test.tsx passes unmodified" is lifted only for the tests that lock in the two old behaviours. Today the headerless-table tests around L984–L1110 assert the synthetic empty header. Every other existing test must still pass unchanged.

- **D-12:** (added at plan-phase, after research, 2026-11-16) Also fix the renderer's panel-family gaps in this phase. Research found that WikiRenderer shows `{tip}`, `{info:title=…}`, `{warning:title=…}` and lists inside panels as literal text, while Jira renders real panels. The read-only view must render these as panels, so it matches Jira and the Phase 98 editor. As with D-01/D-02, this is its own renderer plan, it lands before the parser work, and it updates the affected corpus expectations. Do not widen the sanitize schema to do it.

### Spelling preservation
- **D-04:** An unedited text is returned as the original string (byte-identical, SAFE-03). The parser and emitter must also hold up once a text is edited, because SAFE-F1 is deferred and any edit re-emits the whole text.
- **D-05:** **Every source variant is kept as a node or mark attribute.** Examples: bullet marker `-` vs `*`, `{code:java}` vs `{code:language=java}`, heading spacing such as `h1.text` vs `h1. text`, `*bold*` vs `{*}bold{*}`, blank-line counts between blocks, emoticon tokens, mention form, escapes and `\\` breaks. For nodes it parsed, the emitter reuses the recorded spelling. An edited text should therefore diff in the Changes tab only where the user typed.
- **D-06:** Line endings: on load, detect whether the original mostly uses CRLF or LF. Emit every line of an edited text in that style. A mixed-ending text gets one style after its first edit, which renders the same. A new, empty text uses LF.
- **D-07:** **Trailing whitespace is stripped on edit**, on prose lines only. Inside `{code}` and `{noformat}` bodies trailing whitespace is content, so it is kept. Raw atoms are emitted exactly as written. An unedited text keeps it all, because D-04 returns the original string.
- **D-08:** Nodes the user creates use the forms the app already writes: today's textarea toolbar in `DescriptionEditor.tsx`, and `CommentComposer` for `[~username]`. Examples: `*` bullets, `{code:java}`, `[~username]`. Mentions are always modelled as a username and emitted as `[~username]`, never `[~accountid:…]`, per the 96 probe.

### Modelled vs raw
- **D-09:** Aim to model all four hard constructs as real nodes in v1:
  - panels inside table cells;
  - lists and panels inside panels, and panels inside list items (`panels/panel-list-items.wiki`);
  - `{color}` across several blocks: a mark per block, with spans that cross blocks merged back on emit using the recorded spelling;
  - image attributes (`!a.png|thumbnail!`, `!a.png|width=300!`): an image atom keeping the filename and its raw parameter string.

  The cardinal rule still applies to every one of them. A construct counts as modelled only once the corpus proves that `render(emit(parse(x))) == render(x)` for it. Anything flaky is demoted to raw rather than shipped lossy (success criterion 5). Each construct needs placeholder-only fixtures that cover it.
- **D-10:** Raw atoms use the **smallest span**. An unknown macro inside a sentence, such as `{status}`, becomes an inline raw atom, and the paragraph around it stays editable. A multi-line unknown macro becomes a block raw atom. If the structure itself is broken (for example a malformed table), the whole block becomes raw. A raw atom stores its exact source substring and is emitted verbatim. Missing attachments and unknown-user mentions are not raw: they stay as their own atoms and keep the filename or username (96 probe follow-up).
- **D-11:** **Runtime fallback ladder.** When the equivalence check fails for a text, the engine compares it per top-level block. It demotes the blocks that don't match to block raw atoms and checks the whole text again. Only if that still fails does it report failure, and Phase 98 then opens the text in source mode (SAFE-05). The engine API returns a result that tells Phase 98 which case it got: rich, rich with demoted blocks, or failed.

### Claude's Discretion
- **Doc model and dependencies** (the user said "you decide"). The default is that the parser outputs TipTap/ProseMirror JSON. Phase 97 then adds `@tiptap/core` and `@tiptap/pm`, plus starter-kit/table only if the schema needs them, all at the spike's pinned `^3.34.0`. It defines the node and mark schema with no node views and no UI, and the tests validate every parsed doc against that real schema (`nodeFromJSON(...).check()`). Phase 98 then needs no mapping layer. Research may overturn this if a schema-free AST is clearly safer, but it must say why.
- **Module placement** (the user said "you decide"). The constraint: ProseMirror and TipTap must never land in the main bundle. WikiRenderer imports the `lib/wiki` barrel eagerly. So the parser, emitter and schema go in a separate module, for example `src/lib/wiki/editor/` or `components/wiki-editor/model/`. That module is never re-exported from `src/lib/wiki/index.ts`. Add a guard test that WikiRenderer's import graph contains no `@tiptap` or `prosemirror` module.
- **Sequencing** (the user said "you decide"). The suggested order: land the renderer fixes (D-01/D-02) first as their own plan and commit, so the parser builds against an oracle that already matches Jira, with no behaviour change mixed into parser work.
- **Unclosed or mismatched macros** (the user said "you decide"). Examples: `{panel}` with no closing tag, or `{code}` inside `{noformat}`. Research checks what the renderer (and, if cheap, Jira) does. The likely default is a raw atom from the opener to the end of its block or of the text, plus placeholder-only fixtures that lock the behaviour in.
- The table-driven escaping module design, the attribute names, and the exact shape of the engine API, provided it covers parse, emit, the no-op check and the fallback-ladder result.
- Adding normaliser rules to `equivalence.ts`, still under the Phase 96 D-06 rule: one justified rule at a time, each with a fixture.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 96 outputs (the harness this phase plugs into)
- `.planning/phases/96-wiki-foundations-equivalence-harness/96-SPIKE-FINDINGS.md`: the TipTap decision, the node types Phase 97 needs, what the `wikiToHtml`→TipTap path loses, the Jira probe results (mixed nesting, header-less tables, mention format), and the follow-ups for Phase 97.
- `.planning/phases/96-wiki-foundations-equivalence-harness/96-CONTEXT.md`: the harness design (D-04 pluggable `roundTrip`, D-05 shared `isEquivalent`, D-06 minimal normaliser, D-07 core-only oracle, D-12 fixture layout).
- `.planning/phases/96-wiki-foundations-equivalence-harness/96-RESEARCH.md`: the Jira grammar notes and pipeline plugin order.

### Milestone research (v1.15)
- `.planning/research/SUMMARY.md` §Resolved Tension: the source-level tokenizer for load, the canonical emitter for save, and the pipeline used only as the oracle. No `generateJSON`, no `@tiptap/html`.
- `.planning/research/ARCHITECTURE.md`: the raw-atom tiers, the "cardinal rule" (L105), the segmenter/CODEBODY placeholder precedent (L99–L102, L196), the harness checks for idempotence, no-op and raw-verbatim (L112–L118), and the anti-patterns (L216–L228).
- `.planning/research/PITFALLS.md`: why the 2026-05-31 TipTap build was reverted (emoticon corruption, no-op rewrites), React Compiler module-scope rules (Pitfall on schema/extension stability), and keeping the sanitize schema unchanged.
- `.planning/research/STACK.md`: the TipTap package list and what not to add.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md`: SAFE-03, SAFE-04 and SAFE-06 (this phase); SAFE-05 (Phase 98, the consumer of the D-11 result); SAFE-F1 (deferred); the Out-of-scope table (no task lists, no Markdown or ADF storage).
- `.planning/ROADMAP.md` §Phase 97: success criteria 1–5.

### Code
- `taskflow/src/lib/wiki/equivalence.ts`: `checkCorpus`, `isEquivalent`, `RoundTrip`. Plug in `emit(parse(x))` here.
- `taskflow/src/lib/wiki/equivalence.test.ts`: the identity round-trip and mutation self-tests. Add the parse/emit corpus run, plus the idempotence, no-op and raw-verbatim checks.
- `taskflow/src/lib/wiki/preprocess.ts`: `injectHeaderlessTableSeparators` (L334), `transformPanelListItems` (L164), the list handling that D-01 touches, and the preprocess order (L749).
- `taskflow/src/lib/wiki/corpus.fixtures.ts` and `taskflow/src/lib/wiki/__fixtures__/`: the 37 placeholder-only fixtures. `.gitattributes` marks them `-text`.
- `taskflow/src/routes/dashboard/WikiRenderer.test.tsx`: L984–L1110 are the headerless-table tests that D-03 allows to change.
- `taskflow/src/routes/dashboard/DescriptionEditor.tsx`: the `insertAtCursor` toolbar forms that set the canonical spelling for new nodes (D-08).
- `taskflow/src/lib/attachment-markup.ts`: the attachment `!file!` / `[^file]` forms and the known divergence for hazardous filenames.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `checkCorpus(corpus, roundTrip, maps)` and `formatCorpusFailures` already print the fixture path, a unified diff and the emitted wiki. Phase 97 passes `(s) => emit(parse(s))`.
- `isEquivalent(a, b, maps)` is the same pure check that the D-11 runtime ladder uses.
- `JIRA_EMOTICON_MAP` in `preprocess.ts` is the emoticon token set. The parser keeps the token, not the Unicode character.
- The `\x00CODEBODY{n}\x00` placeholder technique in preprocess is the precedent for segmenting raw spans before the pipeline.
- The harness maps `HARNESS_ATTACHMENTS` and `HARNESS_USERS` in `corpus.fixtures.ts` resolve the attachment and mention fixtures.

### Established Patterns
- React Compiler runs in the app but not in vitest. Schema, extensions and parser tables must be created once at module scope and must not read mutable module state.
- The pre-commit hook runs the full vitest suite. RED and GREEN go in one commit per TDD task, and mutation-style tests assert that a failure is reported.
- No customer data. Fixtures are placeholder-only, including the new ones for the hard constructs, malformed macros and the line-ending and whitespace cases.
- The sanitize schema in `pipeline.ts` is a security boundary. Don't widen it to make round-trips pass.

### Integration Points
- Phase 98 consumes:
  - the schema;
  - the parse and emit functions;
  - the D-11 result, which decides rich vs source mode and the notice;
  - the no-op contract: the host keeps the original string until a user transaction.
- The renderer fixes (D-01/D-02) reach every WikiRenderer consumer, about 24 importing files: detail views, comments, AIO, MR detail, release description, changelog.

</code_context>

<specifics>
## Specific Ideas

- Edited texts should show up in the Changes tab only where the user actually typed. That is what D-05 is for: an edit should not cause a whole-description diff.
- The corruptions the reverted build actually caused must stay covered by fixtures: `(/)` turning into an emoji spelling, flattened `*#` nesting, and lost panel titles.

</specifics>

<deferred>
## Deferred Ideas

- SAFE-F1, per-block source-slice re-emit, stays a future requirement. D-05's attributes get most of the benefit without it.
- Storing real Jira HTML as golden files for lists only, which the 96 findings mentioned after the mixed-nesting divergence: still deferred. D-01 fixes the renderer instead.

### Reviewed Todos (not folded)
- `notifications-highlight-you-mention.md`, `priority-stripe-rest-rank.md`, `notifications-status-category-colours.md` and `notifications-due-date-overdue.md` matched only on generic keywords. They are unrelated to the round-trip engine and stay in the backlog, as in Phase 96.

</deferred>

---

*Phase: 97-round-trip-engine*
*Context gathered: 2026-11-16*
