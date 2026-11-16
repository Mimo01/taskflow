# Phase 97: Round-Trip Engine - Pattern Map

**Mapped:** 2026-11-16
**Files analyzed:** 27 new/modified (renderer fixes, editor module, tests, fixtures)
**Analogs found:** 21 / 27 (parser, emitter, schema and escape modules have no code analog; they use RESEARCH.md Patterns 1-4)

All paths below are relative to the inner app dir `/Users/mimo/Documents/Projects/taskflow/taskflow/` unless prefixed `.planning`. `@tiptap/*` is not yet in `package.json` (verified by grep).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/wiki/preprocess.ts` (add `convertMixedListMarkers`, D-01) | utility | transform | same file: `normalizeTableCellInlineFormatting`, `^-{4,}$` rewrite (L~770) | exact |
| `src/lib/wiki/preprocess.ts` (`injectHeaderlessTableSeparators` marker, D-02) | utility | transform | same file L334-L382 | exact |
| `src/lib/wiki/preprocess.ts` (panel family `{tip}`, `{info:title=}`, `{warning:title=}`, lists in panels, D-12) | utility | transform | same file L936-L954 (panel/info/warning/note regexes) + L142-L236 (`flattenInlineCallouts`) | exact |
| `src/lib/wiki/pipeline.ts` (`rehypeDropHeaderlessThead`, `wikiToMarkdown` sentinel restore) | utility | transform | `rehypeDecodeInlineCodeEntities` L155-L177 and `wikiToMarkdown` L184-L200 | exact |
| `src/routes/dashboard/WikiRenderer.tsx` (only if D-12 needs `tip` in `calloutStyles` or title handling) | component | request-response | same file `calloutStyles` L256, `div`/`span` overrides L354-L390 | exact |
| `src/routes/dashboard/WikiRenderer.test.tsx` (D-01/D-02/D-12 tests; edit L984-L1110 only) | test | request-response | same file headerless block L984-L1110 | exact |
| `src/lib/wiki/pipeline.test.tsx` (parity over corpus, new expectations) | test | batch | same file | exact |
| `src/lib/wiki/__fixtures__/lists/mixed-nesting.wiki` + new `lists/*`, `tables/*`, `panels/*`, `macros/*`, `images/*`, `whitespace/*`, `inline/*`, `escapes/*` fixtures | fixture | file-I/O | `__fixtures__/lists/mixed-nesting.wiki`, `panels/panel-list-items.wiki` | exact |
| `src/lib/wiki/corpus-coverage.test.ts` (extend `REQUIRED_FIXTURES`, bump 37) | test | batch | same file | exact |
| `src/lib/wiki/preprocess.ts` (export `JIRA_EMOTICON_TOKENS` next to `JIRA_EMOTICON_MAP`) | utility | transform | `JIRA_EMOTICON_MAP` L390 | exact |
| `src/lib/wiki/editor/schema.ts` | config | transform | none in repo (RESEARCH "Schema at module scope") | no analog |
| `src/lib/wiki/editor/parse/{blocks,inline,macros,tables,lists}.ts` | service | transform | `preprocess.ts` line scanners (`injectHeaderlessTableSeparators`, `countJiraTableRowColumns`, CODEBODY segmenter) | role-match |
| `src/lib/wiki/editor/emit.ts` | service | transform | none (RESEARCH Pattern 1) | no analog |
| `src/lib/wiki/editor/escape.ts` | utility | transform | none; `preprocess.ts` neutralisers (`\x00USCORE\x00`, `&#43;`) are partial | no analog |
| `src/lib/wiki/editor/engine.ts` | service | request-response | `equivalence.ts` (`isEquivalent`, `checkCorpus` fail-closed try/catch) | role-match |
| `src/lib/wiki/editor/index.ts` | config (barrel) | n/a | `src/lib/wiki/index.ts` | role-match |
| `src/lib/wiki/editor/roundtrip.test.ts` | test | batch | `equivalence.test.ts` | exact |
| `src/lib/wiki/editor/{engine,ladder,raw,spelling,edit}.test.ts` | test | transform | `equivalence.test.ts` mutation self-tests, `normalize.test.ts` | role-match |
| `src/lib/wiki/editor/lossless.fuzz.test.ts` | test | batch | none (seeded PRNG, small) | no analog |
| `src/lib/wiki/editor/bundle-guard.test.ts` | test | file-I/O | `corpus-coverage.test.ts` (node fs reads, mutation-style) | partial |
| `src/lib/wiki/equivalence.ts` (optional normaliser rule) | utility | transform | same file `walk` L27-L50 | exact |
| `package.json` (4 `@tiptap` deps) | config | n/a | existing `dependencies` | n/a |

## Pattern Assignments

### `src/lib/wiki/preprocess.ts` - D-01 `convertMixedListMarkers` (utility, transform)

**Analog:** same file, line-based `String.replace(/.../gm)` normalisers, e.g. the numeric/alpha/roman prefix block (L~800-L820) and the biome-ignore for `\x00` (L519).

**Placement:** immediately BEFORE `normalizeTableCellInlineFormatting(result)` call (after the `^-{4,}$` rewrite), because the `^[ \t]*\d+\.\s+` rule below it rewrites `1.` back to `# `.

**Regex-per-line replace convention to copy** (preprocess.ts ~L802):
```typescript
result = result.replace(/^[ \t]*(x{0,3}(?:ix|iv|v?i{0,3}))\.\s+/gm, (_m: string, num: string) =>
  num ? '### ' : _m,
);
```
**Sentinel convention** (preprocess.ts L644, with the biome-ignore from pipeline.ts L192):
```typescript
return `${open}${leadingNewline}\x00CODEBODY${idx}\x00${close}`;
// biome-ignore lint/suspicious/noControlCharactersInRegex: \x00 (null byte) sentinel, see preprocessJiraMarkup
/\x00CODEBODY(\d+)\x00/g,
```
New code: RESEARCH Pattern 6 (verbatim). Restore `\x00LI(\d+)([bo])\x00` in `wikiToMarkdown` right after the CODEBODY restore (pipeline.ts L192-L196). Add the biome-ignore comment on both regexes.

---

### `src/lib/wiki/preprocess.ts` - D-02 headerless marker (utility, transform)

**Analog:** `injectHeaderlessTableSeparators` itself (L334-L382). The only change is the synthetic header cells (L368-L370):
```typescript
const cols = countJiraTableRowColumns(trimmed);
if (cols >= 1) {
  const emptyCells = Array(cols).fill(' ').join('|');
  const sepCells = Array(cols).fill('---').join('|');
  out.push(`|${emptyCells}|`);
  out.push(`|${sepCells}|`);
}
```
Make the first cell `<span data-wiki-headerless></span>` (RESEARCH Pattern 7); keep column counting and line count unchanged so the four existing `injectHeaderlessTableSeparators` unit tests still pass.

**Matching rehype plugin** goes in `pipeline.ts`; copy the shape of `rehypeDecodeInlineCodeEntities` (L155-L177):
```typescript
function rehypeDecodeInlineCodeEntities() {
  return (tree: HastElement) => {
    visit(
      tree,
      'element',
      (node: HastElement, _index: number | undefined, parent: HastElement | undefined) => {
        if (node.tagName !== 'code' || parent?.tagName === 'pre') return;
        ...
```
Register it in `wikiRehypePlugins` (L213-L220) directly after `rehypeRaw`, before `...presentation` and sanitize. `wikiSanitizeSchema` (L35-L~100) must stay byte-unchanged; add a test asserting this (security boundary).
```typescript
return [
  rehypeRaw,
  /* rehypeDropHeaderlessThead goes here */
  ...presentation,
  rehypeDecodeInlineCodeEntities,
  [rehypeSanitize, wikiSanitizeSchema],
];
```
Note `HastElement.children` is typed `Array<HastText | HastElement>` (pipeline.ts L135-L140); use `parent.children.splice(index, 1)` and return `['skip', index]` per RESEARCH.

---

### `src/lib/wiki/preprocess.ts` - D-12 panel family (utility, transform)

**Analog:** panel conversion at L936-L954 (block) and L196-L236 (inline-in-table-cell). Existing form:
```typescript
result = result.replace(
  /\{panel:title=([^}]+)\}([\s\S]*?)\{panel\}/g,
  '<div data-callout="panel" data-title="$1">$2</div>',
);
result = result.replace(/\{panel\}([\s\S]*?)\{panel\}/g, '<div data-callout="panel">$1</div>');
result = result.replace(/\{info\}([\s\S]*?)\{info\}/g, '<div data-callout="info">$1</div>');
result = result.replace(
  /\{warning\}([\s\S]*?)\{warning\}/g,
  '<div data-callout="warning">$1</div>',
);
result = result.replace(/\{note\}([\s\S]*?)\{note\}/g, '<div data-callout="note">$1</div>');
```
Extend by copying the titled form to `info`/`note`/`warning`/`tip` (`\{info:title=([^}]+)\}`), and add `{tip}`. Render side: `WikiRenderer.tsx` `calloutStyles` L256 keys the allowed `data-callout` values (gate for new `tip`); `div` override L354-L366 already renders `data-title`. Do not touch `wikiSanitizeSchema` (`dataCallout`/`dataTitle` already allowed on div/span). For lists inside panels: the body is raw-inserted into a `<div>`, so markdown inside is not parsed as a list; the existing helper `transformPanelListItems` (L164) shows the in-cell approach; for block panels ensure blank lines surround the body (`'<div ...>\n\n$2\n\n</div>'`) so markdown parses inside the HTML block, then confirm with a corpus run. Inline `<span data-callout>` for table cells (L224-L236) needs the same `{tip}` and titled-form additions.
Update `panels/*.wiki` expectations via the harness; `pipeline.test.tsx` L9-L30 shows the `reactRender` parity helper.

---

### `src/routes/dashboard/WikiRenderer.test.tsx` (test, request-response)

**Analog:** same file L984-L1110, `describe('headerless table rendering')`. Imports header (L1-L10):
```typescript
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { injectHeaderlessTableSeparators, JIRA_EMOTICON_MAP, mergeOpenTableRows, splitInlineSingleLineTables, WikiRenderer } from './WikiRenderer';
```
Test shape to copy for new D-01/D-02/D-12 cases:
```typescript
const { container } = render(<WikiRenderer wikiText={fixture} />);
const table = container.querySelector('table');
expect(table).not.toBeNull();
expect(container.querySelectorAll('table').length).toBe(1);
const thead = table?.querySelector('thead');
```
New assertions: headerless -> `thead` is null, `tbody` rows only; genuine `|| ||` header keeps `thead`; `*#` -> `ul > li > ol`. Only edit assertions that expect the empty `<thead>` (D-03); `git diff` of this file must be limited to that.

---

### `src/lib/wiki/corpus-coverage.test.ts` (test, batch)

**Analog:** same file. Pattern: `REQUIRED_FIXTURES` array (L7-L45) + `expect(REQUIRED_FIXTURES).toHaveLength(37)` (L55) + placeholder guards (hosts `example.com`, mentions `jdoe`/`asmith`/`accountId:placeholder-0001`, L47-L48 and L83-L93). Add each new fixture path to the array and bump the length deliberately. New fixtures must pass the host/email/mention allowlist test. `.gitattributes` `-text` already covers `__fixtures__`.

---

### `src/lib/wiki/editor/roundtrip.test.ts` and sibling tests (test, batch)

**Analog:** `src/lib/wiki/equivalence.test.ts`.

**Imports + MAPS + corpus gate** (L8-L30):
```typescript
import { describe, expect, it } from 'vitest';
import { HARNESS_ATTACHMENTS, HARNESS_USERS, WIKI_CORPUS } from './corpus.fixtures';
import { checkCorpus, formatCorpusFailures } from './equivalence';

const MAPS = { attachments: HARNESS_ATTACHMENTS, users: HARNESS_USERS };
const wikiOf = (path: string): string => WIKI_CORPUS.find((f) => f.path === path)?.wiki ?? '';

it('identity round-trip is equivalent over the whole corpus', () => {
  const failures = checkCorpus(WIKI_CORPUS, (s) => s, MAPS);
  expect(failures, formatCorpusFailures(failures)).toEqual([]);
});
```
Swap `(s) => s` for `(s) => emitWiki(parseWiki(s).doc)`. Use `// @vitest-environment node` per file (vitest default is jsdom). Add `wikiSchema.nodeFromJSON(doc).check()`, idempotence, byte fidelity (`once === wiki` excluding trailing-ws fixtures), raw-verbatim and no-op checks (RESEARCH "Corpus run" example).

**Mutation-style self-tests** (L34-L66): target guard first, then assert failures are REPORTED so the suite stays green under pre-commit:
```typescript
it('emoticon dropped is reported', () => {
  const failures = checkCorpus(WIKI_CORPUS, (s) => s.split('(/)').join('OK'), MAPS);
  expect(failures.map((f) => f.path)).toEqual(expect.arrayContaining([...]));
});
```
Copy this for the ladder test (forced block mismatch -> `rich-demoted`, unfixable -> `failed`) and the bundle guard. The negative controls block (L73-L86) is the template for D-06/D-07 (CRLF->LF and emoji spelling are equivalence-neutral, but byte tests must catch them). Update the stale header comment in `equivalence.test.ts` (L1-L7) when adding the parse/emit corpus run there.

---

### `src/lib/wiki/editor/engine.ts` (service, request-response)

**Analog:** `src/lib/wiki/equivalence.ts` (L82-L132).

**Fail-closed pattern** (L86-L92):
```typescript
export function isEquivalent(a: string, b: string, maps?: EquivalenceMaps): boolean {
  try {
    return wikiToNormalizedHtml(a, maps) === wikiToNormalizedHtml(b, maps);
  } catch {
    return false;
  }
}
const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));
```
`loadWiki` must never throw: wrap parse, emit and `check()` in try/catch and return `{kind:'failed', reason: errorMessage(err)}`. Use `isEquivalent` and `EquivalenceMaps` from `../equivalence` (editor imports equivalence, never the reverse). Result union per RESEARCH Pattern 4. No React imports, no module-level mutable state (file header comment convention, equivalence.ts L6-L7).

---

### `src/lib/wiki/editor/parse/*.ts` (service, transform)

**Analog (role-match):** `preprocess.ts` line scanners. Copy the style: `split('\n')`, trim only `[ \t]+$`, bracket-aware pipe walk.

**Bracket-aware cell tokenising** (`countJiraTableRowColumns`, L300-L316):
```typescript
let depth = 0;
const trimmed = row.replace(/[ \t]+$/, '');
let pos = trimmed.startsWith('|') ? 1 : 0;
for (; pos < trimmed.length; pos++) {
  const ch = trimmed[pos];
  if (ch === '[') depth++;
  else if (ch === ']') depth--;
  else if (ch === '|' && depth === 0) cols++;
}
```
**Row classification** (L343-L356): `isDataRow = trimmed.startsWith('|') && !trimmed.startsWith('||')`; header row = starts with `||`. Per RESEARCH Pitfall 5 a row is a header row only if all cells use `||`; mixed rows -> raw.

**CRLF normalisation to copy** (preprocess.ts L600): `wiki.replace(/\r\n/g, '\n').replace(/\r/g, '\n')`, then record `eol` by majority (D-06).

**Code/noformat opener+closer matching the oracle** (L636): `/(\{code[^}]*\}|\{noformat\})([\s\S]*?)(\{code\}|\{noformat\})/g` (accepts either closer for either opener; the parser must treat mismatched pairs as raw, RESEARCH Pattern 3.2). Panel family regexes at L936-L954 define the opener/closer grammar the parser must match (same-name bare closer, non-greedy, may cross blank lines). Emoticon token order matters (`(*r)` before `(*)`): derive `JIRA_EMOTICON_TOKENS` from `JIRA_EMOTICON_MAP` (preprocess.ts L390) and test that they agree.

**Regex hygiene:** no module-scope `/g` with `.test`/`.exec` (use sticky per call, `matchAll`, `replace`); build tables once at module scope as frozen arrays (React Compiler rule).

**Attachment forms** (`src/lib/attachment-markup.ts` L37-L50): `!filename!`, `[^filename]`, `!<url>!`, `[name|url]` define the atoms; reuse `attachmentRef` for new-node emit, do not invent forms. D-08 canonical forms: `DescriptionEditor.tsx` toolbar L128-L155 (`*`..`*`, `_`..`_`, `{code}`..`{code}`, `* ` bullet) and `CommentComposer.tsx` L233 `const mention = \`[~${user.name}]\``.

---

### `src/lib/wiki/editor/schema.ts` (config, transform)

**No repo analog.** Use RESEARCH "Schema at module scope": `getSchema([...])` from `@tiptap/core`, `StarterKit.configure`, `Table.extend({ addAttributes })`, custom `Node.create` for `rawBlock`, `rawInline`, `panel`, `emoticon`, `mention`, `escape`, `image`, `attachment`; `Mark.create` for `color`, `sup`, `sub`, `cite`, `mono`. One global `gap` attr via `addGlobalAttributes`. Constants at module scope only. Do not add `@tiptap/extension-mention/image/subscript/superscript`.

---

### `src/lib/wiki/editor/index.ts` (barrel)

**Analog:** `src/lib/wiki/index.ts` (3 lines of `export * from`). Same style, but this barrel is public for Phase 98 only: `parseWiki, emitWiki, loadWiki, saveWiki, wikiSchema`. `src/lib/wiki/index.ts` must NOT gain an `./editor` line.

---

### `src/lib/wiki/editor/bundle-guard.test.ts` (test, file-I/O)

**Analog (partial):** `corpus-coverage.test.ts` for the test layout, and `pipeline.test.tsx` L1-L2 (`import fs from 'node:fs'; import path from 'node:path';`) for node fs/path use. Algorithm per RESEARCH Pattern 5 (BFS over static imports from `src/routes/dashboard/WikiRenderer.tsx`; `@/` -> `src/`; ignore `import type` and dynamic `import()`); add a synthetic-graph mutation test proving the guard bites. Also assert `src/lib/wiki/index.ts` text has no `editor`.

## Shared Patterns

### Oracle is the only equivalence check
**Source:** `src/lib/wiki/equivalence.ts` L58-L92 (`wikiToNormalizedHtml`, `isEquivalent`), L102-L132 (`checkCorpus`)
**Apply to:** engine, ladder, roundtrip tests. Never write a second comparison. Normaliser rules (`walk`, L27-L50) only grow with a fixture proving invisibility (Phase 96 D-06).

### Sanitize schema is a security boundary
**Source:** `src/lib/wiki/pipeline.ts` L35-L100 (`wikiSanitizeSchema`)
**Apply to:** D-02 and D-12 plans. Plugin order: `rehypeRaw` -> new drop plugin -> presentation -> decode -> sanitize. Add a test that the schema object is unchanged.

### Null-byte sentinels with biome-ignore
**Source:** `src/lib/wiki/pipeline.ts` L192-L196, `preprocess.ts` L519, L644
**Apply to:** D-01 sentinel (`\x00LI..\x00`).

### Module purity (React Compiler)
**Source:** `equivalence.ts` header L1-L7 ("No React imports, no module-level mutable state"), `corpus.fixtures.ts` L8-L18
**Apply to:** every `editor/` file. Constants at module scope, no cached mutable state, no `/g` regex `.test`.

### Placeholder-only fixtures
**Source:** `corpus-coverage.test.ts` L47-L48, L83-L93; `corpus.fixtures.ts` `HARNESS_USERS` / `HARNESS_ATTACHMENTS` (L24-L32)
**Apply to:** all new `.wiki` fixtures. Hosts `example.com`/`jira.example.com`/`example.org`; mentions `jdoe`/`asmith`/`accountId:placeholder-0001`; attachments `diagram.png`, `screenshot.png`, `spec.pdf`. Fixtures auto-load via `import.meta.glob('./__fixtures__/**/*.wiki')` (no registration), but must be added to `REQUIRED_FIXTURES`.

