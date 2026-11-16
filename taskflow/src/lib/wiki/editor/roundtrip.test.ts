import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { HARNESS_ATTACHMENTS, HARNESS_USERS, WIKI_CORPUS } from '../corpus.fixtures';
import { checkCorpus, formatCorpusFailures } from '../equivalence';
import { emitWiki } from './emit';
import { parseWiki } from './parse/blocks';
import { wikiSchema } from './schema';

const MAPS = { attachments: HARNESS_ATTACHMENTS, users: HARNESS_USERS };
const lf = (s: string): string => s.replace(/\r\n?/g, '\n');

/** Fixtures whose emitted text deliberately differs from the source bytes. */
const EOL_NORMALISED = new Set(['whitespace/mixed-eol.wiki']);
const TRAILING_WS = new Set([
  'whitespace/trailing-whitespace.wiki',
  'whitespace/code-trailing-ws.wiki',
]);

/**
 * Fixtures that currently contain raw atoms, with the reason. A fixture
 * outside this list must have none; a stale entry fails too. Later plans
 * delete entries as they model each family.
 */
const RAW_ALLOWED: Record<string, string> = {
  'emoticons/inline-emoticons.wiki': 'tables modelled in Plan 06',
  'escapes/line-breaks.wiki': 'table modelled in Plan 06',
  'escapes/regressions.wiki': 'panels modelled in Plan 06',
  'lists/panel-after-item.wiki': 'panels modelled in Plan 06',
  'macros/code-language-param.wiki': 'D-10 code opener outside the jira2md grammar',
  'macros/color-multi-block.wiki': '{color} modelled in Plan 08',
  'macros/expand-unknown.wiki': 'D-10 unknown macro with a closer',
  'macros/mismatched-closer.wiki': 'D-10 mismatched code/noformat closers',
  'macros/unclosed-code.wiki': 'D-10 unclosed known macro',
  'macros/unclosed-panel.wiki': 'D-10 unclosed known macro',
  'macros/unknown-macro.wiki': 'D-10 unknown macro with a closer',
  'panels/info-titled.wiki': 'panels modelled in Plan 06',
  'panels/list-in-panel-nested.wiki': 'panels modelled in Plan 06',
  'panels/note.wiki': 'panels modelled in Plan 06',
  'panels/panel-in-panel.wiki': 'panels modelled in Plan 06',
  'panels/panel-list-items.wiki': 'panels modelled in Plan 06',
  'panels/panel-titled.wiki': 'panels modelled in Plan 06',
  'panels/tip-titled.wiki': 'panels modelled in Plan 06',
  'panels/tip.wiki': 'panels modelled in Plan 06',
  'panels/warning-titled.wiki': 'panels modelled in Plan 06',
  'tables/cell-formatting.wiki': 'tables modelled in Plan 06',
  'tables/code-in-cell.wiki': 'tables modelled in Plan 06',
  'tables/header-row.wiki': 'tables modelled in Plan 06',
  'tables/headerless-with-links.wiki': 'tables modelled in Plan 06',
  'tables/headerless.wiki': 'tables modelled in Plan 06',
  'tables/inline-callout-cell.wiki': 'tables modelled in Plan 06',
  'tables/mixed-header-row.wiki': 'tables modelled in Plan 06',
  'tables/open-row-merge.wiki': 'tables modelled in Plan 06',
  'tables/panel-in-cell-multi.wiki': 'tables modelled in Plan 06',
  'whitespace/crlf.wiki': 'tables modelled in Plan 06',
};

/** Fixtures whose modelled node types must appear in the parsed doc. */
const MODELLED: Record<string, string[]> = {
  'code/code-language.wiki': ['codeBlock'],
  'code/code-plain.wiki': ['codeBlock'],
  'code/noformat.wiki': ['codeBlock'],
  'inline/headings-rule.wiki': ['heading', 'horizontalRule'],
  'inline/heading-no-space.wiki': ['heading'],
  'whitespace/code-trailing-ws.wiki': ['codeBlock'],
  'whitespace/blank-lines.wiki': ['paragraph', 'heading'],
  'lists/mixed-nesting.wiki': ['bulletList', 'orderedList', 'listItem'],
  'lists/dash-bullets.wiki': ['bulletList'],
  'macros/quote.wiki': ['blockquote'],
};

function collect(node: JSONContent, into: Set<string>): void {
  if (node.type) into.add(node.type);
  for (const m of node.marks ?? []) into.add(m.type);
  for (const c of node.content ?? []) collect(c, into);
}

