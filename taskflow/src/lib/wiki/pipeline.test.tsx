import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import { describe, expect, it } from 'vitest';
import { HARNESS_ATTACHMENTS, HARNESS_USERS, WIKI_CORPUS } from './corpus.fixtures';
import { wikiRehypePlugins, wikiRemarkPlugins, wikiToHtml, wikiToMarkdown } from './pipeline';

function normalise(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerHTML;
}

// Fixtures whose output differs only because react-markdown applies
// defaultUrlTransform after plugins. Each is asserted to really diverge.
const PARITY_KNOWN_DIVERGENCES: string[] = [];

// React 19 server rendering hoists <link rel="preload" as="image"> hints for
// every <img>. That is a React artifact, not part of the wiki pipeline output.
function reactRender(wiki: string): string {
  const html = renderToStaticMarkup(
    <Markdown remarkPlugins={wikiRemarkPlugins} rehypePlugins={wikiRehypePlugins([])}>
      {wikiToMarkdown(wiki, HARNESS_ATTACHMENTS, HARNESS_USERS)}
    </Markdown>,
  );
  return html.replace(/<link rel="preload" as="image"[^>]*>/g, '');
}

describe('wikiToHtml', () => {
  it('returns empty string for empty and undefined input', () => {
    expect(wikiToHtml('')).toBe('');
    expect(wikiToHtml(undefined)).toBe('');
  });

  it('renders bold', () => {
    expect(wikiToHtml('*bold* text')).toContain('<strong>bold</strong>');
  });

  it('renders panel callouts', () => {
    expect(wikiToHtml('{panel:title=T}body{panel}')).toContain('data-callout');
  });

  it('strips script tags (sanitize after raw)', () => {
    expect(wikiToHtml('<script>alert(1)</script>')).not.toContain('<script');
  });

  it('does not linkify issue keys (presentation plugin excluded)', () => {
    expect(wikiToHtml('see PROJ-12').toLowerCase()).not.toContain('issuekeylink');
  });

  describe('parity with react-markdown', () => {
    it.each(WIKI_CORPUS.filter((f) => !PARITY_KNOWN_DIVERGENCES.includes(f.path)))('$path', ({
      wiki,
    }) => {
      const oracle = normalise(wikiToHtml(wiki, HARNESS_ATTACHMENTS, HARNESS_USERS));
      expect(oracle).toBe(normalise(reactRender(wiki)));
    });

    it.each(PARITY_KNOWN_DIVERGENCES)('known divergence still diverges: %s', (p) => {
      const f = WIKI_CORPUS.find((x) => x.path === p);
      expect(f).toBeDefined();
      const wiki = f?.wiki ?? '';
      expect(normalise(wikiToHtml(wiki, HARNESS_ATTACHMENTS, HARNESS_USERS))).not.toBe(
        normalise(reactRender(wiki)),
      );
    });
  });
});

describe('lib/wiki purity guard', () => {
  // Recursive, so future subdirectories (e.g. lib/wiki/editor/) are covered too.
  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(e.name) && !e.name.includes('.test.') ? [full] : [];
    });
  }

  it('non-test files import no React/Tauri/store modules', () => {
    // from '…', side-effect import '…', dynamic import('…') and require('…').
    const forbidden =
      /(?:from\s+|import\s*\(?\s*|require\s*\(\s*)['"](react|react-dom|react-markdown|zustand|@tauri-apps\/[^'"]*|@\/(stores|routes|services|components|hooks)[^'"]*)['"]/;
    const files = sourceFiles(__dirname);
    expect(files.map((f) => path.basename(f))).toContain('corpus.fixtures.ts');
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, path.relative(__dirname, f)).not.toMatch(forbidden);
    }
  });
});

function parseHtml(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

function fixtureWiki(rel: string): string {
  const f = WIKI_CORPUS.find((x) => x.path.endsWith(rel));
  if (!f) throw new Error(`fixture not found: ${rel}`);
  return f.wiki;
}

describe('D-01 mixed list nesting', () => {
  const root = parseHtml(wikiToHtml(fixtureWiki('lists/mixed-nesting.wiki')));

  it('renders *# under a bullet as an ordered list nested in the parent li', () => {
    const ol = root.querySelector('ul > li > ol');
    expect(ol).not.toBeNull();
    expect(ol?.textContent).toContain('Numbered child one');
    expect(ol?.textContent).toContain('Numbered child two');
    // the following ** run is a bullet list inside the same parent li
    expect(root.querySelector('ul > li > ul')?.textContent).toContain('Bullet child');
  });

  it('renders #* under a number as a nested bullet list, with a numbered grandchild', () => {
    const ols = Array.from(root.querySelectorAll('ol')).filter((o) => o.parentElement === root);
    const parentOl = ols.find((o) => o.textContent?.includes('Numbered parent'));
    expect(parentOl).toBeDefined();
    const ul = parentOl?.querySelector('li > ul');
    expect(ul?.textContent).toContain('Bullet child of number');
    expect(ul?.textContent).toContain('Another bullet child');
    expect(parentOl?.querySelector('li > ol')?.textContent).toContain('Numbered grandchild');
  });

  it('leaves no literal mixed marker in the output', () => {
    expect(root.textContent).not.toMatch(/\*#|#\*/);
  });

  it('keeps inline formatting inside a mixed item', () => {
    const r = parseHtml(wikiToHtml('* a\n*# b *x*'));
    expect(r.querySelector('ul > li > ol > li strong')?.textContent).toBe('x');
  });

  it('renders pure ** and ## runs as before', () => {
    const ul = parseHtml(wikiToHtml('* a\n** b\n* c'));
    expect(ul.querySelectorAll('ul > li > ul > li').length).toBe(1);
    expect(ul.querySelector('ol')).toBeNull();
    const ol = parseHtml(wikiToHtml('# a\n## b\n# c'));
    expect(ol.querySelectorAll('ol > li > ol > li').length).toBe(1);
    expect(ol.querySelector('ul')).toBeNull();
  });
});