### Commit discipline
Pre-commit runs full vitest + tsc + biome. Combine RED/GREEN per TDD task in one commit; mutation tests assert failure is reported (never leave a red test).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/wiki/editor/schema.ts` | config | transform | No ProseMirror/TipTap code in repo (the 05-31 build was reverted); use RESEARCH schema example |
| `src/lib/wiki/editor/emit.ts` | service | transform | No doc-to-wiki emitter exists; RESEARCH Patterns 1-2 spelling-replay table |
| `src/lib/wiki/editor/escape.ts` | utility | transform | No table-driven escaping; RESEARCH Pitfall 3 and the `parse(emit(text)) == text` property |
| `src/lib/wiki/editor/lossless.fuzz.test.ts` | test | batch | No property tests; small seeded PRNG, no `fast-check` |
| `src/lib/wiki/editor/parse/*` (core grammar) | service | transform | Only partial analogs (preprocess scanners); the lossless tokenizer is new |
| `@tiptap` deps | config | n/a | New install, pinned `^3.34.0` in `dependencies` |

## Metadata

**Analog search scope:** `src/lib/wiki/`, `src/routes/dashboard/{WikiRenderer.tsx,WikiRenderer.test.tsx,DescriptionEditor.tsx,CommentComposer.tsx}`, `src/lib/attachment-markup.ts`
**Files scanned:** ~14 read (equivalence, corpus fixtures, coverage and equivalence tests, pipeline, large parts of preprocess, renderer excerpts, fixtures)
**Pattern extraction date:** 2026-11-16
