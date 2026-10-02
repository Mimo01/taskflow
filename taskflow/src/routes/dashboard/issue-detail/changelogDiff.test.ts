import { describe, expect, it } from 'vitest';
import type { ChangelogHistory, TimelineEntry } from '@/services/jira';
import {
  classifyField,
  groupChangeBursts,
  mergeGroupItems,
  tokenSetDiff,
  wordDiff,
} from './changelogDiff';

describe('classifyField', () => {
  it('classifies by name', () => {
    expect(classifyField('description', null, 'x')).toBe('long');
    expect(classifyField('Summary', 'a', 'b')).toBe('long');
    expect(classifyField('environment', null, null)).toBe('long');
    expect(classifyField('status', 'a', 'b')).toBe('status');
    for (const f of [
      'labels',
      'Fix Version',
      'fixVersions',
      'Version',
      'Component',
      'Attachment',
      'Link',
    ]) {
      expect(classifyField(f, 'a', 'b')).toBe('multi');
    }
    expect(classifyField('Sprint', 'S1, S2', 'S3')).toBe('multi');
    expect(classifyField('Sprint', 'S1', 'S2')).toBe('short');
    expect(classifyField('priority', 'a', 'b')).toBe('short');
    expect(classifyField('assignee', null, 'Bob')).toBe('short');
    expect(classifyField('Story Points', '1', '2')).toBe('short');
    expect(classifyField('timespent', '60', '120')).toBe('duration');
  });
  it('classifies unknown fields by value', () => {
    expect(classifyField('Custom', 'a\nb', 'c')).toBe('long');
    expect(classifyField('Custom', null, 'x'.repeat(121))).toBe('long');
    expect(classifyField('Custom', null, null)).toBe('short');
  });
});

describe('tokenSetDiff', () => {
  it('diffs labels', () => {
    expect(tokenSetDiff('labels', 'a b c', 'b c d')).toEqual({ added: ['d'], removed: ['a'] });
  });
  it('diffs sprints', () => {
    expect(tokenSetDiff('Sprint', 'S1, S2', 'S2, S3')).toEqual({ added: ['S3'], removed: ['S1'] });
  });
  it('handles per-value items and nulls', () => {
    expect(tokenSetDiff('Fix Version', null, '1.2')).toEqual({ added: ['1.2'], removed: [] });
    expect(tokenSetDiff('labels', null, null)).toEqual({ added: [], removed: [] });
  });
  it('drops duplicates and blanks', () => {
    expect(tokenSetDiff('Sprint', null, 'S1, , S1').added).toEqual(['S1']);
  });
});

describe('wordDiff', () => {
  it('counts words', () => {
    const r = wordDiff('Login fails when token expires', 'Login fails when session expires');
    expect(r.addedWords).toBe(1);
    expect(r.removedWords).toBe(1);
    expect(
      r.parts.some((p) => !p.added && !p.removed && p.value.includes('Login fails when')),
    ).toBe(true);
    expect(r.fallback).toBe(false);
  });
  it('detects whitespace-only changes and normalises CRLF', () => {
    const r = wordDiff('a b\r\nc', 'a  b\nc');
    expect(r.whitespaceOnly).toBe(true);
    expect(r.addedWords).toBe(0);
    expect(r.removedWords).toBe(0);
  });
  it('falls back when edit length exceeded', () => {
    const r = wordDiff('one two three four five', 'six seven eight nine ten', 1);
    expect(r.fallback).toBe(true);
    expect(r.parts).toEqual([
      { value: 'one two three four five', removed: true },
      { value: 'six seven eight nine ten', added: true },
    ]);
    expect(r.addedWords).toBe(5);
    expect(r.removedWords).toBe(5);
  });
});

function hist(
  id: string,
  created: string,
  author = 'alice',
  items: Array<Record<string, string | null>> = [],
): ChangelogHistory {
  return { id, created, author: { displayName: author, name: author }, items } as never;
}
const change = (h: ChangelogHistory): TimelineEntry => ({
  type: 'change',
  timestamp: h.created,
  data: h,
});
const T = (min: number) => new Date(Date.UTC(2026, 0, 1, 10, min)).toISOString();

describe('groupChangeBursts', () => {
  it('groups same author within window', () => {
    const r = groupChangeBursts([change(hist('1', T(0))), change(hist('2', T(3)))]);
    expect(r).toHaveLength(1);
    const g = r[0];
    expect(g.type === 'change-group' && g.histories.length).toBe(2);
  });
  it('splits on comment, author, or gap', () => {
    const comment = {
      type: 'comment',
      timestamp: T(1),
      data: { id: 'c' },
    } as unknown as TimelineEntry;
    expect(
      groupChangeBursts([change(hist('1', T(0))), comment, change(hist('2', T(2)))]),
    ).toHaveLength(3);
    expect(
      groupChangeBursts([change(hist('1', T(0))), change(hist('2', T(1), 'bob'))]),
    ).toHaveLength(2);
    expect(groupChangeBursts([change(hist('1', T(0))), change(hist('2', T(6)))])).toHaveLength(2);
  });
  it('chains by adjacent gap, in either order', () => {
    const list = [change(hist('1', T(0))), change(hist('2', T(4))), change(hist('3', T(8)))];
    expect(groupChangeBursts(list)).toHaveLength(1);
    expect(groupChangeBursts([...list].reverse())).toHaveLength(1);
  });
  it('never merges invalid timestamps', () => {
    const r = groupChangeBursts([change(hist('1', 'bad')), change(hist('2', 'bad'))]);
    expect(r).toHaveLength(2);
  });
});

describe('mergeGroupItems', () => {
  it('merges multi-value items across histories', () => {
    const h1 = hist('1', T(0), 'alice', [
      { field: 'Fix Version', fromString: null, toString: '1.0' },
    ]);
    const h2 = hist('2', T(1), 'alice', [
      { field: 'Fix Version', fromString: '2.0', toString: null },
    ]);
    const r = mergeGroupItems([h2, h1]);
    expect(r).toHaveLength(1);
    expect(r[0].added).toEqual(['1.0']);
    expect(r[0].removed).toEqual(['2.0']);
  });
  it('collapses repeated short fields chronologically', () => {
    const h1 = hist('1', T(0), 'alice', [{ field: 'priority', fromString: 'A', toString: 'B' }]);
    const h2 = hist('2', T(1), 'alice', [{ field: 'priority', fromString: 'B', toString: 'C' }]);
    const r = mergeGroupItems([h2, h1]);
    expect(r).toHaveLength(1);
    expect(r[0].from).toBe('A');
    expect(r[0].to).toBe('C');
  });
  it('keeps distinct fields in first-seen order with unique keys', () => {
    const h = hist('1', T(0), 'alice', [
      { field: 'priority', fromString: 'A', toString: 'B' },
      { field: 'assignee', fromString: null, toString: 'Bob' },
    ]);
    const r = mergeGroupItems([h]);
    expect(r.map((x) => x.field)).toEqual(['priority', 'assignee']);
    expect(new Set(r.map((x) => x.key)).size).toBe(2);
  });
});
