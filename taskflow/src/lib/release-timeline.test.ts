import { describe, expect, it } from 'vitest';
import {
  chipShortName,
  chipStatus,
  formatRange,
  laterCount,
  placeChipLanes,
  placeTickRows,
  tickLabel,
  timelinePercent,
  timelineReleases,
  timelineWeeks,
  timelineWindow,
} from './release-timeline';

const v = (id: string, releaseDate: string | undefined, released = false) => ({
  id,
  name: id,
  releaseDate,
  released,
});

describe('timelineWeeks', () => {
  it('clamps floor(w/115) to 3-8', () => {
    expect(timelineWeeks(300)).toBe(3);
    expect(timelineWeeks(600)).toBe(5);
    expect(timelineWeeks(920)).toBe(8);
    expect(timelineWeeks(2000)).toBe(8);
    expect(timelineWeeks(0)).toBe(3);
  });
});

describe('timelineWindow', () => {
  const today = '2026-10-29';
  it('wide window starts 21 days before today', () => {
    expect(timelineWindow({ today, weeks: 8, earliestOverdue: null, offset: 0 })).toEqual({
      start: '2026-10-08',
      end: '2026-12-05',
    });
  });
  it('narrow window anchors on earliest overdue or today', () => {
    expect(
      timelineWindow({ today, weeks: 4, earliestOverdue: '2026-10-20', offset: 0 }).start,
    ).toBe('2026-10-17');
    expect(timelineWindow({ today, weeks: 4, earliestOverdue: null, offset: 0 }).start).toBe(
      '2026-10-26',
    );
  });
  it('pans by weeks-2 weeks, minimum one', () => {
    expect(timelineWindow({ today, weeks: 8, earliestOverdue: null, offset: 1 }).start).toBe(
      '2026-11-19',
    );
    expect(timelineWindow({ today, weeks: 3, earliestOverdue: null, offset: 1 }).start).toBe(
      '2026-11-02',
    );
  });
});

describe('timelinePercent', () => {
  it('maps start, end and midpoint', () => {
    const win = { start: '2026-10-01', end: '2026-10-11' };
    expect(timelinePercent('2026-10-01', win)).toBe(0);
    expect(timelinePercent('2026-10-11', win)).toBe(100);
    expect(timelinePercent('2026-10-06', win)).toBe(50);
  });
});

describe('timelineReleases / laterCount', () => {
  const list = [
    v('R1', '2026-10-13', true),
    v('R0', '2026-10-06', true),
    v('U', undefined),
    v('A', '2026-11-03'),
    v('O', '2026-10-20'),
  ];
  it('keeps newest released + dated unreleased, ascending', () => {
    expect(timelineReleases(list).map((x) => x.id)).toEqual(['R1', 'O', 'A']);
  });
  it('counts dated versions after window end', () => {
    expect(laterCount(list, { start: '2026-10-01', end: '2026-10-25' })).toBe(1);
    expect(laterCount(list, { start: '2026-10-01', end: '2026-12-25' })).toBe(0);
  });
});

describe('placeTickRows', () => {
  const L = 'Tue 03 Nov';
  it('puts colliding ticks on row 1 then hides', () => {
    const r = placeTickRows([
      { id: 'a', x: 100, label: L },
      { id: 'b', x: 130, label: L },
    ]);
    expect([r.get('a'), r.get('b')]).toEqual([0, 1]);
    const r3 = placeTickRows([
      { id: 'a', x: 100, label: L },
      { id: 'b', x: 110, label: L },
      { id: 'c', x: 120, label: L },
    ]);
    expect([r3.get('a'), r3.get('b'), r3.get('c')]).toEqual([0, 1, null]);
  });
  it('keeps spaced ticks on row 0', () => {
    const r = placeTickRows([
      { id: 'a', x: 100, label: L },
      { id: 'b', x: 300, label: L },
      { id: 'c', x: 500, label: L },
    ]);
    expect([...r.values()]).toEqual([0, 0, 0]);
  });
});

describe('placeChipLanes', () => {
  it('separates overlapping chips', () => {
    const r = placeChipLanes(
      [
        { id: 'a', x: 100 },
        { id: 'b', x: 150 },
      ],
      null,
    );
    expect(r.get('a')).not.toBe(r.get('b'));
  });
  it('gives the next chip lane 0', () => {
    const r = placeChipLanes(
      [
        { id: 'a', x: 100 },
        { id: 'n', x: 150 },
      ],
      'n',
    );
    expect(r.get('n')).toBe(0);
    expect(r.get('a')).not.toBe(0);
  });
  it('keeps distant chips on lane 0', () => {
    const r = placeChipLanes(
      [
        { id: 'a', x: 100 },
        { id: 'b', x: 400 },
        { id: 'c', x: 700 },
      ],
      null,
    );
    expect([...r.values()]).toEqual([0, 0, 0]);
  });
  it('falls back to lane 0 when all lanes are taken', () => {
    const r = placeChipLanes(
      [
        { id: 'a', x: 100 },
        { id: 'b', x: 110 },
        { id: 'c', x: 120 },
        { id: 'd', x: 130 },
      ],
      null,
    );
    expect(r.get('d')).toBe(0);
  });
});

describe('chipStatus', () => {
  it('derives status text', () => {
    expect(chipStatus({ done: 0, indeterminate: 0, new: 1 }, true)).toBe('✓ done');
    expect(chipStatus(undefined, false)).toBeNull();
    expect(chipStatus({ done: 0, indeterminate: 0, new: 0 }, false)).toBe('No issues');
    expect(chipStatus({ done: 18, indeterminate: 0, new: 2 }, false)).toBe('18/20 done');
    expect(chipStatus({ done: 0, indeterminate: 0, new: 8 }, false)).toBe('8 to do');
    expect(chipStatus({ done: 0, indeterminate: 1, new: 2 }, false)).toBe('0/3 done');
  });
});

describe('names and labels', () => {
  it('shortens names', () => {
    expect(chipShortName('Standard 03.11.2026 - Statement export')).toBe('Statement export');
    expect(chipShortName('Hotfix')).toBe('Hotfix');
  });
  it('formats range', () => {
    const win = { start: '2026-10-08', end: '2026-12-05' };
    expect(formatRange(win, 10)).toBe('08 Oct – 05 Dec · +10 later');
    expect(formatRange(win, 0)).toBe('08 Oct – 05 Dec');
  });
  it('formats tick label', () => {
    expect(tickLabel('2026-11-03')).toBe('Tue 03 Nov');
  });
});
