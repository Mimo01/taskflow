# Phase 96: Wiki Foundations & Equivalence Harness - Pattern Map

**Mapped:** 2026-11-16
**Files analyzed:** 16 new/modified (+ spike findings doc, no code)
**Analogs found:** 14 / 16

All paths below are relative to the inner app dir `taskflow/` (git and `.planning/` live at the outer root). Line numbers refer to `src/routes/dashboard/WikiRenderer.tsx` unless stated.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/wiki/preprocess.ts` (new, MOVE of L86-L1197 pure helpers) | utility | transform | `WikiRenderer.tsx` L86-L1197 itself (relocation); header style of `src/lib/attachment-markup.ts` | exact (move) |
| `src/lib/wiki/pipeline.ts` (new, MOVE of schema, decode plugin, fixMarkdownLinkUnderscores + NEW wikiToMarkdown/wikiToHtml/plugin builder) | utility | transform | `WikiRenderer.tsx` L45-L84, L1199-L1230, L1283-L1325, L1525-L1539, L1781-L1793 | exact (move) + role-match for new fns |
| `src/lib/wiki/equivalence.ts` (new: normaliser, isEquivalent, diff formatter) | utility | transform | `rehypeDecodeInlineCodeEntities` (hast-visit idiom); `src/routes/dashboard/issue-detail/changelogDiff.ts` (`diff` package use) | role-match |
| `src/lib/wiki/index.ts` (new barrel) | utility | n/a | none (no `lib/*/index.ts` barrel verified); `src/lib/release-notes/` dir is the only lib subfolder | partial |
| `src/routes/dashboard/WikiRenderer.tsx` (modified: delete moved code, import + re-export) | component | request-response | itself | exact |
| `src/lib/wiki/pipeline.test.ts` (new) | test | transform | `src/lib/attachment-markup.test.ts` | role-match |
| `src/lib/wiki/normalize.test.ts` (new) | test | transform | `src/lib/attachment-markup.test.ts` | role-match |
| `src/lib/wiki/equivalence.test.ts` (new, node env, glob corpus, mutation self-tests) | test | batch | `src/routes/dashboard/widget-removal.guard.test.ts` (fs-based, node) | partial |
| `src/lib/wiki/corpus-coverage.test.ts` (new) | test | file-I/O | `src/routes/dashboard/widget-removal.guard.test.ts` | role-match |
| `src/lib/wiki/__fixtures__/<construct>/*.wiki` (new) | config (test data) | file-I/O | inputs in `src/routes/dashboard/WikiRenderer.test.tsx` (seed source) | partial |
| `.gitattributes` (new, at outer git root) | config | n/a | none (no `.gitattributes` exists) | none |
| `package.json` (add unified, remark-parse, remark-rehype, rehype-stringify) | config | n/a | existing deps block | exact |
| `.planning/phases/96-.../96-SPIKE-FINDINGS.md` (new, doc) | doc | n/a | none | none |
| `src/routes/dashboard/WikiRenderer.test.tsx` | test | n/a | MUST stay unmodified | n/a |

## Pattern Assignments

### `src/lib/wiki/preprocess.ts` (utility, transform)

**Analog:** the code being moved (WikiRenderer.tsx L86-L1197). Plan = pure relocation, no body edits; verify with `git diff --color-moved`.

**Move set** (exported today unless noted): `AttachmentMap`/`UserMap` types (L86, L89), `splitInlineSingleLineTables` (L136), `PANEL_TAG_RE` (L230), `transformPanelListItems` (L252), `flattenInlineCalloutsForTableRow` (L283), `mergeOpenTableRows` (L329), `countJiraTableRowColumns` (L390), `injectHeaderlessTableSeparators` (L422), `JIRA_EMOTICON_MAP` (L478), `replaceJiraEmoticons` (L504), `convertInlineBoldItalic` (L559), `normalizeTableCellInlineFormatting` (L611), `preprocessJiraMarkup` (L680).

**Pure-lib header convention** (`src/lib/attachment-markup.ts` L1-8): file-level JSDoc saying "Pure string logic — no React imports", then `import type { ... } from '@/services/jira'` style (type-only imports with `@/` alias). `lib/wiki/*` must have ZERO React/Tauri/zustand imports (loads in node).

**Control-character biome comments must travel with regexes** (L1223, L1535):
```typescript
// biome-ignore lint/suspicious/noControlCharactersInRegex: \x00 (null byte) is the same sentinel inserted by preprocessJiraMarkup — cannot appear in real content
result = result.replace(/\x00USCORE\x00/g, '_');
```
Pre-commit runs `biome check --staged` + `tsc --noEmit` + full vitest, so a dropped comment blocks the commit.

**Shared `/g` regex hazard:** `PANEL_TAG_RE` and `JIRA_EMOTICON_MAP` entries are `/g`; only used via `String.match`/`String.replace` (safe). Never call `.test()`/`.exec()` on them in new code.

---

### `src/lib/wiki/pipeline.ts` (utility, transform)

**Analog:** WikiRenderer.tsx (move + extract inline component expression).

**Imports pattern** (L1-L2, L13-L18 of WikiRenderer.tsx; `@ts-expect-error` must be preserved on jira2md):
```typescript
// @ts-expect-error — jira2md has no default export type declarations
import j2m from 'jira2md';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
```
(`SKIP` is only used by `rehypeIssueKeys`, which stays in the component.) New imports: `unified`, `remark-parse`, `remark-rehype`, `rehype-stringify`.

**Moves verbatim:** `wikiSanitizeSchema` (L45-L84; keep `issuekeylink` allowlisted, do not mutate, shared by reference), `fixMarkdownLinkUnderscores` (L1199-~L1230, private -> export), `HastText`/`HastElement` types (L1285-L1291), `rehypeDecodeInlineCodeEntities` (L1306-L1325):
```typescript
function rehypeDecodeInlineCodeEntities() {
  return (tree: HastElement) => {
    visit(tree, 'element',
      (node: HastElement, _index: number | undefined, parent: HastElement | undefined) => {
        if (node.tagName !== 'code' || parent?.tagName === 'pre') return;
        for (const child of node.children) { /* decode &lt; &gt; &#43; &#33; &amp; (amp last) */ }
      });
  };
}
```

**New `wikiToMarkdown`: lift the inline component expression** (L1525-L1539) unchanged in behaviour:
```typescript
const { text: preprocessed, codeBlockBodies } = wikiText
  ? preprocessJiraMarkup(wikiText, attachments, users)
  : { text: '', codeBlockBodies: [] };
