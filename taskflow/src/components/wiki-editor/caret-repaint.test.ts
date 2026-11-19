import { TextSelection } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import { WikiCaretRepaint } from './caret-repaint';
import { editorExtensions } from './extensions';
import { makeEditor, typeText } from './test-utils';

function mounted(text: string, pos: number) {
  const { editor } = makeEditor(text, [...editorExtensions, WikiCaretRepaint]);
  document.body.appendChild(editor.view.dom);
  editor.view.focus();
  const v = editor.view;
  v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, pos)));
  const sel = document.getSelection() as Selection;
  // The plugin's layout flush; ProseMirror itself also calls removeAllRanges in jsdom.
  const spy = vi.spyOn(v.dom, 'getBoundingClientRect');
  return { editor, sel, spy };
}

describe('WikiCaretRepaint', () => {
  it('re-applies the DOM range when Enter moves the caret into a new block', () => {
    const { editor, sel, spy } = mounted('omo\n\nokoj', 4);
    editor.commands.enter();
    expect(spy).toHaveBeenCalledTimes(1);
    // Same model position afterwards: caret in the new empty paragraph.
    expect(editor.state.selection.$from.parent.content.size).toBe(0);
    expect(sel.rangeCount).toBe(1);
  });

  it('re-applies on Backspace joining two blocks', () => {
    const { editor, spy } = mounted('omo\n\nokoj', 6);
    editor.commands.keyboardShortcut('Backspace');
    expect(editor.getText()).toBe('omookoj');
    expect(spy).toHaveBeenCalled();
  });

  it('re-applies on Shift+Enter (hard break, same textblock)', () => {
    const { editor, spy } = mounted('omo\n\nokoj', 4);
    editor.commands.setHardBreak();
    editor.commands.setHardBreak();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('leaves plain typing alone', () => {
    const { editor, spy } = mounted('omo\n\nokoj', 4);
    typeText(editor, 'abc');
    expect(spy).not.toHaveBeenCalled();
  });
});
