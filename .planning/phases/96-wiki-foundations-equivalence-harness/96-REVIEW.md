---
phase: 96-wiki-foundations-equivalence-harness
reviewed: 2026-11-16T13:55:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - .gitattributes
  - taskflow/package.json
  - taskflow/scripts/inject-version.cjs
  - taskflow/src/lib/wiki/corpus-coverage.test.ts
  - taskflow/src/lib/wiki/corpus.fixtures.ts
  - taskflow/src/lib/wiki/equivalence.test.ts
  - taskflow/src/lib/wiki/equivalence.ts
  - taskflow/src/lib/wiki/index.ts
  - taskflow/src/lib/wiki/normalize.test.ts
  - taskflow/src/lib/wiki/pipeline.test.tsx
  - taskflow/src/lib/wiki/pipeline.ts
  - taskflow/src/lib/wiki/preprocess.ts
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Phase 96: Code Review Report

**Reviewed:** 2026-11-16T13:55:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Scope: the new wiki pipeline (`wikiToMarkdown`, `wikiRehypePlugins`, `wikiMarkdownToHtml`, `wikiToHtml`), the equivalence harness, the corpus loader and tests, `.gitattributes`, and the version-tag selection in `inject-version.cjs`.

**The move preserved behaviour.** Every line removed from `WikiRenderer.tsx` reappears in `preprocess.ts` or `pipeline.ts`. The only differences are the new `export` keywords and the reshaped `markdown` and plugin-list expressions. The rehype order is still `rehypeRaw`, then presentation (`rehypeIssueKeys`), then `rehypeDecodeInlineCodeEntities`, then `[rehypeSanitize, wikiSanitizeSchema]`, which matches the old order. Sanitize is still last, and `rehypeIssueKeys` still sits between raw and sanitize. The remark list is still `[remarkGfm, remarkBreaks]`.

**Tests and probes.** All 72 tests in `src/lib/wiki` pass. I also ran temporary probe tests, then deleted them; the tree is unchanged. The probes confirmed three things:
- `normalizeHastForCompare` crashes on comment nodes.
- An input containing the `CODEBODY` sentinel renders the literal text `undefined`.
- `[Spec|^spec.pdf]` renders `href="%5Espec.pdf"`.

**Main concerns.**
- The equivalence API is meant to become the runtime guard for the editor (SAFE-05), but it is not exception-safe.
- The normaliser assumes every node that is not text has children.
- In CI, the version is the highest tag reachable from HEAD, not the tag being released.
- The purity guard has blind spots, including any `.tsx` file.

No blockers.

## Warnings

### WR-01: `checkCorpus` / `isEquivalent` throw when the oracle fails on the emitted wiki

**File:** `taskflow/src/lib/wiki/equivalence.ts:64-66, 100-101`
**Issue:** `checkCorpus` wraps only `roundTrip(wiki)` in try/catch. `wikiToNormalizedHtml(wiki)` and `wikiToNormalizedHtml(emitted)` run unguarded. If the emitted text makes preprocess, jira2md or unified throw, the whole corpus run aborts with one stack trace. You lose the per-fixture `CorpusFailure` report, and the failures from other fixtures are discarded. `isEquivalent` is documented as the future runtime guard for rich mode (SAFE-05) and has no guard at all, so a pathological emit would crash the editor path rather than refusing the switch.
**Fix:**
```ts
let before: string, after: string;
try {
  before = wikiToNormalizedHtml(wiki, maps);
  after = wikiToNormalizedHtml(emitted, maps);
} catch (err) {
  failures.push({ path, diff: `oracle threw: ${err instanceof Error ? err.message : String(err)}`, emitted });
  continue;
}
```
For `isEquivalent`, catch the error and return `false` (fail closed).

### WR-02: `normalizeHastForCompare` crashes on comment, doctype or raw nodes

