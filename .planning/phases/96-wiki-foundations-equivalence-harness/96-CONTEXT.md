# Phase 96: Wiki Foundations & Equivalence Harness - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the existing wiki rendering pipeline reusable outside `WikiRenderer` (pure extraction into `src/lib/wiki/`, zero behaviour change), build a placeholder-only fixture corpus plus an equivalence harness that CI runs, and run the time-boxed editor-library spike so Phase 97 builds against a chosen engine.

Not in this phase: the real parser/emitter (Phase 97), any editor UI or host change (Phase 98+), adding editor dependencies to the app.

</domain>

<decisions>
## Implementation Decisions

### Library spike gate
- **D-01:** The TipTap vs CodeMirror-6 live-preview spike runs **in Phase 96**, after the corpus exists, and uses about 10 hard fixtures from it plus a WKWebView (Tauri macOS) caret and IME smoke test.
- **D-02:** Decision rule is **rich-feel first**. TipTap wins unless the spike shows a WKWebView caret/IME blocker. Round-trip safety comes from the Phase 97 parser/emitter whichever engine wins, so it is not the deciding factor.
- **D-03:** Spike prototypes are throwaway. No editor dependencies land in `package.json` on main in this phase. The outcome (engine chosen, blockers seen, API notes for Phase 97/98) is recorded as a findings doc in the phase directory.

### Harness before a parser
- **D-04:** The harness takes a pluggable `roundTrip(wiki: string) => string`. Phase 96 ships the **identity** round-trip (corpus always green) plus a **mutation self-test**: a deliberately lossy round-trip (e.g. dropping emoticons or flattening nested lists) that the harness MUST flag as failing. This proves the CI gate bites. Phase 97 plugs in `emit(parse(x))`.
- **D-05:** `isEquivalent(a, b)` (and its normaliser) ships as a **pure function in `src/lib/wiki/`**, so the CI harness now and the editor's runtime rich-mode guard later (SAFE-05) use the same check.

### Equivalence strictness
- **D-06:** **Minimal normaliser, every rule justified.** Start with only attribute-order sorting and whitespace-run collapsing outside `<pre>`. Each further rule (tight/loose `<li><p>`, `<br>` vs newline, entity forms, empty text nodes) is added only with a fixture showing the difference is invisible to users. Each rule is a documented exception in code.
- **D-07:** The oracle is the **core pipeline only**: `wikiToHtml` = preprocess → jira2md → link-underscore fix and code-body restore → remark (gfm, breaks) → rehype (raw, inline-code entity decode, sanitize). Presentation-only steps are excluded so they can't mask or fake differences. That means `rehypeIssueKeys`, which depends on activeJiraProject, the React `components` map (IssueKeyLink, AuthImage, OlRenderer, link handlers) and the lightbox. No full jsdom `<WikiRenderer>` render in the harness.
- **D-08:** On failure, CI prints the **fixture path, a unified diff of the normalised before/after HTML, and the emitted wiki text**.

### Corpus source & Jira truth
- **D-09:** The corpus is **harvest + grammar sweep**. Seed it from the inputs in `WikiRenderer.test.tsx` (already placeholder text and real regressions), then fill gaps per grammar construct. At minimum: nested and mixed `*#` lists, header-less tables, tables with inline callouts, the panel family (`{panel}`/`{info}`/`{note}`/`{warning}`/`{tip}`, with titles), `{code}` with language, `{noformat}`, `{color}`, emoticons (`(/)`, `(x)`, …), `[~username]` mentions, escapes, `\\` line breaks, CRLF and trailing whitespace, `{{ ` plain-space vs nbsp, `{{{}TT{}}}` teletype, attachments `!file!`/`[^file]`, unknown macros.
- **D-10:** **No customer data.** Every fixture is placeholder-only text, even if a construct was seen in real issues.
- **D-11:** **Live Jira check is a one-off research probe, findings only.** POST a few placeholder-only hard fixtures to Jira DC's read-only wiki render endpoint and record grammar surprises in research. No Jira HTML is stored, and CI uses WikiRenderer's pipeline as its only oracle. The mention-format question (`[~username]` vs `[~accountid:…]` on this DC instance) is answered in the same probe.
- **D-12:** Fixtures are **one `.wiki` file each**, grouped in folders by construct (e.g. `fixtures/lists/mixed-nesting.wiki`) and loaded via `import.meta.glob(..., { query: '?raw' })`. Add `.gitattributes` marking fixtures `-text` so CRLF and trailing whitespace are preserved byte-exactly.

