# Phase 96: Wiki Foundations & Equivalence Harness - Research

**Researched:** 2026-11-16
**Domain:** Extracting a unified/remark/rehype wiki pipeline into `src/lib/wiki/`, fixture-corpus equivalence harness (vitest), editor-engine spike
**Confidence:** MEDIUM-HIGH (code facts verified by reading the repo; Jira live probe and spike are NOT done, see Open Questions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The TipTap vs CodeMirror-6 live-preview spike runs in Phase 96, after the corpus exists, and uses about 10 hard fixtures from it plus a WKWebView (Tauri macOS) caret and IME smoke test.
- **D-02:** Decision rule is rich-feel first. TipTap wins unless the spike shows a WKWebView caret/IME blocker. Round-trip safety comes from the Phase 97 parser/emitter whichever engine wins, so it is not the deciding factor.
- **D-03:** Spike prototypes are throwaway. No editor dependencies land in `package.json` on main in this phase. The outcome (engine chosen, blockers seen, API notes for Phase 97/98) is recorded as a findings doc in the phase directory.
- **D-04:** The harness takes a pluggable `roundTrip(wiki: string) => string`. Phase 96 ships the identity round-trip (corpus always green) plus a mutation self-test: a deliberately lossy round-trip (e.g. dropping emoticons or flattening nested lists) that the harness MUST flag as failing. Phase 97 plugs in `emit(parse(x))`.
- **D-05:** `isEquivalent(a, b)` (and its normaliser) ships as a pure function in `src/lib/wiki/`, so the CI harness now and the editor's runtime rich-mode guard later (SAFE-05) use the same check.
- **D-06:** Minimal normaliser, every rule justified. Start with only attribute-order sorting and whitespace-run collapsing outside `<pre>`. Each further rule (tight/loose `<li><p>`, `<br>` vs newline, entity forms, empty text nodes) is added only with a fixture showing the difference is invisible to users. Each rule is a documented exception in code.
- **D-07:** The oracle is the core pipeline only: `wikiToHtml` = preprocess -> jira2md -> link-underscore fix and code-body restore -> remark (gfm, breaks) -> rehype (raw, inline-code entity decode, sanitize). Presentation-only steps are excluded (`rehypeIssueKeys`, the React `components` map, lightbox). No full jsdom `<WikiRenderer>` render in the harness.
- **D-08:** On failure, CI prints the fixture path, a unified diff of the normalised before/after HTML, and the emitted wiki text.
- **D-09:** Corpus is harvest + grammar sweep. Seed from `WikiRenderer.test.tsx` inputs, then fill gaps. At minimum: nested and mixed `*#` lists, header-less tables, tables with inline callouts, panel family (`{panel}`/`{info}`/`{note}`/`{warning}`/`{tip}`, with titles), `{code}` with language, `{noformat}`, `{color}`, emoticons, `[~username]` mentions, escapes, `\\` line breaks, CRLF and trailing whitespace, `{{ ` plain-space vs nbsp, `{{{}TT{}}}` teletype, attachments `!file!`/`[^file]`, unknown macros.
- **D-10:** No customer data. Every fixture is placeholder-only text.
- **D-11:** Live Jira check is a one-off research probe, findings only. No Jira HTML stored; CI uses WikiRenderer's pipeline as its only oracle. Mention-format question answered in the same probe.
- **D-12:** One `.wiki` file per fixture, grouped in folders by construct, loaded via `import.meta.glob(..., { query: '?raw' })`. `.gitattributes` marks fixtures `-text`.

### Claude's Discretion
- Exact `src/lib/wiki/` module split and whether helpers like `splitInlineSingleLineTables` / `JIRA_EMOTICON_MAP` move or are re-exported. `WikiRenderer.test.tsx` must keep passing unmodified, so WikiRenderer re-exports whatever the test imports.
- Whether `WikiRenderer.tsx` stays in `src/routes/dashboard/` (default: stays).
- Fixture folder location and harness test file placement.
- Commit/plan sequencing; extraction is its own plan/commit with no harness or spike changes mixed in.
- How spike prototypes are hosted (scratch Vite page vs dev-tools tab on a throwaway branch).

### Deferred Ideas (OUT OF SCOPE)
- Storing real Jira HTML as per-fixture golden files.
- Moving `WikiRenderer.tsx` out of `routes/dashboard/` into `components/`.
- Todos (notifications-*, priority-stripe-*) unrelated.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAFE-01 | Pipeline reusable outside WikiRenderer; renders unchanged | Pipeline anatomy, extraction plan, re-export list, importer audit |
| SAFE-02 | Placeholder corpus + CI equivalence assertion that fails on difference | Harness design, normaliser, mutation self-test, glob/gitattributes findings |
</phase_requirements>

## Summary

Every piece of the oracle already exists as pure code inside `WikiRenderer.tsx` (1802 lines). Extraction is a move of module-level pure functions (`splitInlineSingleLineTables` ... `preprocessJiraMarkup`, `fixMarkdownLinkUnderscores`, `wikiSanitizeSchema`, `rehypeDecodeInlineCodeEntities`) plus the inline `j2m.to_markdown(...)` + CODEBODY restore expression that currently lives in the component body (L1531-1540). The component then calls a new `wikiToMarkdown()` and passes the same plugin arrays to `<Markdown>`. The test file imports only four helpers plus `WikiRenderer`, so the re-exports needed are small.

`wikiToHtml` in node is feasible with deps already present (`unified` 11.0.5, `remark-parse`, `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `remark-gfm`, `remark-breaks`, all transitive/direct via react-markdown 10.1.0) plus ONE new dependency for serialisation: `rehype-stringify` 10.0.1 (not installed; `hast-util-to-html` is also absent). react-markdown's internal chain is exactly `unified().use(remarkParse).use(remarkPlugins).use(remarkRehype, {allowDangerousHtml: true}).use(rehypePlugins)` followed by a post step (`urlTransform` + JSX), so a standalone pipeline built the same way is faithful, with one known divergence: react-markdown's post step applies `defaultUrlTransform` to href/src. Sanitize already constrains protocols, so for the oracle this is acceptable but must be documented.

**Primary recommendation:** Do the extraction as plan 1 (no new tests, existing 2702-line test unchanged as safety net), add `rehype-stringify` + a node-environment harness in plan 2, corpus in plan 3, spike as a human-verify checkpoint plan last. Share a single exported `corePlugins` array between `<Markdown>` and `wikiToHtml` so they cannot drift.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wiki to markdown/HTML pipeline | Browser/Client (pure lib) | - | Desktop Tauri app; pure TS in `src/lib/wiki/`, runs in webview and vitest node |
| Equivalence check (`isEquivalent`) | Browser/Client (pure lib) | CI (vitest) | Same function used by CI and the future runtime guard (D-05) |
| Fixture corpus | Repo (test data) | CI | Static `.wiki` files read via Vite glob |
| Live Jira grammar probe | Manual / research only | - | Needs PAT in Stronghold; not part of CI |
| Editor spike | Tauri WKWebView | scratch branch | Caret/IME can only be observed in real WebKit |

## Standard Stack

### Core (already installed, verified in node_modules)
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| unified | 11.0.5 | processor | transitive via react-markdown; add as direct dep if imported directly [VERIFIED: node_modules] |
| remark-parse, remark-rehype, rehype-raw (7.x/hast-util-raw 9.1.0), rehype-sanitize 6, remark-gfm 4, remark-breaks 4 | installed | pipeline | same plugins WikiRenderer uses |
| jira2md | 3.0.1 | wiki to markdown | `j2m.to_markdown`; untyped (`@ts-expect-error` import must be preserved in the new module) |
| diff | ^9.0.0 | unified diff for D-08 (`createTwoFilesPatch`) | already a direct dep [VERIFIED: package.json] |
| vitest | ^4.0.18 | harness | `environment: 'jsdom'` globally; use per-file `// @vitest-environment node` docblock |

### To add
| Library | Version | Purpose |
|---------|---------|---------|
| rehype-stringify | 10.0.1 (npm view; last modified 2024-09) | hast to HTML string for `wikiToHtml` |
| rehype-parse | 9.0.1 | ONLY if the normaliser parses HTML. Recommended: avoid (see Normaliser) |

`unified`, `remark-parse`, `remark-rehype`, `hast-util-raw` are in node_modules only transitively; list `unified`, `remark-parse`, `remark-rehype` as direct deps if imported directly, otherwise import only what WikiRenderer already imports directly (rehype-raw, rehype-sanitize, remark-gfm, remark-breaks) and add `unified`, `remark-parse`, `remark-rehype`, `rehype-stringify`. [ASSUMED: package legitimacy beyond registry existence; unified-collective packages are well known but slopcheck was not run, planner should gate with a human-verify task or run `slopcheck` / `npm view <pkg> scripts.postinstall` first.]

**Installation:** `cd taskflow && npm install unified remark-parse remark-rehype rehype-stringify` (dev-or-regular: they are used by `src/lib` so regular deps; `rehype-stringify` is only needed by tests/oracle unless runtime guard SAFE-05 uses it, so regular).

## Package Legitimacy Audit

| Package | Registry | Source | slopcheck | Disposition |
|---------|----------|--------|-----------|-------------|
| rehype-stringify | npm | unifiedjs/rehype (well-known) | not run | [ASSUMED] gate with human-verify; `npm view` shows no postinstall script |
| unified, remark-parse, remark-rehype | npm | already in lockfile transitively | n/a | already installed |

Packages removed: none. Flagged suspicious: none. slopcheck unavailable in this session, so new-dependency installs stay [ASSUMED] until the planner's checkpoint.

## Architecture Patterns

### Current pipeline, exact order (verified WikiRenderer.tsx)
```
wikiText
  -> preprocessJiraMarkup(wiki, attachments, users)      L680 -> { text, codeBlockBodies }
       (splitInlineSingleLineTables, mergeOpenTableRows, injectHeaderlessTableSeparators,
        emoticons -> Unicode, {code}/{noformat} bodies swapped for \x00CODEBODY{n}\x00,
        \x00USCORE\x00 protection of underscores in [links], mentions -> <mention data-id>, ...)
  -> j2m.to_markdown(text)                               L1534
  -> fixMarkdownLinkUnderscores(md)                      L1199 (* -> _ in hrefs, restore \x00USCORE\x00)
  -> .replace(/\x00CODEBODY(\d+)\x00/g, codeBlockBodies[i])   L1535-1538
  -> <Markdown>:
       remarkPlugins  [remarkGfm, remarkBreaks]
       remark-rehype  {allowDangerousHtml: true}          (react-markdown internal)
       rehypePlugins  [rehypeRaw,
                       rehypeIssueKeys(activeJiraProject), <- PRESENTATION
                       rehypeDecodeInlineCodeEntities,     <- CORE (changes output)
                       [rehypeSanitize, wikiSanitizeSchema]] <- CORE per D-07
       urlTransform (defaultUrlTransform), toJsxRuntime with `components`
```

Core vs presentation:
| Step | Class |
|------|-------|
| preprocessJiraMarkup, j2m, fixMarkdownLinkUnderscores, CODEBODY restore | core |
| remarkGfm, remarkBreaks, rehypeRaw, rehypeDecodeInlineCodeEntities, rehypeSanitize(wikiSanitizeSchema) | core |
| rehypeIssueKeys, `components` map (IssueKeyLink, AuthImage, OlRenderer, callout div/span, mention badge, table wrapper), lightbox | presentation (stay in WikiRenderer.tsx) |

Ordering constraint to preserve: `rehypeIssueKeys` sits BETWEEN raw and decode, and its `issuekeylink` element must survive sanitize (schema keeps `issuekeylink` allowlisted; keep it in the shared schema as CONTEXT says). Therefore the shared export is NOT one array containing everything; recommended shape:

```ts
// src/lib/wiki/pipeline.ts
export const wikiRemarkPlugins = [remarkGfm, remarkBreaks] as const;
export const wikiRehypeCoreBeforeKeys = [rehypeRaw] as const;
export const wikiRehypeCoreAfterKeys = [rehypeDecodeInlineCodeEntities, [rehypeSanitize, wikiSanitizeSchema]] as const;
export function wikiRehypePlugins(presentation: PluggableList = []) {
  return [...wikiRehypeCoreBeforeKeys, ...presentation, ...wikiRehypeCoreAfterKeys];
}
// WikiRenderer: rehypePlugins={wikiRehypePlugins([rehypeIssueKeys(activeJiraProject)])}
// wikiToHtml:   wikiRehypePlugins([])
```
This makes the order a single source of truth. Note ARCHITECTURE.md calls sanitize "presentation"; CONTEXT D-07 (locked) says core. Follow CONTEXT. Removing `rehypeIssueKeys` from the oracle is behaviour-neutral for non-key text; the harness never needs it.

### wikiToHtml
```ts
// Source: mirrors react-markdown 10.1.0 lib/index.js createProcessor (verified in node_modules)
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
export function wikiToHtml(wiki: string, attachments?: AttachmentMap, users?: UserMap): string {
  const md = wikiToMarkdown(wiki, attachments, users);          // preprocess+j2m+fix+restore
  return String(
    unified().use(remarkParse).use(remarkPlugins).use(remarkRehype, { allowDangerousHtml: true })
      .use(wikiRehypePlugins([])).use(rehypeStringify).processSync(md),
  );
}
```
Divergences vs what WikiRenderer renders: (1) react-markdown applies `defaultUrlTransform` to `href`/`src` after plugins (drops non-http/mailto/etc. protocols) while sanitize applies its own protocol allowlist; (2) `rehypeStringify` serialises `<br>`/entities in its own way while React renders DOM; neither matters because the harness compares wikiToHtml(A) with wikiToHtml(B) (both sides through the same serialiser), not against the React output. (3) `rehype-stringify` needs `allowDangerousHtml` only if raw nodes remain after rehype-raw; they do not. Everything is synchronous (`processSync` works: no async plugins).

### Extraction plan (module split, discretion recommendation)
```
src/lib/wiki/
  preprocess.ts   # splitInlineSingleLineTables ... preprocessJiraMarkup, JIRA_EMOTICON_MAP, types AttachmentMap/UserMap
  pipeline.ts     # wikiSanitizeSchema, rehypeDecodeInlineCodeEntities, fixMarkdownLinkUnderscores, wikiToMarkdown, plugin lists, wikiToHtml
  equivalence.ts  # normalizeHtml, isEquivalent, diff formatting
  index.ts
  __fixtures__/<construct>/*.wiki
  equivalence.test.ts
```
WikiRenderer.tsx re-exports (verified exact test import, L4-10): `injectHeaderlessTableSeparators`, `JIRA_EMOTICON_MAP`, `mergeOpenTableRows`, `splitInlineSingleLineTables`, `WikiRenderer`. Also re-export `type AttachmentMap`, `type UserMap`: ~20 importers pull `AttachmentMap`/`UserMap` types or `WikiRenderer` from `WikiRenderer` (paths `./WikiRenderer`, `../WikiRenderer`, `@/routes/dashboard/WikiRenderer`). Planner step: `grep -rn "WikiRenderer'" src` and confirm no importer takes another named symbol (the sampled output shows only `WikiRenderer`, `AttachmentMap`, `UserMap`). Use `export { ... } from '@/lib/wiki'` so importers need zero edits.

Keep `HastElement` type used by decode plugin and `visit` import (`unist-util-visit`) moving with it. `// biome-ignore lint/suspicious/noControlCharactersInRegex` comments must travel with the regexes (pre-commit runs `biome check --staged` and `tsc`).

### Module-level state audit (React Compiler gotcha)
Module-level declarations in the extracted range are all `const`: `wikiSanitizeSchema` (object), `PANEL_TAG_RE` (`/g` regex), `JIRA_EMOTICON_MAP` (array of `/g` regexes), `ISSUE_KEY_*_RE` (presentation, stays), `calloutStyles`, `OlDepthContext` (stays). No `let` at module level. Hazards: (a) `PANEL_TAG_RE` is `/g` but only used through `String.match` (which resets `lastIndex`), safe; (b) `JIRA_EMOTICON_MAP` regexes used via `String.replace` (safe). Never use `.test()`/`.exec()` on these shared `/g` regexes in new code (harness mutation transform included; build a fresh regex or use `replaceAll` with a string). `wikiSanitizeSchema` is shared by reference with react-markdown; do not mutate. [VERIFIED: grep of WikiRenderer.tsx]

### Normaliser (D-06)
Do not add rehype-parse. Because both sides come from the same `unified` stringify, a string-level normaliser is enough and keeps the hot path dependency-free (important for the runtime guard, SAFE-05). Alternative that stays within D-06 and avoids regex-on-HTML fragility: normalise on the hast tree BEFORE stringify (sort `properties` keys, collapse whitespace in `text` nodes not under `pre`) via a tiny rehype plugin `rehypeNormalizeForCompare`, then stringify. Recommended: expose `wikiToNormalizedHtml` (tree-level) used by `isEquivalent(wikiA, wikiB)`. This needs only `unist-util-visit` (present). Attribute order from hast-util-to-html follows property insertion order, so sorting `node.properties` keys handles rule 1; rule 2 collapses `/\s+/g` -> `' '` on text nodes whose ancestor chain has no `pre`. Each later rule gets a code comment naming the fixture that justifies it. [ASSUMED: that insertion-order sorting is sufficient; verify with a fixture pair that differs only by attribute order.]

Important semantic: `isEquivalent(a, b)` compares RENDERINGS of two wiki strings (`wikiToHtml(a)` vs `wikiToHtml(b)`), where b = roundTrip(a). Fixtures must be read byte-exact so that CRLF/trailing-whitespace hits preprocess identically.

### Harness and mutation self-test (D-04, D-08)
```ts
// equivalence.test.ts  (// @vitest-environment node)
const fixtures = import.meta.glob('./__fixtures__/**/*.wiki', { query: '?raw', import: 'default', eager: true }) as Record<string,string>;
export function checkCorpus(roundTrip: (s:string)=>string) {
  return Object.entries(fixtures).flatMap(([path, wiki]) => {
    const out = roundTrip(wiki);
    return isEquivalent(wiki, out) ? [] : [{ path, diff: unifiedDiff(path, wikiToNormalizedHtml(wiki), wikiToNormalizedHtml(out)), emitted: out }];
  });
}
it('identity round-trip: whole corpus equivalent', () => expect(checkCorpus((s)=>s)).toEqual([]));   // failure message prints path+diff+emitted
it('self-test: lossy emoticon round-trip is reported', () => {
  const failures = checkCorpus((s) => s.replaceAll('(/)', 'OK'));      // fresh string replace, no /g regex state
  expect(failures.length).toBeGreaterThan(0);
  expect(failures.map(f => f.path)).toContain(<the emoticon fixture>);
});
it('self-test: flattening nested lists is reported', ...);  // e.g. s.replace(/^\*\*\s/gm, '* ')
it('self-test: every mutation also fires on at least one fixture (guards against vacuous corpus)')
```
Green for pre-commit because the test asserts failures are returned, not that the suite fails. Each mutation test must name a fixture that contains the construct so removing that fixture breaks the test (protects the corpus). Failure output for the identity test: format failures into the assertion message (path, diff, emitted text) per D-08 (e.g. `expect(failures, formatFailures(failures)).toEqual([])` or throw a custom Error).

Note: with the identity round-trip, `isEquivalent(x,x)` is trivially true, so the real value this phase is the mutation tests plus the plumbing; make sure `isEquivalent` also has direct unit tests: attribute-order difference equal, whitespace-run difference equal, `<pre>` whitespace difference NOT equal, emoticon difference NOT equal.

Emoticon caution: `preprocessJiraMarkup` converts `(/)` to Unicode emoji BEFORE rendering, so wiki text `(/)` and a literal emoji render identically. A mutation `(/)` -> emoji spelling would be INVISIBLE to the harness (equivalent rendering) yet changes stored text. Use a mutation that changes the rendering (drop the emoticon, or `(/)` -> `OK`), or add a separate text-level strictness note for Phase 97 (SAFE-03 byte-identical-when-untouched is stronger than render-equivalence). Flag this to the planner: CONTEXT's example "`(/)` -> emoji spelling" would NOT fail the harness. [VERIFIED: JIRA_EMOTICON_MAP L478-495]

### Fixtures, glob, gitattributes
- `import.meta.glob('./__fixtures__/**/*.wiki', { query: '?raw', import: 'default', eager: true })` works in vitest (Vite transform); vitest config is plain `defineConfig` with `react()` plugin and jsdom, no glob special-casing. No existing `import.meta.glob` use in src (only a comment in `widget-removal.guard.test.ts` saying fs was preferred), so there is no repo precedent; the equivalent `fs.readdirSync` + `readFileSync` under `// @vitest-environment node` is the fallback and is byte-exact by construction (raw `?raw` import is also byte-exact). tsc: `import.meta.glob` typing needs `vite/client` in tsconfig `types`; check `tsconfig.json`; if absent, cast or add a `/// <reference types="vite/client" />`. [ASSUMED: tsconfig already includes vite/client since the app is a Vite app; verify.]
- `.gitattributes` does not exist anywhere in the repo (verified). Create `taskflow/.gitattributes` at the git root (outer `taskflow/`, path-relative): `taskflow/src/lib/wiki/__fixtures__/** -text`. Without it a Windows/`core.autocrlf` checkout would rewrite CRLF fixtures. Also verify Biome does not process `.wiki` files and `biome check --staged ./src` ignores them (non-JS extension: ignored). The CRLF fixture must be created by a byte-exact write (printf), not an editor that normalises line endings; add a test asserting the CRLF fixture actually contains `\r\n` (`expect(raw).toContain('\r\n')`) so a normalised checkout fails loudly. Same for trailing whitespace.
- Put fixture authoring in a helper test `corpus-coverage.test.ts` asserting each D-09 construct has at least one fixture (list of required fixture filenames).

### Anti-Patterns
- Moving logic and changing behaviour in the same commit (PITFALLS: reverted TipTap build).
- Importing `WikiRenderer` (React, stores, Tauri plugins) from `lib/wiki/`; `lib/wiki` must have zero React/Tauri/zustand imports so it loads in node.
- Real Jira text or HTML in fixtures.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Unified diff | custom diff | `diff` package `createTwoFilesPatch` (already dep) |
| HTML serialiser | template strings | `rehype-stringify` |
| Wiki to markdown | new converter | existing preprocess + jira2md (do not re-derive memory-documented Jira rules) |
| Sanitisation | regex strip | existing `rehype-sanitize` + schema |

## Common Pitfalls

1. **Behaviour drift in extraction.** Mitigation: existing 2702-line test unchanged; run it before/after; no edits to function bodies (diff of moved text should be pure relocation, check with `git diff --color-moved`).
2. **Component-body expression moved wrongly.** The j2m + fix + CODEBODY restore is inline in the component, not a function. Preserve the guard `preprocessed ? ... : ''` (empty/null wikiText gives `''`). Beware `codeBlockBodies[Number.parseInt(i,10)]` replacement string: `String.replace` with a function avoids `$&` interpretation; keep the function form.
3. **Vacuous harness** (identity is always green). Mutation self-tests tied to named fixtures.
4. **Emoticon mutation invisible** (see above).
5. **CRLF normalised by git/editor.** `-text` plus a `\r\n` assertion test.
6. **jsdom global environment.** The harness does not need DOM; use `@vitest-environment node` docblock to avoid jsdom cost and DOM-dependent surprises. `unified` pipeline runs in either.
7. **`/g` regex statefulness** in shared constants.
8. **Pre-commit runs `biome check --staged`, `tsc --noEmit`, full vitest**: moved code must keep `biome-ignore` comments and the `@ts-expect-error` on `jira2md`; `index.ts` re-exports must satisfy biome's import ordering. Do not run `biome --write` on all of src (memory).
9. **Dev-dependency leak:** the spike must not touch `package.json` on main (D-03); host on a throwaway branch/worktree.
10. **React Compiler:** the app compiles WikiRenderer; vitest does not. Keep new module functions pure; do not memoise at module level.

## Code Examples
See `wikiToHtml`, harness and plugin-list snippets above.

## State of the Art
| Old | Current | Impact |
|-----|---------|--------|
| react-markdown `text` override | rehype plugin (v10 dropped it) | already handled by `rehypeIssueKeys` |
| TipTap | v3.34.0 on npm (checked) | spike target; `@codemirror/view` 6.43.15 |

## Live Jira probe (D-11): NOT executed
App auth: `Authorization: Bearer <PAT>` (src/services/jira.ts L82). The PAT lives in Stronghold (`readSecret` in `src/services/stronghold.ts`), an encrypted vault unlocked in-app; no `JIRA*` env var is set in this shell and no `.env`/local config files exist in the repo dir. So credentials are NOT reachable non-interactively; per instructions the probe is an open item. The base URL is also user-specific. Commands for the user (replace `$JIRA` and `$PAT`; all content placeholder-only; do NOT paste the responses into the repo, summarise grammar surprises as text):

```bash
JIRA=https://jira.example.com ; PAT=...   # from Settings, never commit
render() { curl -s -H "Authorization: Bearer $PAT" -H 'Content-Type: application/json' \
  -X POST "$JIRA/rest/api/1.0/render" \
  -d "$(python3 -c 'import json,sys;print(json.dumps({"rendererType":"atlassian-wiki-renderer","unrenderedMarkup":sys.stdin.read(),"issueKey":"PROJ-1"}))')"; }
printf '* a\n*# b\n*# c\n** d\n' | render                      # nested mixed lists
printf '|a|b|\n|c|d|\n' | render                               # header-less table
printf '{panel:title=T}body{panel}\n' | render                 # panel with title
printf '(/) (x) (!) (i) (*)\n' | render                        # emoticons
printf 'Hi [~someuser] and [~accountid:abc123]\n' | render     # mention format
printf '{{ plain}} {{\xc2\xa0nbsp}} {{{}TT{}}}\n' | render      # {{ vs nbsp, teletype
```
The endpoint `/rest/api/1.0/render` (the one Jira's own wiki preview uses) is [ASSUMED] from training knowledge; the officially documented alternative is `GET /rest/api/2/issue/{key}?expand=renderedFields`, which needs a real issue and returns content (use only on a scratch issue). Mention format: the app's preprocess already handles BOTH `[~username]` and `[~accountId:xxx]` (L983-991), so the harness is safe either way; Jira DC historically uses `[~username]` (Cloud uses `[~accountid:...]`) [ASSUMED].

## Editor-engine spike (D-01..D-03)
Planner needs a `checkpoint:human-verify` plan, after the corpus lands, with:
- Host: throwaway git branch/worktree (D-03 keeps main clean) with a scratch route, or a separate scratch Vite page (existing practice: "throwaway vite page" noted in memory for screenshots). Must be run inside the real Tauri app (`npm run tauri dev`, script `tauri` exists, `src-tauri/tauri.conf.json` present) for WKWebView. Prototype candidates: TipTap v3 (`@tiptap/core` 3.34.0, `@tiptap/starter-kit`, `@tiptap/pm`) vs CodeMirror 6 (`@codemirror/view` 6.43.15, `@codemirror/state`, decorations for live-preview). [VERIFIED: npm registry versions; STACK.md has candidate details]
- Load about 10 hard fixtures (nested lists, table, panel, emoticons, mention, CRLF, `{code}`, unknown macro, attachments, colour).
- Smoke checklist (human): caret placement/arrow keys across list/table/atom boundaries; IME composition (macOS Japanese/Chinese/Pinyin and dead-key accents) inside a paragraph, list item, and table cell; selection handles; undo; paste rich text; typing at end of an atom node; Cmd+arrows; no caret jump on re-render; blank-caret regression (memory: WKWebView `::highlight` and blob quirks show WebKit surprises).
- Decision rule: TipTap unless a reproducible caret/IME blocker; record in `96-SPIKE-FINDINGS.md` (engine, blockers, API notes for 97/98, time spent, time-box).
- No `package.json` changes on main: install on the throwaway branch only, then delete the branch.

## Environment Availability
| Dependency | Needed | Available | Fallback |
|------------|--------|-----------|----------|
| node/npm/vitest | harness | yes (repo toolchain) | - |
| Jira DC + PAT | probe | not reachable non-interactively | user-run curl list above |
| Tauri dev (rust toolchain) | spike | not probed | user machine, human checkpoint |
| slopcheck | package audit | not run | human-verify gate on `npm install` |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 (jsdom default; use `@vitest-environment node` per file) |
| Config | `taskflow/vitest.config.ts` (existing; no changes needed) |
| Quick run | `cd taskflow && npx vitest run src/lib/wiki src/routes/dashboard/WikiRenderer.test.tsx` |
| Full suite | `cd taskflow && npm run test` (also runs in pre-commit with `tsc --noEmit`, `biome check --staged`) |

### Phase Requirements to Test Map
| Req | Behavior | Type | Command | Exists |
|-----|----------|------|---------|--------|
| SAFE-01 | WikiRenderer output unchanged | existing unit (2702 lines, unmodified) | `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` | yes |
| SAFE-01 | lib/wiki exports preprocess/wikiToMarkdown/plugins/wikiToHtml, loads in node with no React | unit | `npx vitest run src/lib/wiki/pipeline.test.ts` | Wave 0 |
| SAFE-01 | wikiToHtml matches Markdown-rendered core output for seed inputs (smoke: a few fixtures, compare to `renderToStaticMarkup` of `<Markdown>` with the same plugins, no components) | unit | same | Wave 0 |
| SAFE-02 | corpus covers every D-09 construct (required-file list) | unit | `npx vitest run src/lib/wiki/corpus-coverage.test.ts` | Wave 0 |
| SAFE-02 | identity round-trip equivalent across corpus | unit | `npx vitest run src/lib/wiki/equivalence.test.ts` | Wave 0 |
| SAFE-02 | mutation self-tests reported as failures; CRLF fixture retains `\r\n` | unit | same | Wave 0 |
| SAFE-02 | normaliser rules (attr order, whitespace outside `<pre>`, `<pre>` sensitive) | unit | `npx vitest run src/lib/wiki/normalize.test.ts` | Wave 0 |

### Sampling Rate
- Per task commit: quick run above. Per wave: full suite. Phase gate: full suite + `tsc --noEmit` + biome staged green.
- Extraction plan gate: WikiRenderer.test.tsx green with `git diff` showing the test file untouched.

### Wave 0 Gaps
- [ ] `src/lib/wiki/*.test.ts` files listed above
- [ ] `__fixtures__/` corpus and `.gitattributes`
- [ ] `npm install rehype-stringify` (+ direct unified/remark-parse/remark-rehype)

## Security Domain
| ASVS | Applies | Control |
|------|---------|---------|
| V5 Input validation / output encoding | yes | `rehype-sanitize` with `wikiSanitizeSchema` stays in the core pipeline (T-54-07-01 XSS guard test in existing suite); `wikiToHtml` output must never be injected via `dangerouslySetInnerHTML` (it is for comparison only) |
| V2/V3/V4/V6 | no | no auth/session/crypto in this phase |

Threats: script/iframe injection via raw HTML (sanitize after raw, order preserved by shared plugin builder); customer-data leakage into fixtures (D-10; review step: grep fixtures for real hostnames/names); PAT leakage during the probe (never commit, never paste responses).

## Assumptions Log
| # | Claim | Section | Risk |
|---|-------|---------|------|
| A1 | `rehype-stringify`, `unified`, etc. are safe to add (slopcheck not run) | Stack | low; well-known unified packages, gate with human-verify |
| A2 | `/rest/api/1.0/render` is the DC render endpoint | Probe | probe may need `expand=renderedFields` fallback |
| A3 | DC uses `[~username]` mentions | Probe | app handles both anyway |
| A4 | hast property insertion order + sort suffices for attribute normalisation | Normaliser | add rule with fixture if not |
| A5 | tsconfig includes `vite/client` types for `import.meta.glob` | Fixtures | add reference directive |

## Open Questions
1. **Live Jira probe not run** (credentials only in Stronghold, interactive). Recommendation: user runs the curl block, reports grammar surprises as text; planner schedules a `checkpoint:human-action` plan or leaves it as non-blocking; harness does not depend on it.
2. **Emoticon mutation choice**: CONTEXT's "emoji spelling" mutation is render-equivalent and would not be flagged. Recommend the planner use drop/rename mutations and carry the byte-level concern (SAFE-03) to Phase 97.
3. **Direct vs transitive dependency declarations** for `unified`/`remark-parse`/`remark-rehype`: recommend declaring directly (they are imported by app code).
4. **Whether the Phase 97 runtime guard needs `rehype-stringify` in the production bundle**; yes if `isEquivalent` renders HTML, so keep it a regular dep.

## Sources
- Repo: `taskflow/src/routes/dashboard/WikiRenderer.tsx` (L1-135, 230, 478-520, 680, 1199-1230, 1306-1340, 1511-1540, 1781-1799), `WikiRenderer.test.tsx` L1-10, 1397-1405; `vitest.config.ts`; `package.json`; `.husky/pre-commit`; `src/services/jira.ts` L82 [VERIFIED]
- `node_modules/react-markdown/lib/index.js` L123, 262-275 (processor chain, `allowDangerousHtml`) [VERIFIED]
- npm registry: rehype-stringify 10.0.1, rehype-parse 9.0.1, hast-util-to-html 9.0.6, @tiptap/core 3.34.0, @codemirror/view 6.43.15 [VERIFIED: npm view]
- `.planning/research/ARCHITECTURE.md` (plugin split) [secondary]

## Metadata
**Confidence:** stack HIGH, pipeline anatomy HIGH, harness design MEDIUM-HIGH, Jira probe LOW (not run), spike plan MEDIUM
**Research date:** 2026-11-16; **Valid until:** ~30 days
