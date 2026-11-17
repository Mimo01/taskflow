import { describe, expect, it } from 'vitest';
import { parseWiki } from '@/lib/wiki/editor';
import { CODE_LANGUAGES } from './languages';
import { setCodeLanguage } from './panel-commands';
import { makeEditor, saveText } from './test-utils';

describe('CODE_LANGUAGES', () => {
  it('has no symbols or digits', () => {
    for (const l of CODE_LANGUAGES) expect(l.value).toMatch(/^[a-z]+$/);
  });

  it.each(CODE_LANGUAGES.map((l) => l.value))('parser models %s', (v) => {
    const first = parseWiki(`{code:${v}}\nx\n{code}`).doc.content?.[0];
    expect(first?.type).toBe('codeBlock');
    expect(first?.attrs?.language).toBe(v);
  });
});

describe('setCodeLanguage', () => {
  it('resets a non-canonical opener', () => {
    const { editor, load } = makeEditor('{code:title=a.java|borderStyle=solid}\nx\n{code}');
    expect(setCodeLanguage(editor, 0, 'java')).toBe(true);
    const r = saveText(editor, load);
    expect(r.kind).toBe('saved');
    expect(r.kind === 'saved' && r.text).toBe('{code:java}\nx\n{code}');
  });

  it('None emits {code}', () => {
    const { editor, load } = makeEditor('{code:java}\nx\n{code}');
    setCodeLanguage(editor, 0, null);
    const r = saveText(editor, load);
    expect(r.kind === 'saved' && r.text).toBe('{code}\nx\n{code}');
  });

  it('refuses noformat', () => {
    const { editor } = makeEditor('{noformat}\nx\n{noformat}');
    expect(setCodeLanguage(editor, 0, 'java')).toBe(false);
  });
});
