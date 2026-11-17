import { describe, expect, it } from 'vitest';
import { classifyFile, clipboardImageName, stagedFileName } from './upload-state';

const now = new Date(2026, 10, 17, 9, 5, 3);

describe('clipboardImageName', () => {
  it('names nameless png', () =>
    expect(clipboardImageName({ name: '', type: 'image/png' }, now, new Set())).toBe(
      'image-20261117-090503.png',
    ));
  it('generic image.png renamed, jpeg -> jpg, unknown -> png', () => {
    expect(clipboardImageName({ name: 'image.png', type: 'image/jpeg' }, now, new Set())).toBe(
      'image-20261117-090503.jpg',
    );
    expect(clipboardImageName({ name: '', type: 'image/x-foo' }, now, new Set())).toBe(
      'image-20261117-090503.png',
    );
  });
  it('collisions get -2/-3', () => {
    const taken = new Set(['image-20261117-090503.png']);
    const f = { name: '', type: 'image/png' };
    expect(clipboardImageName(f, now, taken)).toBe('image-20261117-090503-2.png');
    taken.add('image-20261117-090503-2.png');
    expect(clipboardImageName(f, now, taken)).toBe('image-20261117-090503-3.png');
  });
  it('keeps real names', () =>
    expect(clipboardImageName({ name: 'Screen Shot.png', type: 'image/png' }, now, new Set())).toBe(
      'Screen Shot.png',
    ));
});

describe('classifyFile', () => {
  it('classifies', () => {
    expect(classifyFile({ name: 'scan.PNG', type: 'application/octet-stream' })).toBe('image');
    expect(classifyFile({ name: 'report.pdf', type: 'application/pdf' })).toBe('file');
    expect(classifyFile({ name: 'x.bin', type: 'image/webp' })).toBe('image');
  });
});

describe('stagedFileName', () => {
  it('strips hazards and dedupes keeping extension', () => {
    expect(stagedFileName({ name: 'a|b!.png' }, new Set())).toBe('ab.png');
    expect(stagedFileName({ name: 'a|b!.png' }, new Set(['ab.png']))).toBe('ab-2.png');
  });
});
