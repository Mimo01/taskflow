import { describe, expect, it } from 'vitest';
import { NAV_SHORTCUTS, SHORTCUTS } from './shortcuts';

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
