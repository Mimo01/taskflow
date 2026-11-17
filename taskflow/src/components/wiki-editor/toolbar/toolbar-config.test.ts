import { describe, expect, it } from 'vitest';
import {
  INLINE_CLASS,
  OVERFLOW_BREAKPOINTS,
  splitToolbar,
  TOOLBAR_ITEMS,
  type ToolbarPreset,
} from './toolbar-config';

describe('toolbar-config', () => {
  it('defines preset membership', () => {
    const compact = TOOLBAR_ITEMS.filter((i) => i.presets.includes('compact')).map((i) => i.id);
    expect(compact).toEqual([
      'bold',
      'italic',
      'underline',
      'strike',
      'mono',
      'bullet',
      'numbered',
      'link',
      'insert',
    ]);
    expect(TOOLBAR_ITEMS.filter((i) => i.presets.includes('full'))).toHaveLength(13);
  });

  it('splits full preset by width', () => {
    expect(splitToolbar('full', 800).overflow).toEqual([]);
    expect(splitToolbar('full', 600).overflow[0]).toBe('subsup');
    const small = splitToolbar('full', 360);
    expect(small.overflow).toEqual(['subsup', 'strike', 'mono', 'quote', 'colour', 'link']);
    for (const id of ['text-style', 'bold', 'italic', 'insert'] as const) {
      expect(small.inline).toContain(id);
    }
  });

  it('splits compact preset', () => {
    expect(splitToolbar('compact', 360).overflow).toEqual(['strike', 'mono', 'bullet', 'numbered']);
    expect(splitToolbar('compact', 800).overflow).toEqual([]);
  });

  it('never includes a mode item', () => {
    expect(TOOLBAR_ITEMS.some((i) => i.id.startsWith('mode'))).toBe(false);
  });

  it('keeps INLINE_CLASS consistent with OVERFLOW_BREAKPOINTS', () => {
    for (const preset of ['full', 'compact'] as ToolbarPreset[]) {
      for (const [id, px] of Object.entries(OVERFLOW_BREAKPOINTS[preset])) {
        const cls = (INLINE_CLASS[preset] as Record<string, string>)[id];
        expect(cls).toBe(`hidden @[${(px as number) / 16}rem]:inline-flex`);
      }
    }
  });
});
