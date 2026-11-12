import { describe, expect, it } from 'vitest';
import * as S from './__fixtures__/samples';
import { parseReleaseNotes, summarizeNotes } from './parse';

describe('parseReleaseNotes', () => {
  it('V1: Added + bold title/detail', () => {
    const p = parseReleaseNotes(S.V1_ADDED_FIXED);
    expect(p.structured).toBe(true);
    expect(p.sections.map((s) => s.kind)).toEqual(['new', 'fixed']);
    expect(p.sections[0].items[0]).toMatchObject({
      title: 'Quick filter',
      detail: 'narrows the list as you type, across all columns',
    });
  });

  it('V2: keeps an inner em dash in the title', () => {
    const it = parseReleaseNotes(S.V2_INNER_DASH).sections[0].items[0];
    expect(it.title).toBe('Board — time-in-column badge');
    expect(it.detail).toBe('each card shows how long it has been there');
  });

  it('V3: whole text is the title, no detail', () => {
    const it = parseReleaseNotes(S.V3_NO_SEPARATOR).sections[0].items[0];
    expect(it.title).toBe('**Dashboard greeting** now handles long display names');
    expect(it.detail).toBeNull();
  });

  it('V4: colon title and nested children', () => {
    const it = parseReleaseNotes(S.V4_NESTED).sections[0].items[0];
    expect(it.title).toBe('Issue detail — redesigned Changes tab');
    expect(it.detail).toBeNull();
    expect(it.children.map((c) => c.title)).toEqual(['Grouping', 'Colours']);
    expect(it.children[0].detail).toBe('entries are grouped by day');
  });

  it('V5/V8: plain bullets directly after a heading', () => {
    const p = parseReleaseNotes(S.V5_PLAIN_NO_BLANK);
    expect(p.sections[0].kind).toBe('fixed');
    expect(p.sections[0].items.map((i) => i.title)).toEqual([
      'Worklogs: entry actions no longer overlap the row',
      'Backlog: the empty state is centred',
    ]);
  });

  it('V6: lead paragraph becomes headline', () => {
    const p = parseReleaseNotes(S.V6_LEAD_PARAGRAPH);
    expect(p.headline).toBe('Performance overhaul: every view now feels instant.');
    expect(p.sections[0].kind).toBe('new');
  });

  it('V13: leading newline', () => {
    const p = parseReleaseNotes(S.V13_LEADING_NEWLINE);
    expect(p.headline).toBe('Short lead sentence.');
  });

  it('V7: lead + unheaded bullets go in one implicit section', () => {
    const p = parseReleaseNotes(S.V7_LEAD_PLUS_BULLETS);
    expect(p.headline).toBe('A small maintenance release.');
    expect(p.sections).toHaveLength(1);
    expect(p.sections[0]).toMatchObject({ kind: 'other', label: null });
    expect(p.sections[0].items).toHaveLength(2);
  });

  it('V10: unheaded groups separated by blank lines', () => {
    const p = parseReleaseNotes(S.V10_STRIPPED_HEADINGS);
    expect(p.sections).toHaveLength(1);
    expect(p.sections[0].items).toHaveLength(3);
  });

  it('V9: h2 headings', () => {
    const p = parseReleaseNotes(S.V9_H2);
    expect(p.sections.map((s) => s.kind)).toEqual(['new', 'fixed']);
  });

  it('maps heading synonyms and keeps unknown labels', () => {
    const p = parseReleaseNotes(
      '### Changed\n- a\n### Improved\n- b\n### Bug fixes\n- c\n### Deprecated\n- d\n### Security\n- e\n### Misc stuff\n- f',
    );
    expect(p.sections.map((s) => s.kind)).toEqual([
      'improved',
      'improved',
      'fixed',
      'removed',
      'security',
      'other',
    ]);
    expect(p.sections[5].label).toBe('Misc stuff');
  });

  it('V11: lowercase commit subjects', () => {
    const p = parseReleaseNotes(S.V11_COMMIT_SUBJECTS);
    expect(p.sections[0].items.map((i) => i.title)).toEqual([
      'fix: handle empty list',
      'feat: add small option',
      'chore: tidy imports',
    ]);
  });

  it('V12: prose with trailer is unstructured, trailer dropped', () => {
    const p = parseReleaseNotes(S.V12_PROSE_TRAILER);
    expect(p.structured).toBe(false);
    expect(p.raw).not.toMatch(/Co-Authored-By/i);
    expect(p.raw).toContain('Fix the thing');
  });

  it('V14: empty and null', () => {
    for (const v of [S.V14_EMPTY, null, undefined]) {
      const p = parseReleaseNotes(v);
      expect(p.structured).toBe(false);
      expect(p.raw).toBe('');
    }
  });

  it('V15: version heading skipped', () => {
    const p = parseReleaseNotes(S.V15_VERSION_HEADING);
    expect(p.sections).toHaveLength(1);
    expect(p.sections[0].items).toHaveLength(1);
    expect(p.sections[0].items[0].title).toBe('New feature');
  });

  it('V16: inline code with braces preserved', () => {
    const it = parseReleaseNotes(S.V16_INLINE_CODE).sections[0].items[0];
    expect(it.title).toBe('Literal `{{monospace}}` handling');
    expect(it.detail).toBe('keeps braces intact');
  });

  it('parses the approved example', () => {
    const p = parseReleaseNotes(S.APPROVED_EXAMPLE);
    expect(p.headline).toBe('Notifications got a full redesign.');
    expect(p.sections.map((s) => s.kind)).toEqual(['new', 'improved', 'fixed']);
    expect(p.sections[0].items[0]).toMatchObject({
      title: 'Notification panel',
      detail: 'stacks per issue, quick actions',
    });
  });

  it('strips a trailing dot from titles', () => {
    expect(parseReleaseNotes('### Fixed\n- **A fix.**').sections[0].items[0].title).toBe('A fix');
  });

  it('does not merge two bold spans into one title', () => {
    const it = parseReleaseNotes('- **A** and **B** — c').sections[0].items[0];
    expect(it.title).toBe('**A** and **B** — c');
  });
});

describe('summarizeNotes', () => {
  it('prefers headline, then first title, then first raw line, else null', () => {
    expect(summarizeNotes(parseReleaseNotes(S.APPROVED_EXAMPLE))).toBe(
      'Notifications got a full redesign.',
    );
    expect(summarizeNotes(parseReleaseNotes(S.V1_ADDED_FIXED))).toBe('Quick filter');
    expect(summarizeNotes(parseReleaseNotes(S.V12_PROSE_TRAILER))).toBe(
      'Fix the thing that was broken in the sidebar and polish the spacing.',
    );
    expect(summarizeNotes(parseReleaseNotes(''))).toBeNull();
  });
});
