/**
 * The single wiki equivalence check, shared by the CI corpus harness and (later)
 * the editor's rich-mode guard (SAFE-05) (D-05). The oracle is the core pipeline
 * only: no rehypeIssueKeys and no React components (D-07). The normaliser is
 * minimal and every rule is a documented exception (D-06).
 * No React imports, no module-level mutable state.
 */
import { createTwoFilesPatch } from 'diff';
import type { Plugin } from 'unified';
import { type HastElement, type HastText, wikiMarkdownToHtml, wikiToMarkdown } from './pipeline';
import type { AttachmentMap, UserMap } from './preprocess';

type HastNode = HastText | HastElement;
type HastRoot = { type: 'root'; children: HastNode[] };

export type EquivalenceMaps = { attachments?: AttachmentMap; users?: UserMap };
export type CorpusFailure = { path: string; diff: string; emitted: string };
export type RoundTrip = (wiki: string) => string;

function walk(node: HastRoot | HastNode, insidePre: boolean): void {
  if (node.type === 'text') {
    if (!insidePre) {
      // D-06 rule 2 — HTML collapses ASCII whitespace outside <pre>; nbsp
      // deliberately excluded (JS \s would match U+00A0); normalize.test.ts 'whitespace'.
      node.value = node.value.replace(/[ \t\n\f\r]+/g, ' ');
    }
    return;
  }
  let pre = insidePre;
  if (node.type === 'element') {
    pre = insidePre || node.tagName === 'pre';
    if (node.properties) {
      // D-06 rule 1 — attribute order is invisible to users; normalize.test.ts 'attribute order'.
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(node.properties).sort((a, b) => a.localeCompare(b))) {
        sorted[key] = node.properties[key];
      }
      node.properties = sorted;
    }
  }
  for (const child of node.children) walk(child, pre);
}

/**
 * Mutates the tree in place. Further rules (tight/loose li>p, br vs newline,
 * entity forms, empty text nodes) may only be added with a fixture proving
 * the difference is invisible to users.
 */
export function normalizeHastForCompare(tree: HastRoot | HastElement): void {
  walk(tree, false);
}

export const rehypeNormalizeForCompare: Plugin<[], HastRoot> = () => (tree) => {
  normalizeHastForCompare(tree);
};

export function wikiToNormalizedHtml(wiki: string, maps?: EquivalenceMaps): string {
  return wikiMarkdownToHtml(wikiToMarkdown(wiki, maps?.attachments, maps?.users), [
    rehypeNormalizeForCompare,
  ]);
}

/** Compares renderings of the core pipeline, not bytes (byte-level is SAFE-03, Phase 97). */
export function isEquivalent(a: string, b: string, maps?: EquivalenceMaps): boolean {
  return wikiToNormalizedHtml(a, maps) === wikiToNormalizedHtml(b, maps);
}

// Display-only: newline between adjacent tags so the diff is line-readable.
function split(html: string): string {
  return `${html.replace(/></g, '>\n<')}\n`;
}

export function formatEquivalenceDiff(path: string, beforeHtml: string, afterHtml: string): string {
  return createTwoFilesPatch(
    `${path} (original)`,
    `${path} (round-tripped)`,
    split(beforeHtml),
    split(afterHtml),
  );
}

export function checkCorpus(
  corpus: ReadonlyArray<{ path: string; wiki: string }>,
  roundTrip: RoundTrip,
  maps?: EquivalenceMaps,
): CorpusFailure[] {
  const failures: CorpusFailure[] = [];
  for (const { path, wiki } of corpus) {
    let emitted: string;
    try {
      emitted = roundTrip(wiki);
    } catch (err) {
      failures.push({
        path,
        diff: `roundTrip threw: ${err instanceof Error ? err.message : String(err)}`,
        emitted: '',
      });
      continue;
    }
    const before = wikiToNormalizedHtml(wiki, maps);
    const after = wikiToNormalizedHtml(emitted, maps);
    if (before !== after) {
      failures.push({ path, diff: formatEquivalenceDiff(path, before, after), emitted });
    }
  }
  return failures;
}

export function formatCorpusFailures(failures: CorpusFailure[]): string {
  return failures
    .map((f) => `✗ ${f.path}\n${f.diff}\nEmitted wiki:\n${JSON.stringify(f.emitted)}`)
    .join('\n\n');
}
