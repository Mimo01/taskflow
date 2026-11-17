import { describe, expect, it } from 'vitest';
import { loadWiki } from '@/lib/wiki/editor';
import { makeEditor, saveText, typeText } from './test-utils';

function enter(editor: ReturnType<typeof makeEditor>['editor']) {
  editor.commands.keyboardShortcut('Enter');
}

describe('Enter splits save with a blank line (UAT gap 1)', () => {
  it('empty doc: a, Enter, b', () => {
    const { editor, load } = makeEditor('');
    typeText(editor, 'a');
    enter(editor);
    typeText(editor, 'b');
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: 'a\n\nb' });
  });

  it('end of block', () => {
    const { editor, load } = makeEditor('abc');
    editor.commands.setTextSelection(4);
    enter(editor);
    typeText(editor, 'd');
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: 'abc\n\nd' });
  });

  it('middle of block', () => {
    const { editor, load } = makeEditor('abc');
    editor.commands.setTextSelection(3);
    enter(editor);
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: 'ab\n\nc' });
  });

  it('start of the first block', () => {
    const { editor, load } = makeEditor('abc');
    editor.commands.setTextSelection(1);
    enter(editor);
    editor.commands.setTextSelection(1);
    typeText(editor, 'z');
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: 'z\n\nabc' });
  });

  it('Enter twice', () => {
    const { editor, load } = makeEditor('abc');
    editor.commands.setTextSelection(4);
    enter(editor);
    enter(editor);
    typeText(editor, 'd');
    const res = saveText(editor, load);
    expect(res.kind).toBe('saved');
    if (res.kind !== 'saved') return;
    expect(res.text.startsWith('abc\n\n')).toBe(true);
    expect(res.text.endsWith('\nd')).toBe(true);
    const back = loadWiki(res.text);
    expect(back.kind).not.toBe('failed');
    if (!('doc' in back)) return;
    const texts = (back.doc.content ?? [])
      .filter((n) => n.type === 'paragraph' && n.content?.length)
      .map((n) => n.content?.[0]?.text);
    expect(texts).toEqual(['abc', 'd']);
  });

  it('Enter at the end of a heading', () => {
    const { editor, load } = makeEditor('h1. Title');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    enter(editor);
    typeText(editor, 'x');
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: 'h1. Title\n\nx' });
  });

  it('Enter inside a heading', () => {
    const { editor, load } = makeEditor('h1. Title');
    editor.commands.setTextSelection(3);
    enter(editor);
    expect(saveText(editor, load).kind).toBe('saved');
  });

  it('Enter twice in a list lifts out', () => {
    const { editor, load } = makeEditor('* one');
    editor.commands.setTextSelection(editor.state.doc.content.size - 2);
    enter(editor);
    enter(editor);
    typeText(editor, 'x');
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: '* one\n\nx' });
  });

  it('typing inside a loaded gap-0 block keeps its gap', () => {
    const { editor, load } = makeEditor('h1. T\npara');
    expect(editor.state.doc.child(1).attrs.gap).toBe(0);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    typeText(editor, 'x');
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: 'h1. T\nparax' });
  });
});
