import { describe, expect, it } from 'vitest';
import { looksLikeWiki } from './wiki-text';

describe('looksLikeWiki', () => {
  it.each([
    'h2. Title\nbody',
    '{code}\nx\n{code}',
    '{noformat}a{noformat}',
    '{info}x{info}',
    '{color:red}x{color}',
    '||a||b||\n|1|2|',
    'bq. quoted',
    'ping [~jdoe] please',
    'see [^report.pdf]',
    '!diagram.png!',
    'above\n----\nbelow',
    '* one\n* two\nsome *bold* text',
    '*bold* and _italic_',
  ])('accepts %j', (text) => {
    expect(looksLikeWiki(text)).toBe(true);
  });

  it.each([
    '*',
    '-',
    '#',
    'a * b',
    '*bold*',
    '# Title',
    '- item',
    '**x**',
    '**x** and **y**',
    'plain sentence.',
    '10:30 meeting',
    'https://example.invalid/a_b_c',
    'x || y',
  ])('rejects %j', (text) => {
    expect(looksLikeWiki(text)).toBe(false);
  });

  it('rejects text over 200000 characters', () => {
    expect(looksLikeWiki(`h2. Title\n${'x'.repeat(200_000)}`)).toBe(false);
  });
});
