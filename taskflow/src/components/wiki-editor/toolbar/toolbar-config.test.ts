import { describe, expect, it } from 'vitest';
import {
  INLINE_CLASS,
  INSERT_LABEL_CLASS,
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
    expect(splitToolbar('full', 700).overflow).toEqual(['subsup']);
    const small = splitToolbar('full', 360);
    expect(small.overflow).toEqual([
      'subsup',
      'strike',
      'mono',
      'quote',
      'colour',
      'link',
      'numbered',
      'bullet',
      'underline',
      'italic',
    ]);
    expect(small.inline).toEqual(['text-style', 'bold', 'insert']);
    expect(splitToolbar('full', 420).inline).toEqual(['text-style', 'bold', 'italic', 'insert']);
    const mid = splitToolbar('full', 446).overflow;
    expect(mid).toContain('bullet');
    expect(mid).not.toContain('underline');
    const wide = splitToolbar('full', 556).overflow;
    expect(wide[wide.length - 1]).toBe('colour');
  });

  it('splits compact preset', () => {
    expect(splitToolbar('compact', 300).overflow).toEqual([
      'strike',
      'mono',
      'bullet',
      'numbered',
      'underline',
      'italic',
    ]);
    expect(splitToolbar('compact', 360).overflow).toEqual([
      'strike',
      'mono',
      'bullet',
      'numbered',
      'underline',
    ]);
    expect(splitToolbar('compact', 800).overflow).toEqual([]);
  });

  // Measured in WebKit (98 UAT round 2): pinned controls 214px (+37 Insert label, -4 inline Link,
  // -32 empty More, +13 More|Insert divider while More shows), buttons 28px + 4px gap,
  // Text style 98px, divider 13px.
  it('every inline set fits the items region from 372px (full) / 358px (compact)', () => {
    const W: Record<string, number> = { 'text-style': 98, subsup: 60 };
    const LIST = ['bullet', 'numbered', 'quote', 'link'];
    for (const preset of ['full', 'compact'] as ToolbarPreset[]) {
      const widest = Math.max(...Object.values(OVERFLOW_BREAKPOINTS[preset]).map(Number));
      const from = preset === 'full' ? 372 : 358;
      for (let c = from; c <= 900; c++) {
        const { inline, overflow } = splitToolbar(preset, c);
        const items = inline.filter((i) => i !== 'insert');
        const buttons = items.reduce((n, i) => n + (i === 'subsup' ? 2 : 1), 0);
        let need = items.reduce((n, i) => n + (W[i] ?? 28), 0) + 4 * (buttons - 1);
        if (items.includes('text-style')) need += 13;
        if (items.some((i) => LIST.includes(i))) need += 13;
        let pinned = 214 + (c >= widest ? 37 : 0);
        if (!overflow.includes('link')) pinned -= 4;
        if (overflow.length === 0) pinned -= 32;
        else pinned += 13;
        expect(c - pinned, `${preset} @${c}`).toBeGreaterThanOrEqual(need);
      }
    }
  });

  it('shows the Insert label only from the widest breakpoint', () => {
    for (const preset of ['full', 'compact'] as ToolbarPreset[]) {
      const widest = Math.max(...Object.values(OVERFLOW_BREAKPOINTS[preset]).map(Number));
      expect(INSERT_LABEL_CLASS[preset]).toBe(`hidden @[${widest / 16}rem]:inline`);
    }
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
