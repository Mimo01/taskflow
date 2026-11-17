import { describe, expect, it } from 'vitest';
import { isSafeColor } from '@/lib/wiki/editor/parse/color';
import {
  applyColour,
  applyLink,
  currentColour,
  currentLink,
  removeColour,
  removeLink,
} from './inline-commands';
import { TEXT_PALETTE } from './palette';
import { makeEditor, saveText } from './test-utils';

const text = (s: ReturnType<typeof saveText>) => (s.kind === 'saved' ? s.text : s.kind);

describe('palette', () => {
  it.each(TEXT_PALETTE.map((p) => [p.name, p.value]))('%s is safe', (name, value) => {
    expect(name).toBeTruthy();
    expect(isSafeColor(value as string)).toBe(true);
    expect(value).toBe((value as string).toLowerCase());
  });
});

describe('colour commands', () => {
  it('applies a palette colour', () => {
    const { editor, load } = makeEditor('x');
    editor.commands.setTextSelection({ from: 1, to: 2 });
    expect(applyColour(editor, '#ff5630')).toBe(true);
    expect(text(saveText(editor, load))).toBe('{color:#ff5630}x{color}');
  });
  it('rejects unsafe values', () => {
    const { editor, load } = makeEditor('x');
    editor.commands.setTextSelection({ from: 1, to: 2 });
    expect(applyColour(editor, 'red;background:url(x)')).toBe(false);
    expect(saveText(editor, load).kind).toBe('unchanged');
  });
  it('removes colour', () => {
    const { editor, load } = makeEditor('{color:#ff5630}x{color}');
    editor.commands.setTextSelection({ from: 1, to: 2 });
    removeColour(editor);
    expect(text(saveText(editor, load))).toBe('x');
  });
  it('leaves off-palette colours untouched', () => {
    const { editor, load } = makeEditor('{color:#123abc}x{color}');
    expect(saveText(editor, load).kind).toBe('unchanged');
    editor.commands.setTextSelection(1);
    expect(currentColour(editor)).toBe('#123abc');
  });
});

describe('link commands', () => {
  it('links the selection', () => {
    const { editor, load } = makeEditor('x');
    editor.commands.setTextSelection({ from: 1, to: 2 });
    expect(applyLink(editor, 'a.com')).toBe(true);
    expect(text(saveText(editor, load))).toBe('[x|https://a.com]');
  });
  it('rejects javascript:', () => {
    const { editor } = makeEditor('x');
    editor.commands.setTextSelection({ from: 1, to: 2 });
    expect(applyLink(editor, 'javascript:alert(1)')).toBe(false);
  });
  it('inserts linked URL text when collapsed', () => {
    const { editor } = makeEditor('x');
    editor.commands.setTextSelection(1);
    expect(applyLink(editor, 'https://a.com')).toBe(true);
    expect(editor.getText()).toContain('https://a.com');
    editor.commands.setTextSelection(4);
    expect(currentLink(editor)).toBe('https://a.com');
  });
  it('reads and removes the whole link', () => {
    const { editor, load } = makeEditor('a [xyz|https://a.com] b');
    editor.commands.setTextSelection(4);
    expect(currentLink(editor)).toBe('https://a.com');
    removeLink(editor);
    expect(text(saveText(editor, load))).toBe('a xyz b');
  });
});
