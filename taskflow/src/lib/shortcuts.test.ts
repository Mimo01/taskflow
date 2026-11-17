import { describe, expect, it } from 'vitest';
import { NAV_SHORTCUTS, SHORTCUTS } from './shortcuts';

describe('shortcut registry: editor paste and trigger rows', () => {
  it('registers Paste as plain text', () => {
    const e = SHORTCUTS.find((s) => s.id === 'editor-paste-plain');
    expect(e?.defaultKey).toBe('editor:⌘⇧V');
    expect(e?.description).toBe('Paste as plain text');
    expect(e?.category).toBe('Editor');
    expect(e?.displayKeys).toEqual(['⌘', '⇧', 'V']);
  });

  it('registers informational trigger rows', () => {
    const rows = [
      ['editor-trigger-mention', 'Mention @', ['@']],
      ['editor-trigger-slash', 'Insert menu /', ['/']],
      ['editor-trigger-emoticon', 'Emoticon :', [':']],
      ['editor-submit', 'Submit editor or form', ['⌘', '↵']],
      ['editor-cancel', 'Cancel editing / leave editor', ['Esc']],
    ] as const;
    for (const [id, description, keys] of rows) {
      const e = SHORTCUTS.find((s) => s.id === id);
      expect(e?.description).toBe(description);
      expect(e?.category).toBe('Editor');
      expect(e?.displayKeys).toEqual(keys);
    }
  });

  it('keeps ids unique', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('shortcut registry: palette / find', () => {
  it('open-palette is Cmd+Shift+F', () => {
    const e = SHORTCUTS.find((s) => s.id === 'open-palette');
    expect(e?.defaultKey).toBe('mod+shift+f');
    expect(e?.displayKeys).toEqual(['⌘', '⇧', 'F']);
  });

  it('find-in-page is Cmd+F in General and not a nav shortcut', () => {
    const e = SHORTCUTS.find((s) => s.id === 'find-in-page');
    expect(e?.defaultKey).toBe('mod+f');
    expect(e?.displayKeys).toEqual(['⌘', 'F']);
    expect(e?.category).toBe('General');
    expect(NAV_SHORTCUTS.some((s) => s.id === 'find-in-page')).toBe(false);
  });

  it('no two entries share the same defaultKey', () => {
    const keys = SHORTCUTS.map((s) => s.defaultKey);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });
});

describe('shortcut registry: notifications', () => {
  it('toggle-notifications is Cmd+Shift+I and opens notifications from the palette', () => {
    const e = SHORTCUTS.find((s) => s.id === 'toggle-notifications');
    expect(e?.defaultKey).toBe('mod+shift+i');
    expect(e?.displayKeys).toEqual(['⌘', '⇧', 'I']);
    expect(NAV_SHORTCUTS.find((s) => s.id === 'toggle-notifications')?.navMeta.action).toBe(
      'open-notifications',
    );
  });
});
