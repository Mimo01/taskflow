import { describe, expect, it } from 'vitest';
import { labelPillColors, parseHex, pillContrast } from './labelColor';

describe('labelPillColors', () => {
  const samples = [
    '#428BCA',
    '#D9534F',
    '#5CB85C',
    '#F0AD4E',
    '#FFECDB',
    '#330066',
    '#fff',
    '#000',
  ];

  it('text meets 4.5:1 on the tint in both themes for varied label colours', () => {
    for (const hex of samples) {
      const [light, dark] = pillContrast(hex) as [number, number];
      expect(light, `${hex} light`).toBeGreaterThanOrEqual(4.5);
      expect(dark, `${hex} dark`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps a mid colour recognisably itself and shifts very light/dark ones', () => {
    expect(labelPillColors('#428BCA').base).toBe('#428bca');
    // very light colour: light-theme text is much darker than the label
    const light = parseHex(labelPillColors('#FFECDB').light) as number[];
    expect(Math.max(...light)).toBeLessThan(200);
    // very dark colour: dark-theme text is much lighter than the label
    const dark = parseHex(labelPillColors('#330066').dark) as number[];
    expect(Math.max(...dark)).toBeGreaterThan(150);
  });

  it('expands short hex and falls back to greys for junk', () => {
    expect(parseHex('#fa0')).toEqual([255, 170, 0]);
    expect(labelPillColors('not-a-colour').base).toBe('#888888');
    expect(pillContrast('nope')).toBeNull();
  });
});