const rawCount = (node: JSONContent): number =>
  (node.type === 'rawBlock' || node.type === 'rawInline' ? 1 : 0) +
  (node.content ?? []).reduce((n, c) => n + rawCount(c), 0);

function rawAtoms(node: JSONContent, into: string[]): string[] {
  if (
    (node.type === 'rawBlock' || node.type === 'rawInline') &&
    typeof node.attrs?.raw === 'string'
  )
    into.push(node.attrs.raw);
  for (const c of node.content ?? []) rawAtoms(c, into);
  return into;
}

/** Expected emit for the trailing-whitespace fixtures: strip line-end ws outside code bodies. */
function stripOutsideCode(text: string): string {
  let out = '';
  let rest = lf(text);
  for (;;) {
    const open = /\{(?:code[^}]*|noformat)\}/.exec(rest);
    if (!open) return out + rest.replace(/[ \t]+$/gm, '');
    const closeToken = open[0].startsWith('{noformat') ? '{noformat}' : '{code}';
    const bodyStart = open.index + open[0].length;
    const close = rest.indexOf(closeToken, bodyStart);
    if (close === -1) return out + rest.replace(/[ \t]+$/gm, '');
    out += rest.slice(0, bodyStart).replace(/[ \t]+$/gm, '') + rest.slice(bodyStart, close);
    rest = rest.slice(close);
    out += closeToken;
    rest = rest.slice(closeToken.length);
  }
}

const roundTrip = (s: string): string => emitWiki(parseWiki(s).doc);

describe('corpus round-trip (SAFE-03, SAFE-04)', () => {
  it('is render-equivalent over the whole corpus', () => {
    const failures = checkCorpus(WIKI_CORPUS, roundTrip, MAPS);
    expect(failures, formatCorpusFailures(failures)).toEqual([]);
  });

  it('emits byte-identical text except the documented normalisations', () => {
    for (const { path, wiki } of WIKI_CORPUS) {
      const emitted = roundTrip(wiki);
      if (EOL_NORMALISED.has(path)) {
        expect(emitted, path).toBe(lf(wiki).replace(/\n/g, '\r\n'));
      } else if (TRAILING_WS.has(path)) {
        expect(emitted, path).toBe(stripOutsideCode(wiki));
        expect(emitted, path).not.toBe(wiki);
      } else {
        expect(emitted, path).toBe(wiki);
      }
    }
  });

  it('keeps trailing whitespace inside code bodies (D-07)', () => {
    const wiki = WIKI_CORPUS.find((f) => f.path === 'whitespace/code-trailing-ws.wiki')?.wiki ?? '';
    expect(roundTrip(wiki)).toContain('foo  \nbar\t\n');
    expect(roundTrip(wiki).startsWith('Prose line\n')).toBe(true);
  });

  it('docs pass check(), emit is idempotent and raw atoms are source substrings', () => {
    for (const { path, wiki } of WIKI_CORPUS) {
      const { doc, slices } = parseWiki(wiki);
      wikiSchema.nodeFromJSON(doc).check();
      expect(slices.join(''), path).toBe(lf(wiki));
      const once = emitWiki(doc);
      expect(emitWiki(parseWiki(once).doc), path).toBe(once);
      for (const r of rawAtoms(doc, [])) expect(lf(wiki), path).toContain(r);
    }
  });

  it('registry: raw atoms only where allowed, modelled nodes present', () => {
    for (const [path, reason] of Object.entries(RAW_ALLOWED)) {
      expect(reason.length, path).toBeGreaterThan(0);
      expect(
        WIKI_CORPUS.some((f) => f.path === path),
        `stale path ${path}`,
      ).toBe(true);
    }
    for (const { path, wiki } of WIKI_CORPUS) {
      const doc = parseWiki(wiki).doc;
      const n = rawCount(doc);
      if (path in RAW_ALLOWED) expect(n, `stale RAW_ALLOWED entry ${path}`).toBeGreaterThan(0);
      else expect(n, `unexpected raw atom in ${path}`).toBe(0);
      const want = MODELLED[path];
      if (want) {
        const have = new Set<string>();
        collect(doc, have);
        for (const t of want) expect(have.has(t), `${path} lacks ${t}`).toBe(true);
      }
    }
  });
});

describe('mutation self-test (the gate bites)', () => {
  it('an emitter that drops {code} closers is reported', () => {
    const failures = checkCorpus(WIKI_CORPUS, (s) => roundTrip(s).split('{code}\n').join(''), MAPS);
    expect(failures.map((f) => f.path)).toContain('code/code-plain.wiki');
  });
});