const markdown = preprocessed
  ? fixMarkdownLinkUnderscores(j2m.to_markdown(preprocessed)).replace(
      // biome-ignore lint/suspicious/noControlCharactersInRegex: \x00 (null byte) sentinel, see preprocessJiraMarkup
      /\x00CODEBODY(\d+)\x00/g,
      (_, i) => codeBlockBodies[Number.parseInt(i, 10)],   // keep FUNCTION form (no $& interpretation)
    )
  : '';
```
Keep the empty/falsy guard (`''` out).

**Plugin builder = single source of truth for order** (current order at L1781-L1793: raw -> issueKeys -> decode -> sanitize):
```typescript
export const wikiRemarkPlugins = [remarkGfm, remarkBreaks];
export function wikiRehypePlugins(presentation: PluggableList = []) {
  return [rehypeRaw, ...presentation, rehypeDecodeInlineCodeEntities, [rehypeSanitize, wikiSanitizeSchema]];
}
// WikiRenderer: <Markdown remarkPlugins={wikiRemarkPlugins} rehypePlugins={wikiRehypePlugins([rehypeIssueKeys(activeJiraProject)])} components={...}>
// wikiToHtml:   wikiRehypePlugins([])
```
Sanitize MUST stay after raw (T-54-07-01 XSS guard); `rehypeIssueKeys` sits between raw and decode and its `issuekeylink` must survive sanitize.

**New `wikiToHtml`** mirrors react-markdown 10.1.0 `createProcessor`:
```typescript
String(unified().use(remarkParse).use(wikiRemarkPlugins).use(remarkRehype, { allowDangerousHtml: true })
  .use(wikiRehypePlugins([])).use(rehypeStringify).processSync(md))