### Claude's Discretion
- Exact `src/lib/wiki/` module split (e.g. `preprocess.ts`, `pipeline.ts`, `equivalence.ts`) and whether helpers like `splitInlineSingleLineTables` / `JIRA_EMOTICON_MAP` move or are re-exported. `WikiRenderer.test.tsx` must keep passing **unmodified**, so WikiRenderer re-exports whatever the test imports.
- Whether `WikiRenderer.tsx` itself stays in `src/routes/dashboard/` (default: stays; this phase moves only the pipeline).
- Fixture folder location (e.g. `src/lib/wiki/__fixtures__/`) and harness test file placement.
- Commit/plan sequencing. Do the extraction as its own plan/commit with no harness or spike changes mixed in, per PITFALLS.
- How the spike prototypes are hosted (scratch Vite page vs dev-tools tab on a throwaway branch).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (v1.15)
- `.planning/research/SUMMARY.md`: resolved load/save/oracle architecture, spike scope, stack do/don't list
- `.planning/research/ARCHITECTURE.md`: `lib/wiki/` component map, equivalence harness design, segmenter/raw-atom pattern, CODEBODY placeholder precedent
- `.planning/research/PITFALLS.md`: why the 2026-05-31 TipTap build was reverted; extraction-behind-tests rule; corpus-first gate
- `.planning/research/STACK.md`: TipTap v3 / CodeMirror candidates for the spike
- `.planning/research/FEATURES.md`: construct list the corpus must eventually cover

### Requirements & roadmap
- `.planning/REQUIREMENTS.md`: SAFE-01, SAFE-02 (this phase); SAFE-03..06 (Phase 97 consumers of this harness); Out-of-scope table (no task lists, no markdown/ADF storage)
- `.planning/ROADMAP.md` §Phase 96: success criteria 1–4

### Code
- `taskflow/src/routes/dashboard/WikiRenderer.tsx`: the pipeline to extract (preprocessJiraMarkup L680, helpers L136–L680, fixMarkdownLinkUnderscores L1199, rehype plugins L1306–L1420, render L1511+)
- `taskflow/src/routes/dashboard/WikiRenderer.test.tsx`: must pass unmodified; seed source for the corpus

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `preprocessJiraMarkup(wiki, attachments, users)` → `{ text, codeBlockBodies }`: the core preprocess, already pure. It relies on the `\x00CODEBODY{n}\x00` placeholder restored after `j2m.to_markdown`.
- `wikiSanitizeSchema`: the sanitize allowlist. It belongs in the core pipeline (it changes output), and `issuekeylink` stays allowlisted for the presentation layer.
- `rehypeDecodeInlineCodeEntities`: output-changing, so it goes in core. `rehypeIssueKeys(activeJiraProject)` is presentation and stays out of core.
- `src/lib/attachment-markup.ts`, `src/hooks/useMentionUserMap.ts`: existing wiki-adjacent helpers (attachments map / users map inputs to preprocess).

### Established Patterns
- React Compiler runs in the app but not in vitest. `lib/wiki/` functions must be pure, with no reads of module-level mutable state (memory: React Compiler vs module reads).
- The pre-commit hook runs the full vitest suite. A deliberately failing mutation self-test must assert *that the harness reports failure*, not itself fail.
- Jira `{{ ` / nbsp / `{{{}TT{}}}` rules and pre-jira2md entity decoding are encoded in preprocess today. Don't re-derive them; cover them with fixtures (memories: Jira tt macro format, wiki monospace rules).
- No customer data in the repo. The history was rewritten once for this (memory: no customer data in repo).

### Integration Points
- About 24 files import from `WikiRenderer.tsx` (detail views, comments, AIO, MR detail, release description, changelog). Their imports must keep working (re-exports).
- The vitest/jsdom setup already exists. Pipeline-level harness runs in node and needs no DOM.

</code_context>

<specifics>
## Specific Ideas

- The mutation self-test should use a realistic lossy transform (emoticon `(/)` → emoji spelling, or flattening `*#` nesting). Those are the corruptions the reverted build actually caused.
- The spike's WKWebView smoke test must run in the real Tauri app, not only in a browser, because jsdom and Chromium can't show WebKit caret/IME behaviour.

</specifics>

<deferred>
## Deferred Ideas

- Storing real Jira HTML as per-fixture golden files: rejected for now as too brittle; revisit if the probe shows WikiRenderer diverges materially from Jira.
- Moving `WikiRenderer.tsx` out of `routes/dashboard/` into `components/`: not needed for this phase.

### Reviewed Todos (not folded)
- `notifications-highlight-you-mention.md`, `priority-stripe-rest-rank.md`, `notifications-status-category-colours.md`, `notifications-due-date-overdue.md` matched only on generic keywords and are unrelated to wiki extraction, so they stay in the backlog.

</deferred>

---

*Phase: 96-wiki-foundations-equivalence-harness*
*Context gathered: 2026-11-16*
