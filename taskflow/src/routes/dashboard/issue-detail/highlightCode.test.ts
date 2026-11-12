import hljs from 'highlight.js/lib/core';
import { describe, expect, it } from 'vitest';
import { highlightCode } from './highlightCode';
import { CODE_EXTENSION_LANGUAGE_MAP } from './resolvePreviewKind';

describe('highlightCode', () => {
  it('registers every language named in the extension map', () => {
    for (const lang of new Set(Object.values(CODE_EXTENSION_LANGUAGE_MAP))) {
      expect(hljs.getLanguage(lang), lang).toBeDefined();
    }
    expect(hljs.getLanguage('dockerfile')).toBeDefined();
  });

  it('escapes xml source rather than emitting live markup', () => {
    const out = highlightCode('<root a="1">x</root>', 'config.xml');
    expect(out).toContain('hljs-tag');
    expect(out).toContain('&lt;');
    expect(out).not.toContain('<root');
  });

  it('highlights a Dockerfile by filename', () => {
    expect(typeof highlightCode('FROM scratch\nRUN echo hi', 'Dockerfile')).toBe('string');
  });
});
