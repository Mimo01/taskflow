/**
 * Shared wiki code highlighter (editor decorations + WikiRenderer). TipTap-free on purpose:
 * bundle-guard.test.ts forbids this module's graph from reaching @tiptap/*, prosemirror* or
 * lib/wiki/editor/*. Never auto-detects: bare {code}, {noformat} and unmapped values stay plain.
 */
import type { Element, ElementContent, Root } from 'hast';
import actionscript from 'highlight.js/lib/languages/actionscript';
import applescript from 'highlight.js/lib/languages/applescript';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import css from 'highlight.js/lib/languages/css';
import delphi from 'highlight.js/lib/languages/delphi';
import diff from 'highlight.js/lib/languages/diff';
import erlang from 'highlight.js/lib/languages/erlang';
import go from 'highlight.js/lib/languages/go';
import groovy from 'highlight.js/lib/languages/groovy';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import perl from 'highlight.js/lib/languages/perl';
import php from 'highlight.js/lib/languages/php';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import scala from 'highlight.js/lib/languages/scala';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import vbnet from 'highlight.js/lib/languages/vbnet';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { createLowlight } from 'lowlight';
import { visit } from 'unist-util-visit';

// Module-level, never mutated after init (React Compiler safe).
const lowlight = createLowlight({
  actionscript,
  applescript,
  bash,
  c,
  css,
  delphi,
  diff,
  erlang,
  go,
  groovy,
  java,
  javascript,
  json,
  kotlin,
  perl,
  php,
  powershell,
  python,
  ruby,
  scala,
  scss,
  sql,
  swift,
  typescript,
  vbnet,
  xml,
  yaml,
});

/** Strict map: wiki `{code:lang}` value -> hljs grammar. null = known but plain. */
const WIKI_TO_HLJS: Record<string, string | null> = {
  actionscript: 'actionscript',
  applescript: 'applescript',
  bash: 'bash',
  c: 'c',
  coldfusion: null,
  css: 'css',
  delphi: 'delphi',
  diff: 'diff',
  erlang: 'erlang',
  go: 'go',
  groovy: 'groovy',
  html: 'xml',
  java: 'java',
  javascript: 'javascript',
  json: 'json',
  kotlin: 'kotlin',
  perl: 'perl',
  php: 'php',
  powershell: 'powershell',
  python: 'python',
  ruby: 'ruby',
  sass: 'scss',
  scala: 'scala',
  sql: 'sql',
  swift: 'swift',
  typescript: 'typescript',
  vb: 'vbnet',
  xml: 'xml',
  yaml: 'yaml',
};

export function hljsLanguageFor(wiki: string | null | undefined): string | null {
  if (!wiki) return null;
  // typeof guard (not `in`): inherited keys like 'toString' must resolve to plain.
  const lang: unknown = WIKI_TO_HLJS[wiki];
  return typeof lang === 'string' ? lang : null;
}

/** Blocks longer than this render plain (sync tokenising cost on every render / edit). */
export const MAX_HIGHLIGHT_CHARS = 100_000;
/**
 * Any single line longer than this renders the block plain: hljs is quadratic on one long
 * token (a 20k-char blob took ~600 ms, 100k ~13 s; 100k chars of normal Java ~10 ms).
 */
export const MAX_HIGHLIGHT_LINE = 2_000;

function tooLongToHighlight(text: string): boolean {
  if (text.length > MAX_HIGHLIGHT_CHARS) return true;
  let start = 0;
  while (start <= text.length) {
    const nl = text.indexOf('\n', start);
    const end = nl === -1 ? text.length : nl;
    if (end - start > MAX_HIGHLIGHT_LINE) return true;
    start = end + 1;
  }
  return false;
}

/** hast children for the code, or null = render plain. Never auto-detects. */
export function highlightWikiCode(
  wiki: string | null | undefined,
  text: string,
): Root['children'] | null {
  const lang = hljsLanguageFor(wiki);
  // Tokenising is synchronous: oversized blocks stay plain rather than freeze the UI.
  if (!lang || tooLongToHighlight(text)) return null;
  return lowlight.highlight(lang, text).children;
}

function textOf(nodes: ElementContent[]): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') out += n.value;
    else if (n.type === 'element') out += textOf(n.children);
  }
  return out;
}

/**
 * Post-sanitize rehype plugin: <pre><code class="language-x"> -> token spans. Emits only text
 * and span.hljs-* nodes, never the `hljs` container class (global github-dark.css would
 * paint it).
 */
export function rehypeWikiHighlight() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, _index, parent) => {
      if (node.tagName !== 'code' || !parent || parent.type !== 'element') return;
      if ((parent as Element).tagName !== 'pre') return;
      const cls = node.properties?.className;
      const list = Array.isArray(cls) ? cls : [];
      const entry = list.find((x) => typeof x === 'string' && x.startsWith('language-'));
      if (typeof entry !== 'string') return;
      const out = highlightWikiCode(entry.slice('language-'.length), textOf(node.children));
      if (out) node.children = out as ElementContent[];
    });
  };
}
