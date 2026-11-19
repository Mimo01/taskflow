import { describe, expect, it } from 'vitest';
import { lineRangeOf, outlineShape, sideBySide } from './editor-log-view';

describe('sideBySide', () => {
  it('pairs unchanged lines and aligns a replaced line with its replacement', () => {
    const rows = sideBySide('a\nb\nc\n', 'a\nB\nc\n');
    expect(rows.map((r) => [r.left?.text, r.left?.kind, r.right?.text, r.right?.kind])).toEqual([
      ['a', 'same', 'a', 'same'],
      ['b', 'removed', 'B', 'added'],
      ['c', 'same', 'c', 'same'],
    ]);
  });

  it('leaves a gap on the side that has no line', () => {
    const rows = sideBySide('a\nc', 'a\nb\nc');
    expect(rows[1]).toEqual({ left: null, right: { n: 2, text: 'b', kind: 'added' } });
    expect(rows[2]?.left?.n).toBe(2);
    expect(rows[2]?.right?.n).toBe(3);
  });
});

describe('lineRangeOf', () => {
  it('finds the 1-based line range of a block inside the text', () => {
    expect(lineRangeOf('intro\n\n* one\n* two\n\nend', '* one\n* two\n')).toEqual([3, 4]);
  });
  it('skips the blank lines a parser slice carries before the block', () => {
    expect(lineRangeOf('intro\n\nh1. hello\n\nend', '\n\nh1. hello')).toEqual([3, 3]);
  });
  it('anchors on the gaps so an identical earlier line is not matched', () => {
    expect(lineRangeOf('x\ny\n\nx\n\nz', '\n\nx\n')).toEqual([4, 4]);
  });
  it('returns null when absent or empty', () => {
    expect(lineRangeOf('abc', 'zzz')).toBeNull();
    expect(lineRangeOf('abc', null)).toBeNull();
  });
});

describe('outlineShape', () => {
  it('puts one inline token per line with its marks', () => {
    expect(
      outlineShape({
        type: 'heading',
        level: 1,
        inline: [{ text: 'Hi ', marks: '' }, { text: 'there', marks: 'strong|em' }, { br: [] }],
      }),
    ).toBe('heading level=1\n  "Hi "\n  "there"  [strong, em]\n  ⏎ line break');
  });
  it('outlines list items', () => {
    expect(
      outlineShape({ type: 'bulletList', items: [[{ inline: [{ text: 'x', marks: '' }] }]] }),
    ).toBe('bulletList\n  item 1\n    "x"');
  });
  it('says when there is no block', () => {
    expect(outlineShape(null)).toBe('(nothing at this position)');
  });
});
