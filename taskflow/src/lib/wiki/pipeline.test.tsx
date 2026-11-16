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
  it('non-test files import no React/Tauri/store modules', () => {
    const forbidden =
      /from\s+['"](react|react-dom|react-markdown|zustand|@tauri-apps\/[^'"]*|@\/(stores|routes|services|components|hooks)[^'"]*)['"]/;
    const files = fs
      .readdirSync(__dirname)
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.') && f !== 'corpus.fixtures.ts');
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
      expect(src, f).not.toMatch(forbidden);
    }
  });
});
