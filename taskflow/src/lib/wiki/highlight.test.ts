import type { Element, Root } from 'hast';
import { describe, expect, it } from 'vitest';
import { CODE_LANGUAGES } from '@/components/wiki-editor/languages';
import {
  highlightWikiCode,
  hljsLanguageFor,
  MAX_HIGHLIGHT_CHARS,
  MAX_HIGHLIGHT_LINE,
} from './highlight';

type Child = Root['children'][number];

function text(nodes: Child[]): string {
  return nodes
    .map((n) => (n.type === 'text' ? n.value : n.type === 'element' ? text(n.children) : ''))
    .join('');
}

function classes(nodes: Child[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type !== 'element') continue;
    const cls = (n as Element).properties?.className;
    if (Array.isArray(cls)) out.push(cls.join(' '));
    out.push(...classes(n.children));
  }
  return out;
}

describe('hljsLanguageFor', () => {
  it('has an own key for every CODE_LANGUAGES value', () => {
    for (const l of CODE_LANGUAGES) {
      const r = hljsLanguageFor(l.value);
      if (l.value === 'coldfusion') expect(r).toBeNull();
      else expect(typeof r, l.value).toBe('string');
    }
  });

  it('maps wiki aliases and stays strict for everything else', () => {
    expect(hljsLanguageFor('vb')).toBe('vbnet');
    expect(hljsLanguageFor('html')).toBe('xml');
    expect(hljsLanguageFor('sass')).toBe('scss');
    expect(hljsLanguageFor('java')).toBe('java');
    expect(hljsLanguageFor('coldfusion')).toBeNull();
    expect(hljsLanguageFor('js')).toBeNull();
    expect(hljsLanguageFor(null)).toBeNull();
    expect(hljsLanguageFor('')).toBeNull();
    expect(hljsLanguageFor('toString')).toBeNull();
  });
});

describe('highlightWikiCode', () => {
  it('emits hljs-keyword spans and preserves the text exactly', () => {
    const src = 'public class X {}';
    const out = highlightWikiCode('java', src);
    expect(out).not.toBeNull();
    expect(classes(out ?? [])).toContain('hljs-keyword');
    expect(text(out ?? [])).toBe(src);
  });

  it('never emits the bare `hljs` container class', () => {
    const out = highlightWikiCode('java', 'public class X {}') ?? [];
    expect(classes(out).filter((c) => c === 'hljs')).toEqual([]);
  });

  it('leaves blocks over the size caps plain', () => {
    const line = 'int x = 1;\n';
    const big = line.repeat(Math.ceil((MAX_HIGHLIGHT_CHARS + 1) / line.length));
    expect(highlightWikiCode('java', big)).toBeNull();
    expect(highlightWikiCode('java', line.repeat(100))).not.toBeNull();
    expect(highlightWikiCode('java', `int x;\n${'x'.repeat(MAX_HIGHLIGHT_LINE + 1)}`)).toBeNull();
    expect(highlightWikiCode('java', `int x;\n${'x'.repeat(MAX_HIGHLIGHT_LINE)}`)).not.toBeNull();
  });

  it('returns null (plain) for no or unmapped language, never auto-detecting', () => {
    expect(highlightWikiCode(null, 'x')).toBeNull();
    expect(highlightWikiCode('js', 'x')).toBeNull();
    expect(highlightWikiCode('coldfusion', 'x')).toBeNull();
  });

  it('highlights every mapped CODE_LANGUAGES value without throwing', () => {
    for (const l of CODE_LANGUAGES) {
      if (l.value === 'coldfusion') continue;
      expect(highlightWikiCode(l.value, 'a = 1'), l.value).not.toBeNull();
    }
  });
});
