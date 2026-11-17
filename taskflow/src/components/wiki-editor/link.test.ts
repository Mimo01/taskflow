import { describe, expect, it } from 'vitest';
import { isSafeLinkUrl, normalizeLinkUrl } from './link-url';
import { makeEditor, saveText } from './test-utils';

describe('isSafeLinkUrl', () => {
  it.each(['https://a.com/x', 'http://a.com', 'mailto:a@b.c'])('accepts %s', (u) => {
    expect(isSafeLinkUrl(u)).toBe(true);
  });
  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:x',
    ' javascript:x',
    'data:text/html,x',
    'file:///etc',
    'vbscript:x',
    'https://a.com/a b',
    'https://a.com/a|b',
    'https://a.com/a]b',
    '',
  ])('rejects %j', (u) => {
    expect(isSafeLinkUrl(u)).toBe(false);
  });
});

describe('normalizeLinkUrl', () => {
  it('prefixes bare hosts', () => expect(normalizeLinkUrl('a.com/x')).toBe('https://a.com/x'));
  it('keeps schemes', () => expect(normalizeLinkUrl('https://a.com')).toBe('https://a.com'));
  it('rejects unsafe', () => expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull());
});

function paste(editor: ReturnType<typeof makeEditor>['editor'], text: string) {
  const { view } = editor;
  const event = {
    clipboardData: { getData: (t: string) => (t === 'text/plain' ? text : '') },
  } as unknown as ClipboardEvent;
  return view.someProp('handlePaste', (f) => f(view, event, view.state.doc.slice(0, 0)));
}

describe('paste URL over selection', () => {
  it('links the selection', () => {
    const { editor, load } = makeEditor('a x b');
    editor.commands.setTextSelection({ from: 3, to: 4 });
    expect(paste(editor, 'https://a.com')).toBe(true);
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: 'a [x|https://a.com] b' });
  });
  it('rejects javascript:', () => {
    const { editor, load } = makeEditor('a x b');
    editor.commands.setTextSelection({ from: 3, to: 4 });
    expect(paste(editor, 'javascript:alert(1)')).toBeFalsy();
    expect(saveText(editor, load).kind).toBe('unchanged');
  });
  it('ignores empty selection', () => {
    const { editor } = makeEditor('a x b');
    editor.commands.setTextSelection(3);
    expect(paste(editor, 'https://a.com')).toBeFalsy();
  });
  it('unsetLink removes the link', () => {
    const { editor, load } = makeEditor('a x b');
    editor.commands.setTextSelection({ from: 3, to: 4 });
    editor.commands.setLink({ href: 'https://a.com' });
    editor.chain().extendMarkRange('link').unsetLink().run();
    const saved = saveText(editor, load);
    expect(saved.kind === 'saved' ? saved.text : saved.kind).toBe('unchanged');
  });
});
