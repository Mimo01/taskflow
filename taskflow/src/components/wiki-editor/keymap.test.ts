import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '@/lib/shortcuts';
import { WIKI_KEYMAP_KEYS } from './keymap';
import { makeEditor, saveText } from './test-utils';

function press(
  editor: ReturnType<typeof makeEditor>['editor'],
  init: KeyboardEventInit & { keyCode?: number },
) {
  const { view } = editor;
  const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  if (init.keyCode) Object.defineProperty(ev, 'keyCode', { value: init.keyCode });
  return view.someProp('handleKeyDown', (f) => f(view, ev));
}
const saved = (
  e: ReturnType<typeof makeEditor>['editor'],
  l: ReturnType<typeof makeEditor>['load'],
) => {
  const s = saveText(e, l);
  return s.kind === 'saved' ? s.text : s.kind;
};
function select(text: string) {
  const m = makeEditor(text);
  m.editor.commands.setTextSelection({ from: 1, to: 1 + text.length });
  return m;
}

describe('keymap', () => {
  it.each([
    [{ key: 'x', ctrlKey: true, shiftKey: true, keyCode: 88 }, '-word-'],
    [{ key: 'e', ctrlKey: true, keyCode: 69 }, '{{word}}'],
    [{ key: '>', ctrlKey: true, shiftKey: true, keyCode: 190 }, '^word^'],
    [{ key: '<', ctrlKey: true, shiftKey: true, keyCode: 188 }, '~word~'],
    [{ key: 'b', ctrlKey: true, keyCode: 66 }, '*word*'],
    [{ key: 'i', ctrlKey: true, keyCode: 73 }, '_word_'],
    [{ key: 'u', ctrlKey: true, keyCode: 85 }, '+word+'],
  ])('%j toggles', (init, expected) => {
    const { editor, load } = select('word');
    expect(press(editor, init)).toBe(true);
    expect(saved(editor, load)).toBe(expected);
  });

  it('swallows Mod-Shift-s', () => {
    const { editor, load } = select('word');
    expect(press(editor, { key: 's', ctrlKey: true, shiftKey: true, keyCode: 83 })).toBe(true);
    expect(saved(editor, load)).toBe('unchanged');
  });

  it('quote and lists by keyboard', () => {
    const q = select('word');
    press(q.editor, { key: 'b', ctrlKey: true, shiftKey: true, keyCode: 66 });
    expect(q.editor.isActive('blockquote')).toBe(true);
    const b = select('word');
    press(b.editor, { key: '*', ctrlKey: true, shiftKey: true, keyCode: 56 });
    expect(b.editor.isActive('bulletList')).toBe(true);
    const o = select('word');
    press(o.editor, { key: '&', ctrlKey: true, shiftKey: true, keyCode: 55 });
    expect(o.editor.isActive('orderedList')).toBe(true);
  });

  it('undo and redo', () => {
    const { editor } = select('word');
    editor.commands.toggleBold();
    press(editor, { key: 'z', ctrlKey: true, keyCode: 90 });
    expect(editor.isActive('bold')).toBe(false);
    press(editor, { key: 'z', ctrlKey: true, shiftKey: true, keyCode: 90 });
    expect(editor.getHTML()).toContain('<strong>');
  });

  it('registry entries are bound', () => {
    const editorShortcuts = SHORTCUTS.filter((s) => s.category === 'Editor');
    expect(editorShortcuts.length).toBeGreaterThan(0);
    // Registered chords handled by this keymap or by StarterKit/UndoRedo; link and source toggle live in the frame.
    const mine = new Set(
      WIKI_KEYMAP_KEYS.map((k) => k.replace('Mod-Shift-', '⌘⇧').replace('Mod-', '⌘').toUpperCase()),
    );
    for (const k of ['⌘⇧X', '⌘E', '⌘⇧.', '⌘⇧,', '⌘⇧B']) expect(mine.has(k)).toBe(true);
  });
});