```

**React Compiler note:** all functions pure; no module-level mutable state, no `let` at module scope.

---

### `src/lib/wiki/equivalence.ts` (utility, transform)

**Analog 1 (hast visit idiom):** `rehypeDecodeInlineCodeEntities` above. Normaliser is a tiny rehype plugin `rehypeNormalizeForCompare` (sort `node.properties` keys; collapse `/\s+/g` -> `' '` in text nodes with no `pre` ancestor), run before `rehypeStringify` so no `rehype-parse` is needed. Each extra rule gets a comment naming its justifying fixture (D-06).

**Analog 2 (`diff` package already a direct dep):** `src/routes/dashboard/issue-detail/changelogDiff.ts` L7:
```typescript
import { diffWords } from 'diff';
```
Use `createTwoFilesPatch` from the same package for D-08 output. Also import types as `import type {...}` and use `@/` aliases.

`isEquivalent(a, b)` compares `wikiToNormalizedHtml(a)` vs `wikiToNormalizedHtml(b)` (renderings of two wiki strings).

---

### `src/lib/wiki/index.ts` (barrel)

No barrel precedent found in `src/lib`. Keep it a plain `export * from './preprocess'; export * from './pipeline'; export * from './equivalence';` (biome import/export ordering applies; do not run `biome --write` over all of src).

---

### `src/routes/dashboard/WikiRenderer.tsx` (modified)

Delete moved code; add re-exports so ~24 importers and the unmodified test keep working. The test imports (WikiRenderer.test.tsx L4-L10):
```typescript
import {
  injectHeaderlessTableSeparators,
  JIRA_EMOTICON_MAP,
  mergeOpenTableRows,
  splitInlineSingleLineTables,
  WikiRenderer,
} from './WikiRenderer';
```
Add:
```typescript
export {
  injectHeaderlessTableSeparators, JIRA_EMOTICON_MAP, mergeOpenTableRows,
  preprocessJiraMarkup, splitInlineSingleLineTables,
  type AttachmentMap, type UserMap,
} from '@/lib/wiki';
```
Before editing run `grep -rn "WikiRenderer'" src` to confirm no importer takes another named symbol. Presentation stays here: `rehypeIssueKeys` (L1344), `IssueKeyLink`, `calloutStyles`, `OlDepthContext`/`OlRenderer`, `markdownComponents`, lightbox, `deriveSourceCrumb`. Remove now-unused imports (j2m, rehypeRaw, rehypeSanitize, defaultSchema, remarkBreaks/Gfm if replaced) so biome/tsc stay clean.

---

### `src/lib/wiki/*.test.ts` (test)

**Analog:** `src/lib/attachment-markup.test.ts` (L1-L20): vitest imports, relative import of the module, `describe`/`it`, small factory helper.
```typescript
import { describe, expect, it } from 'vitest';
import { attachmentRef } from './attachment-markup';
```

**Node-environment + fs analog:** `src/routes/dashboard/widget-removal.guard.test.ts` L10-L17 (node `fs`/`path`, `__dirname`):
```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const DASHBOARD_DIR = path.resolve(__dirname);
```
That file explicitly avoids `import.meta.glob` ("evaluated at build time") but no other src file uses it either, so there is no glob precedent. CONTEXT D-12 locks `import.meta.glob(..., { query: '?raw', import: 'default', eager: true })`; `src/vite-env.d.ts` already has `/// <reference types="vite/client" />`, so tsc typing for glob is fine (resolves research assumption A5). Fallback if glob misbehaves in vitest: `fs.readdirSync` + `readFileSync(..., 'utf8')`.

Global vitest env is jsdom (`vitest.config.ts`, setup `./src/test/setup.ts`); add `// @vitest-environment node` docblock on the first line of harness files. No `@vitest-environment` use exists elsewhere, so this is a new (documented vitest) convention.

**Harness shape** (from RESEARCH, implement as-is): `checkCorpus(roundTrip)` returns `{path, diff, emitted}[]`; identity test expects `[]` with a formatted message; mutation tests assert `failures.length > 0` and `failures.map(f => f.path)` contains a named fixture. Use `replaceAll('(/)', 'OK')` (drop/rename, NOT emoji spelling, which is render-equivalent because `JIRA_EMOTICON_MAP` converts `(/)` to emoji pre-render) and a nested-list flatten `s.replace(/^\*\*\s/gm, '* ')`. Also assert the CRLF fixture contains `\r\n` and trailing-whitespace fixture retains it.

---

### `src/lib/wiki/__fixtures__/<construct>/*.wiki`

Seed inputs from `WikiRenderer.test.tsx` (real regressions already placeholder text); e.g. emoticon block at L1385+ and the describe blocks for tables, panels, tt, mentions. Folders by construct: `lists/`, `tables/`, `panels/`, `code/`, `emoticons/`, `mentions/`, `escapes/`, `attachments/`, `whitespace/` (CRLF, trailing ws), `macros/` (unknown, `{color}`, `{noformat}`), `monospace/` (`{{ ` plain vs nbsp, `{{{}TT{}}}`). Placeholder-only text (D-10). Write CRLF files byte-exactly (printf via Bash is acceptable for that fixture only, not an editor).

---

### `.gitattributes` (config)

No analog (none exists). Placed at the outer git root, path-relative to it:
```
taskflow/src/lib/wiki/__fixtures__/** -text
```

### `package.json`

Add `unified`, `remark-parse`, `remark-rehype`, `rehype-stringify` as regular deps (already transitively installed except rehype-stringify). Gate install with a human-verify step (slopcheck not run). `diff` ^9 already direct.

## Shared Patterns

### Pure, React-free lib module
**Source:** `src/lib/attachment-markup.ts` L1-L8
**Apply to:** all `src/lib/wiki/*.ts`: no React, Tauri, zustand or store imports; no module-level mutable state (React Compiler runs in the app, not vitest).

### Control-char regex lint suppressions
**Source:** WikiRenderer.tsx L1223, L1535
**Apply to:** every moved/new regex containing `\x00`.

### Pre-commit gate
**Source:** `taskflow/.husky/pre-commit`: `biome check --staged --no-errors-on-unmatched ./src`, `tsc --noEmit`, `npm run test` (one per line). A deliberately failing mutation must be asserted, never allowed to fail the suite. Combine RED/GREEN per task into one commit. If a hook fails, commit with explicit paths (`commit -- paths`) to avoid sweeping staged files.

### Sequencing
Extraction plan = relocation only, `WikiRenderer.test.tsx` untouched and green before/after; harness, corpus, dependency add, spike are separate plans/commits.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.gitattributes` | config | n/a | none in repo |
| `src/lib/wiki/index.ts` | barrel | n/a | no lib barrel precedent |
| `import.meta.glob` corpus loader | test | file-I/O | no glob precedent (fs approach used in `widget-removal.guard.test.ts`) |
| `96-SPIKE-FINDINGS.md` + spike prototypes | doc / spike | n/a | throwaway branch; no editor deps on main (D-03) |
| Live Jira probe | research | n/a | credentials only in Stronghold; user-run curl block in RESEARCH |

## Metadata

**Analog search scope:** `src/lib/`, `src/routes/dashboard/` (WikiRenderer, tests, issue-detail/changelogDiff), `src/vite-env.d.ts`, `vitest.config.ts`, `.husky/pre-commit`
**Files scanned:** about 12 read, grep over `src/` for glob/environment/diff usage
**Pattern extraction date:** 2026-11-16