**File:** `taskflow/src/lib/wiki/equivalence.ts:20-42`
**Issue:** `walk` treats every node that is not text as a parent and runs `for (const child of node.children)`. A hast `comment`, `doctype` or `raw` node has no `children`. Probing with `{type:'root', children:[{type:'comment', value:'x'}]}` throws `TypeError: node.children is not iterable`. Inside `wikiToNormalizedHtml` it is safe only by accident: it runs after sanitize, and sanitize strips comments because `allowComments` defaults to false. But `normalizeHastForCompare` and `rehypeNormalizeForCompare` are exported through the barrel as general helpers. The local `HastNode` type (text or element only) hides the gap from tsc.
**Fix:**
```ts
if (node.type === 'text') { ...; return; }
if (!('children' in node) || !Array.isArray(node.children)) return;
```

### WR-03: In CI, the version comes from the highest reachable tag, not the tag being released

**File:** `taskflow/scripts/inject-version.cjs:13-21`
**Issue:** The new logic fixes the "milestone tag nearer than release tag" case. But on a release tag build (`release-cross-platform.yml:131`), the version is now whatever tag is numerically highest among HEAD's ancestors, rather than the tag CI was triggered by. Three cases go wrong:
1. **Milestone tag ahead of releases.** A milestone tag `vX.(Y+1)` can be created before patch releases on `X.Y` stop. Then a `vX.Y.Z` tag push builds and publishes artifacts stamped `X.(Y+1).0`. Milestone and release tags are separate (milestone `v1.13` preceded release `v1.13.0`). Mis-stamped artifacts break `latest.json` and updater comparisons.
2. **Pre-release tags.** The filter `^v\d+(\.\d+){0,2}$` drops tags such as `v1.15.0-rc1`. Building that tag stamps the previous release's version.
3. **Silent fallback.** Any git failure falls back to `0.0.0-dev` silently, including in CI.

**Fix:** Prefer an exact release tag on HEAD. Fall back to the highest reachable tag only when there is none:
```js
const exact = execSync('git tag --points-at HEAD --list "v[0-9]*.[0-9]*.[0-9]*"', { encoding: 'utf8' })
  .split('\n').map((t) => t.trim()).filter((t) => /^v\d+\.\d+\.\d+$/.test(t));
// if exact.length, use the highest of `exact`; else current highest-reachable logic
```
Also fail the build, instead of falling back to `0.0.0-dev`, when `process.env.CI` is set.

### WR-04: The purity guard misses `.tsx` files, subdirectories and some import forms

**File:** `taskflow/src/lib/wiki/pipeline.test.tsx:72-83`
**Issue:** The guard is supposed to keep `lib/wiki` free of React, Tauri and store imports, but it has several gaps:
- **`.tsx` files.** It checks only `f.endsWith('.ts')`, and a `.tsx` file is the most likely place for a React import to appear.
- **Subdirectories.** It reads only the top-level directory (no recursion), so a future `lib/wiki/editor/` folder would be skipped.
- **Import forms.** The regex matches only `from '…'`. It misses side-effect imports (`import 'react'`), dynamic `import('…')` and `require('…')`.

`corpus.fixtures.ts` is excluded entirely, even though it already imports from `@/routes/dashboard/WikiRenderer` (see IN-02).
**Fix:** Walk the directory recursively over `/\.(ts|tsx)$/`. Match `/(?:from\s+|import\s*\(?\s*|require\s*\()['"](react|…)/`. Stop excluding `corpus.fixtures.ts` once IN-02 is fixed.

### WR-05: The exported `wikiSanitizeSchema` is a mutable XSS allowlist reachable through the barrel

**File:** `taskflow/src/lib/wiki/pipeline.ts:35-73`, `taskflow/src/lib/wiki/index.ts:2`
**Issue:** Before the move, the schema was private to its module. It is now exported through `@/lib/wiki` with no consumer outside `pipeline.ts`. It is a plain object with mutable arrays, so any importer can widen the allowlist for every renderer in the process, for example with `wikiSanitizeSchema.tagNames.push('iframe')` or by mutating `attributes.a`. This is a single point of failure for T-54-07-01 that is now shared.
**Fix:** Drop the `export`, since nothing outside `pipeline.ts` uses it. If it must stay exported, deep-freeze it, for example `Object.freeze` on the schema, on `tagNames` and on each `attributes[*]` array.

