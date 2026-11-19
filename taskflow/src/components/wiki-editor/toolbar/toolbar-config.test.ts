import { describe, expect, it } from 'vitest';
import {
  itemsWidth,
  splitToolbar,
  TOOLBAR_ITEMS,
  TOOLBAR_PX,
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

  it('keeps everything inline with the Insert label when it all fits', () => {
    const all = itemsWidth(
      TOOLBAR_ITEMS.filter((i) => i.presets.includes('full')).map((i) => i.id),
    );
    expect(splitToolbar('full', all + TOOLBAR_PX.insertLabel)).toMatchObject({
      overflow: [],
      showInsertLabel: true,
    });
    expect(splitToolbar('full', all)).toMatchObject({ overflow: [], showInsertLabel: false });
    expect(splitToolbar('full', all - 1).overflow).toEqual(['subsup']);
  });

  it('shows sub/sup inline at ~620px of items room (full preset)', () => {
    const { inline, overflow } = splitToolbar('full', 620);
    expect(overflow).toEqual([]);
    expect(inline).toContain('subsup');
  });

  it('splits full preset in OVERFLOW_ORDER', () => {
    const small = splitToolbar('full', 200);
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
    // Text style 98 + divider 13 + Bold/Italic 2x28 + gaps 8, beside More + the link anchor.
    expect(splitToolbar('full', 175 + TOOLBAR_PX.moreBlock + TOOLBAR_PX.linkAnchor).inline).toEqual(
      ['text-style', 'bold', 'italic', 'insert'],
    );
    const mid = splitToolbar('full', 300).overflow;
    expect(mid[0]).toBe('subsup');
    expect(mid).not.toContain('italic');
  });

  it('uses the measured Text style width', () => {
    const narrow = splitToolbar('full', 400, { textStylePx: 70 }).overflow;
    const wide = splitToolbar('full', 400, { textStylePx: 140 }).overflow;
    expect(wide.length).toBeGreaterThan(narrow.length);
  });

  it('splits compact preset', () => {
    expect(splitToolbar('compact', 40).overflow).toEqual([
      'strike',
      'mono',
      'bullet',
      'numbered',
      'underline',
      'italic',
    ]);
    expect(splitToolbar('compact', 800).overflow).toEqual([]);
  });

  // The inline set must fit the room left after the More block (and link anchor) at every width.
  it('every inline set fits the items region at every room width', () => {
    for (const preset of ['full', 'compact'] as ToolbarPreset[]) {
      // Floor: what never overflows (full: Text style + Bold, Link in More; compact: Bold +
      // Link inline) + the More block.
      const minimum =
        preset === 'full'
          ? 143 + TOOLBAR_PX.moreBlock + TOOLBAR_PX.linkAnchor
          : 73 + TOOLBAR_PX.moreBlock;
      for (let c = minimum; c <= 900; c++) {
        const { inline, overflow, showInsertLabel } = splitToolbar(preset, c);
        let room = c;
        if (overflow.length > 0) room -= TOOLBAR_PX.moreBlock;
        if (overflow.includes('link')) room -= TOOLBAR_PX.linkAnchor;
        if (showInsertLabel) room -= TOOLBAR_PX.insertLabel;
        expect(room, `${preset} @${c}`).toBeGreaterThanOrEqual(itemsWidth(inline));
        if (showInsertLabel) expect(overflow).toEqual([]);
      }
    }
  });

  it('never overflows more than needed (dropping the last overflowed item would not fit)', () => {
    for (let c = 192; c <= 900; c++) {
      const { inline, overflow } = splitToolbar('full', c);
      if (overflow.length === 0) continue;
      const back = [...inline, overflow[overflow.length - 1] as (typeof inline)[number]];
      const rest = overflow.slice(0, -1);
      let room = c - (rest.length > 0 ? TOOLBAR_PX.moreBlock : 0);
      if (rest.includes('link')) room -= TOOLBAR_PX.linkAnchor;
      expect(itemsWidth(back), `full @${c}`).toBeGreaterThan(room);
    }
  });

  it('never includes a mode item', () => {
    expect(TOOLBAR_ITEMS.some((i) => i.id.startsWith('mode'))).toBe(false);
  });
});
