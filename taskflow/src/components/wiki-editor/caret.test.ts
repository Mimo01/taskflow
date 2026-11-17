import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import { makeEditor } from './test-utils';

type Ed = ReturnType<typeof makeEditor>['editor'];

function press(editor: Ed, init: KeyboardEventInit) {
  const { view } = editor;
  const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  return view.someProp('handleKeyDown', (f) => f(view, ev));
}
const meta = (key: string, shift = false) => ({ key, metaKey: true, shiftKey: shift });

/** Position of the first occurrence of `text` in the doc. */
function posOf(editor: Ed, text: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text?.includes(text)) {
      found = pos + (node.text?.indexOf(text) ?? 0);
    }
  });
  if (found < 0) throw new Error(`no ${text}`);
  return found;
}

function breakDoc() {
  const { editor } = makeEditor('x');
  editor.commands.setContent({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'one' },
          { type: 'hardBreak' },
          { type: 'text', text: 'two' },
        ],
      },
    ],
  });
  return editor;
}

describe('Cmd+Left/Right line boundary', () => {
  it('moves to the line start and end', () => {
    const { editor } = makeEditor('hello world');
    editor.commands.setTextSelection(7);
    expect(press(editor, meta('ArrowLeft'))).toBe(true);
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.empty).toBe(true);
    editor.commands.setTextSelection(7);
    expect(press(editor, meta('ArrowRight'))).toBe(true);
    expect(editor.state.selection.from).toBe(12);
  });

  it('Shift extends the selection', () => {
    const { editor } = makeEditor('hello world');
    editor.commands.setTextSelection(7);
    press(editor, meta('ArrowLeft', true));
    expect(editor.state.selection.anchor).toBe(7);
    expect(editor.state.selection.head).toBe(1);
    press(editor, meta('ArrowRight', true));
    expect(editor.state.selection.anchor).toBe(7);
    expect(editor.state.selection.head).toBe(12);
  });

  it('moves on the first press after a programmatic selection', () => {
    const { editor } = makeEditor('hello world');
    editor.commands.setTextSelection(4);
    expect(press(editor, meta('ArrowLeft'))).toBe(true);
    expect(editor.state.selection.from).toBe(1);
  });

  it('stops at a hard break (logical line fallback)', () => {
    const editor = breakDoc();
    editor.commands.setTextSelection(6);
    press(editor, meta('ArrowLeft'));
    expect(editor.state.selection.from).toBe(5);
    editor.commands.setTextSelection(2);
    press(editor, meta('ArrowRight'));
    expect(editor.state.selection.from).toBe(4);
  });

  it('stays inside the textblock for headings, list items and table cells', () => {
    const { editor } = makeEditor('h1. Head\n\n* alpha\n* beta\n\n||a||b||\n|cell|d|\n');
    for (const word of ['Head', 'beta', 'cell']) {
      const pos = posOf(editor, word) + 2;
      editor.commands.setTextSelection(pos);
      const $p = editor.state.doc.resolve(pos);
      press(editor, meta('ArrowLeft'));
      expect(editor.state.selection.from).toBe($p.start());
      editor.commands.setTextSelection(pos);
      press(editor, meta('ArrowRight'));
      expect(editor.state.selection.from).toBe($p.end());
    }
  });

  it('uses measured coordinates when layout is available', () => {
    const { editor } = makeEditor('hello world');
    editor.commands.setTextSelection(7);
    const { view } = editor;
    vi.spyOn(view, 'coordsAtPos').mockReturnValue({ left: 50, right: 50, top: 20, bottom: 38 });
    vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: 5, inside: -1 });
    const para = view.nodeDOM(0) as Element;
    vi.spyOn(para, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      right: 300,
      width: 290,
      top: 0,
      bottom: 50,
      height: 50,
      x: 10,
      y: 0,
      toJSON: () => ({}),
    });
    expect(press(editor, meta('ArrowLeft'))).toBe(true);
    expect(editor.state.selection.from).toBe(5);
    expect(view.posAtCoords).toHaveBeenCalledWith({ left: 11, top: 29 });
  });

  it('leaves NodeSelections to native handling', () => {
    const editor = breakDoc();
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 4)));
    expect(editor.state.selection).not.toBeInstanceOf(TextSelection);
    expect(press(editor, meta('ArrowLeft'))).toBeFalsy();
  });

  it('does not take Ctrl+Arrow (word jump stays native)', () => {
    const { editor } = makeEditor('hello world');
    editor.commands.setTextSelection(7);
    expect(press(editor, { key: 'ArrowLeft', ctrlKey: true })).toBeFalsy();
    expect(editor.state.selection.from).toBe(7);
  });
});