### WR-06: `[text|^attachment]` renders a broken link, and the corpus now treats it as correct (pre-existing)

**File:** `taskflow/src/lib/wiki/preprocess.ts` (attachment link handling); fixture `attachments/file-link.wiki`
**Issue:** `See [^spec.pdf] and [Spec|^spec.pdf]`, rendered with `HARNESS_ATTACHMENTS`, produces a resolved chip for the first link. The second becomes `<a href="%5Espec.pdf">Spec</a>`, a relative link that goes nowhere. The renderer bug predates this phase. The new harness compares against this output as ground truth, so an editor that "fixes" the link would be reported as non-equivalent.
**Fix:** Resolve `[label|^file]` against the attachment map in preprocess, the same way `[^file]` is resolved (the chip with a custom label). Or add a comment to the fixture saying the output is a known defect, so the corpus doesn't freeze it in as correct.

## Info

### IN-01: Content containing the `CODEBODY` sentinel renders the text "undefined" (pre-existing)

**File:** `taskflow/src/lib/wiki/pipeline.ts:193-197`
**Issue:** The input `'a\x00CODEBODY5\x00b'` renders `<p>aundefinedb</p>`, because `codeBlockBodies[5]` is undefined. NUL bytes in Jira text are unlikely, so the impact is low.
**Fix:** Return `codeBlockBodies[n] ?? match`, or strip `\x00` from the input at the start of `preprocessJiraMarkup`.

### IN-02: `corpus.fixtures.ts` imports its types from a route module

**File:** `taskflow/src/lib/wiki/corpus.fixtures.ts:1`
**Issue:** `import type { AttachmentMap, UserMap } from '@/routes/dashboard/WikiRenderer'` makes `lib/wiki` depend on `routes`, and the route re-exports those types from `lib/wiki` anyway. It is type-only, so nothing breaks today. It is also the reason this file has to be excluded from the purity guard.
**Fix:** `import type { AttachmentMap, UserMap } from './preprocess';`

### IN-03: Stale cross-references in moved comments

**File:** `taskflow/src/lib/wiki/preprocess.ts:920, 1025, 1040, 1048`
**Issue:** These comments point to `wikiSanitizeSchema, line ~64` and to `fixMarkdownLinkUnderscores` as "below". Both now live in `pipeline.ts`.
**Fix:** Change the references to `pipeline.ts`.

### IN-04: The nbsp assertion uses an invisible literal

**File:** `taskflow/src/lib/wiki/corpus-coverage.test.ts:80`
**Issue:** `toContain('{{ ')` contains a raw U+00A0 that looks the same as the plain-space case. An editor or formatter could normalise it to a plain space. The test would then still pass, because `nbsp.wiki` also contains `{{ x}}` with a plain space, and the guard would silently stop checking anything.
**Fix:** Use `toContain('{{\u00a0')`.

### IN-05: The test that the list has exactly 37 fixtures can't fail usefully

**File:** `taskflow/src/lib/wiki/corpus-coverage.test.ts:56-58`
**Issue:** It checks the length of a hard-coded `as const` array, so it only fails when someone edits the array itself. The emoticon negative control (`equivalence.test.ts:81`) picks its target with `re.source.includes('/')`, which silently depends on map order.
**Fix:** Drop the length test, or assert `WIKI_CORPUS.length >= REQUIRED_FIXTURES.length`. Look up the emoticon explicitly with `re.source === '\\(\\/\\)'`.

### IN-06: `wikiMarkdownToHtml`'s `finalRehype` runs after sanitize and is publicly exported

**File:** `taskflow/src/lib/wiki/pipeline.ts:230-239`
**Issue:** The doc comment forbids using it to bypass sanitize, but the barrel exposes a sanitize-bypassing extension point, plus a function that returns an HTML string. Today the only caller is the normaliser.
**Fix:** Keep `finalRehype` internal: either export a `wikiMarkdownToNormalizedHtml` wrapper from `equivalence.ts` only, or restrict the parameter to the compare plugin.

---

_Reviewed: 2026-11-16T13:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
