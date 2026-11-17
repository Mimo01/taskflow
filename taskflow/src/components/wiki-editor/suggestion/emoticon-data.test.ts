import { describe, expect, it } from 'vitest';
import { JIRA_EMOTICON_MAP, JIRA_EMOTICON_TOKENS } from '@/lib/wiki/preprocess';
import { EMOTICONS, emoticonGlyph } from './emoticon-data';

describe('emoticon data', () => {
  it('mirrors the token and glyph tables in order', () => {
    expect(EMOTICONS.map((e) => e.token)).toEqual([...JIRA_EMOTICON_TOKENS]);
    EMOTICONS.forEach((e, i) => {
      expect(e.glyph).toBe(JIRA_EMOTICON_MAP[i]?.[1]);
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.keywords.length).toBeGreaterThan(0);
    });
  });
  it('looks glyphs up by token', () => {
    expect(emoticonGlyph('(/)')).toBe('✅');
    expect(emoticonGlyph('(nope)')).toBeUndefined();
  });
});
