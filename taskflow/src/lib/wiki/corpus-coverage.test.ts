import { describe, expect, it } from 'vitest';
import { WIKI_CORPUS } from './corpus.fixtures';

// Groups map to the D-09 constructs: lists, tables, panels, code, macros,
// emoticons, mentions, escapes, whitespace (CRLF), monospace, attachments, inline.
const REQUIRED_FIXTURES = [
  'lists/nested-bullets.wiki',
  'lists/mixed-nesting.wiki',
  'lists/numbered-nested.wiki',
  'lists/mixed-deep.wiki',
  'lists/dash-bullets.wiki',
  'lists/continuation.wiki',
  'lists/panel-after-item.wiki',
  'tables/header-row.wiki',
  'tables/headerless.wiki',
  'tables/inline-callout-cell.wiki',
  'tables/single-line-inline.wiki',
  'tables/cell-formatting.wiki',
  'tables/open-row-merge.wiki',
  'tables/headerless-with-links.wiki',
  'tables/panel-in-cell-multi.wiki',
  'tables/mixed-header-row.wiki',
  'tables/code-in-cell.wiki',
  'panels/panel-titled.wiki',
  'panels/info-titled.wiki',
  'panels/note.wiki',
  'panels/warning-titled.wiki',
  'panels/tip.wiki',
  'panels/panel-list-items.wiki',
  'panels/panel-in-panel.wiki',
  'panels/list-in-panel-nested.wiki',
  'panels/tip-titled.wiki',
  'code/code-language.wiki',
  'code/code-plain.wiki',
  'code/noformat.wiki',
  'macros/color.wiki',
  'macros/unknown-macro.wiki',
  'macros/quote.wiki',
  'macros/unclosed-panel.wiki',
  'macros/unclosed-code.wiki',
  'macros/mismatched-closer.wiki',
  'macros/color-multi-block.wiki',
  'macros/inline-status.wiki',
  'macros/expand-unknown.wiki',
  'macros/code-language-param.wiki',
  'emoticons/all-emoticons.wiki',
  'emoticons/inline-emoticons.wiki',
  'mentions/username.wiki',
  'mentions/accountid.wiki',
  'mentions/unknown-user.wiki',
  'escapes/escaped-chars.wiki',
  'escapes/line-breaks.wiki',
  'escapes/regressions.wiki',
  'whitespace/crlf.wiki',
  'whitespace/trailing-whitespace.wiki',
  'whitespace/mixed-eol.wiki',
  'whitespace/blank-lines.wiki',
  'whitespace/code-trailing-ws.wiki',
  'monospace/plain-space.wiki',
  'monospace/nbsp.wiki',
  'monospace/teletype-braces.wiki',
  'attachments/image.wiki',
  'attachments/file-link.wiki',
  'attachments/image-params.wiki',
  'attachments/missing.wiki',
  'inline/formatting.wiki',
  'inline/links-underscores.wiki',
  'inline/headings-rule.wiki',
  'inline/heading-no-space.wiki',
  'inline/brace-bold.wiki',
] as const;

const ALLOWED_HOSTS = new Set(['example.com', 'jira.example.com', 'example.org']);
// 'placeholder-missing' is the deliberate unknown-user placeholder (mentions/unknown-user.wiki).
const ALLOWED_MENTIONS = new Set([
  'jdoe',
  'asmith',
  'accountId:placeholder-0001',
  'placeholder-missing',
]);

function wikiOf(path: string): string {
  const entry = WIKI_CORPUS.find((f) => f.path === path);
  if (!entry) throw new Error(`missing fixture ${path}`);
  return entry.wiki;
}

describe('wiki corpus coverage', () => {
  it('lists exactly 64 required fixtures', () => {
    expect(REQUIRED_FIXTURES).toHaveLength(64);
  });

  it('contains every required fixture, non-empty and sorted by path', () => {
    const paths = WIKI_CORPUS.map((f) => f.path);
    for (const req of REQUIRED_FIXTURES) expect(paths).toContain(req);
    expect(paths).toEqual([...paths].sort());
    for (const f of WIKI_CORPUS) expect(f.wiki.length).toBeGreaterThan(0);
  });

  it('keeps CRLF line endings byte-exact in whitespace/crlf.wiki', () => {
    const raw = wikiOf('whitespace/crlf.wiki');
    expect(raw).toContain('\r\n');
    expect(/(?<!\r)\n/.test(raw)).toBe(false);
  });

  it('mixes CRLF and bare LF in whitespace/mixed-eol.wiki', () => {
    const raw = wikiOf('whitespace/mixed-eol.wiki');
    expect(raw).toContain('\r\n');
    expect(/(?<!\r)\n/.test(raw)).toBe(true);
  });

  it('keeps trailing spaces and tabs in whitespace/trailing-whitespace.wiki', () => {
    const lines = wikiOf('whitespace/trailing-whitespace.wiki').split('\n');
    expect(lines.some((l) => / $/.test(l))).toBe(true);
    expect(lines.some((l) => /\t$/.test(l))).toBe(true);
  });

  it('keeps the nbsp byte in monospace/nbsp.wiki', () => {
    expect(wikiOf('monospace/nbsp.wiki')).toContain('{{ ');
  });

  it('contains only placeholder hosts, no emails, only allowlisted mentions', () => {
    for (const { path, wiki } of WIKI_CORPUS) {
      for (const m of wiki.matchAll(/https?:\/\/([^/\s|\]]+)/g)) {
        expect(ALLOWED_HOSTS.has(m[1]), `${path}: host ${m[1]}`).toBe(true);
      }
      expect(/[\w.+-]+@[\w-]+\.[\w.]+/.test(wiki), `${path}: email`).toBe(false);
      for (const m of wiki.matchAll(/\[~([^\]]+)\]/g)) {
        expect(ALLOWED_MENTIONS.has(m[1] ?? ''), `${path}: mention ${m[1]}`).toBe(true);
      }
    }
  });
});
