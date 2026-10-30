import { describe, expect, it } from 'vitest';
import type { JiraFixVersion } from '@/services/jira';
import {
  buildAgenda,
  dateStamp,
  releaseCountdown,
  releaseSummary,
  spanLabel,
} from './release-agenda';

const TODAY = '2026-10-29';

const v = (id: string, released: boolean, releaseDate?: string): JiraFixVersion => ({
  id,
  name: `Standard ${id}`,
  released,
  releaseDate,
});

const fixture = [
  v('U', false),
  v('O1', false, '2026-10-20'),
  v('R2', true, '2026-10-06'),
  v('R1', true, '2026-10-13'),
  v('E', false, '2027-01-12'),
  v('A', false, '2026-11-03'),
  v('D', false, '2026-12-08'),
  v('B', false, '2026-11-05'),
  v('C', false, '2026-11-10'),
];

describe('releaseCountdown', () => {
  it('undated is amber', () => {
    expect(releaseCountdown(undefined, TODAY)).toEqual({ tone: 'amber', label: 'No date' });
  });
  it('overdue plural and singular', () => {
    expect(releaseCountdown('2026-10-20', TODAY)).toEqual({ tone: 'red', label: '9 days late' });
    expect(releaseCountdown('2026-10-28', TODAY)).toEqual({ tone: 'red', label: '1 day late' });
  });
  it('today and tomorrow', () => {
    expect(releaseCountdown(TODAY, TODAY)).toEqual({ tone: 'blue', label: 'Today' });
    expect(releaseCountdown('2026-10-30', TODAY)).toEqual({ tone: 'muted', label: 'Tomorrow' });
  });
  it('days under 14, weeks from 14', () => {
    expect(releaseCountdown('2026-11-03', TODAY).label).toBe('In 5 days');
    expect(releaseCountdown('2026-11-11', TODAY).label).toBe('In 13 days');
    expect(releaseCountdown('2026-11-12', TODAY).label).toBe('In 2 weeks');
    expect(releaseCountdown('2026-11-22', TODAY).label).toBe('In 3 weeks');
    expect(releaseCountdown('2026-12-03', TODAY).label).toBe('In 5 weeks');
  });
});

describe('dateStamp', () => {
  it('formats day, weekday and inline', () => {
    expect(dateStamp('2026-11-03')).toEqual({
      day: '03 Nov',
      weekday: 'Tue',
      inline: 'Tue 03 Nov',
    });
  });
  it('never uses Sept', () => {
    expect(dateStamp('2026-09-08').day).toBe('08 Sep');
  });
});

describe('buildAgenda', () => {
  const agenda = buildAgenda(fixture, TODAY);
  const shape = agenda.entries.map((e) =>
    e.type === 'release'
      ? `release:${e.version.id}`
      : e.type === 'month'
        ? `month:${e.label}`
        : e.type === 'section'
          ? `section:${e.label}:${e.count}`
          : `today:${e.date}`,
  );

  it('orders overdue, TODAY, months, then the No date section', () => {
    expect(shape).toEqual([
      'release:O1',
      'today:2026-10-29',
      'month:November',
      'release:A',
      'release:B',
      'release:C',
      'month:December',
      'release:D',
      'month:January 2027',
      'release:E',
      'section:No date:1',
      'release:U',
    ]);
  });
  it('exposes next, near and released newest first', () => {
    expect(agenda.nextId).toBe('A');
    expect(agenda.nearId).toBe('B');
    expect(agenda.released.map((r) => r.id)).toEqual(['R1', 'R2']);
  });
  it('kinds, quiet and pill flags', () => {
    const rel = (id: string) =>
      agenda.entries.find((e) => e.type === 'release' && e.version.id === id);
    expect(rel('O1')).toMatchObject({ kind: 'overdue', pill: true, quiet: false });
    expect(rel('A')).toMatchObject({ kind: 'next', pill: true, quiet: false });
    expect(rel('B')).toMatchObject({ kind: 'near', pill: true, quiet: false });
    for (const id of ['C', 'D', 'E'])
      expect(rel(id)).toMatchObject({ kind: 'planned', pill: false, quiet: true });
    expect(rel('U')).toMatchObject({
      kind: 'undated',
      pill: true,
      quiet: false,
      countdown: { label: 'No date' },
    });
  });
  it('sorts several overdue ascending, all before TODAY', () => {
    const a = buildAgenda([v('L2', false, '2026-10-25'), v('L1', false, '2026-10-10')], TODAY);
    expect(a.entries.map((e) => (e.type === 'release' ? e.version.id : e.type))).toEqual([
      'L1',
      'L2',
      'today',
    ]);
  });
  it('omits the section with no undated versions and keeps TODAY once', () => {
    const a = buildAgenda([v('X', false, '2026-10-01')], TODAY);
    expect(a.entries.some((e) => e.type === 'section')).toBe(false);
    expect(a.entries.filter((e) => e.type === 'today')).toHaveLength(1);
    expect(a.nextId).toBeNull();
  });
  it('emits no divider for a later date in the current month', () => {
    const a = buildAgenda([v('X', false, '2026-10-31')], TODAY);
    expect(a.entries.some((e) => e.type === 'month')).toBe(false);
  });
  it('a release on today is next with Today countdown', () => {
    const a = buildAgenda([v('X', false, TODAY)], TODAY);
    expect(a.entries[1]).toMatchObject({ kind: 'next', countdown: { label: 'Today' } });
  });
  it('takes no breakdowns and is deterministic', () => {
    expect(buildAgenda.length).toBe(2);
    expect(buildAgenda(fixture, TODAY)).toEqual(buildAgenda(fixture, TODAY));
  });
});

describe('releaseSummary', () => {
  it('counts planned, overdue and undated, ignoring released', () => {
    expect(releaseSummary(fixture, TODAY)).toEqual({
      planned: 6,
      overdue: 1,
      undated: 1,
      cadenceDays: 7,
      lastShippedDays: 16,
    });
  });

  it('cadence is the median gap of the most recent ship dates', () => {
    const shipped = ['2026-10-27', '2026-10-20', '2026-10-13', '2026-10-12', '2026-09-01'].map(
      (d, i) => v(`S${i}`, true, d),
    );
    // gaps newest first: 7, 7, 1, 41 -> median of [1, 7, 7, 41] = 7
    expect(releaseSummary(shipped, TODAY)).toMatchObject({ cadenceDays: 7, lastShippedDays: 2 });
  });

  it('ignores future-dated released versions and needs two dates for a cadence', () => {
    const one = [v('S1', true, '2026-10-20'), v('S2', true, '2026-11-20')];
    expect(releaseSummary(one, TODAY)).toMatchObject({ cadenceDays: null, lastShippedDays: 9 });
    expect(releaseSummary([], TODAY)).toMatchObject({ cadenceDays: null, lastShippedDays: null });
  });
});

describe('spanLabel', () => {
  it('days under two weeks, weeks from 14', () => {
    expect(spanLabel(1)).toBe('1 day');
    expect(spanLabel(13)).toBe('13 days');
    expect(spanLabel(14)).toBe('2 weeks');
    expect(spanLabel(25)).toBe('4 weeks');
  });
});
