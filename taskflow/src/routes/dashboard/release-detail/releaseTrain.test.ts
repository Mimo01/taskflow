import { describe, expect, it } from 'vitest';
import type { JiraFixVersion } from '@/services/jira';
import { deriveReleaseTrain, formatTrainSummary, placeTrainLabels } from './releaseTrain';

const v = (id: string, name: string, releaseDate?: string, released = false): JiraFixVersion => ({
  id,
  name,
  releaseDate,
  released,
});

const TODAY = '2026-11-03';
const THIS = v('10', 'R-12-01', '2026-12-01');
const PREV = v('9', 'R-11-17', '2026-11-17');

describe('deriveReleaseTrain', () => {
  it('returns null for undated, released and past-due versions', () => {
    expect(deriveReleaseTrain({ version: v('1', 'A'), fixVersions: [], today: TODAY })).toBeNull();
    expect(
      deriveReleaseTrain({
        version: v('1', 'A', '2026-12-01', true),
        fixVersions: [],
        today: TODAY,
      }),
    ).toBeNull();
    expect(
      deriveReleaseTrain({ version: v('1', 'A', '2026-11-02'), fixVersions: [], today: TODAY }),
    ).toBeNull();
    expect(
      deriveReleaseTrain({ version: v('1', 'A', 'not-a-date'), fixVersions: [], today: TODAY }),
    ).toBeNull();
  });

  it('locked example: one tick at the window start, window not open', () => {
    const t = deriveReleaseTrain({ version: THIS, fixVersions: [PREV, THIS], today: TODAY });
    expect(t).not.toBeNull();
    if (!t) return;
    expect(t.start).toBe(TODAY);
    expect(t.end).toBe('2026-12-01');
    expect(t.windowOpen).toBe(false);
    expect(t.todayF).toBe(0);
    expect(t.windowStartF).toBe(0.5);
    expect(t.ticks).toEqual([
      { id: '9', name: 'R-11-17', date: '2026-11-17', f: 0.5, windowStart: true },
    ]);
    expect(t.aheadCount).toBe(1);
    expect(t.windowDays).toBe(14);
    expect(t.daysToRelease).toBe(28);
    expect(t.releaseName).toBe('R-12-01');
    expect(t.previousName).toBe('R-11-17');
  });

  it('two ahead: ticks in date order, only the previous version opens the window', () => {
    const t = deriveReleaseTrain({
      version: THIS,
      fixVersions: [PREV, v('8', 'R-11-10', '2026-11-10'), THIS],
      today: TODAY,
    });
    expect(t?.ticks.map((x) => [x.name, x.windowStart])).toEqual([
      ['R-11-10', false],
      ['R-11-17', true],
    ]);
    expect(t?.aheadCount).toBe(2);
  });

  it('never ticks versions on/before today, on/after release, undated, or released (non-prev)', () => {
    const t = deriveReleaseTrain({
      version: THIS,
      fixVersions: [
        THIS,
        PREV,
        v('1', 'Past', '2026-11-01'),
        v('2', 'On today', TODAY),
        v('3', 'Same day', '2026-12-01'),
        v('4', 'After', '2026-12-10'),
        v('5', 'Undated'),
        v('6', 'Shipped early', '2026-11-05', true),
      ],
      today: TODAY,
    });
    expect(t?.ticks.map((x) => x.name)).toEqual(['R-11-17']);
    expect(t?.aheadCount).toBe(1);
  });

  it('keeps a released previous version as the window-start tick but not as ahead', () => {
    const t = deriveReleaseTrain({
      version: THIS,
      fixVersions: [v('9', 'R-11-17', '2026-11-17', true), THIS],
      today: TODAY,
    });
    expect(t?.ticks).toHaveLength(1);
    expect(t?.ticks[0].windowStart).toBe(true);
    expect(t?.aheadCount).toBe(0);
  });

  it('window already open: TODAY sits inside the window (not clamped)', () => {
    const t = deriveReleaseTrain({
      version: v('10', 'R-11-10', '2026-11-10'),
      fixVersions: [v('9', 'R-10-28', '2026-10-28'), v('10', 'R-11-10', '2026-11-10')],
      today: TODAY,
    });
    expect(t?.windowOpen).toBe(true);
    expect(t?.start).toBe('2026-10-28');
    expect(t?.windowStartF).toBe(0);
    expect(t?.todayF).toBeGreaterThan(0);
    expect(t?.todayF).toBeCloseTo(6 / 13);
    expect(t?.ticks).toEqual([
      { id: '9', name: 'R-10-28', date: '2026-10-28', f: 0, windowStart: true },
    ]);
    expect(t?.aheadCount).toBe(0);
    expect(t?.windowDays).toBe(13);
    expect(t?.daysToRelease).toBe(7);
  });

  it('no previous version: no window, ticks from ahead versions only', () => {
    const t = deriveReleaseTrain({ version: THIS, fixVersions: [THIS], today: TODAY });
    expect(t?.windowOpen).toBe(false);
    expect(t?.windowStartF).toBeNull();
    expect(t?.windowDays).toBeNull();
    expect(t?.previousName).toBeNull();
    expect(t?.ticks).toEqual([]);
  });

  it('release today without a previous version: zero span, no NaN', () => {
    const t = deriveReleaseTrain({
      version: v('10', 'R-11-03', TODAY),
      fixVersions: [],
      today: TODAY,
    });
    expect(t?.start).toBe(t?.end);
    expect(t?.daysToRelease).toBe(0);
    expect(t?.todayF).toBe(0);
  });
});

describe('formatTrainSummary', () => {
  const base = deriveReleaseTrain({ version: THIS, fixVersions: [PREV, THIS], today: TODAY });
  if (!base) throw new Error('fixture');

  it('joins the parts with a middle dot', () => {
    expect(formatTrainSummary(base)).toBe('1 release ahead · window 14 d · in 28 d');
    expect(formatTrainSummary({ ...base, aheadCount: 2 })).toBe(
      '2 releases ahead · window 14 d · in 28 d',
    );
  });

  it('omits zero or unknown parts', () => {
    expect(formatTrainSummary({ ...base, aheadCount: 0 })).toBe('window 14 d · in 28 d');
    expect(formatTrainSummary({ ...base, windowDays: null })).toBe('1 release ahead · in 28 d');
    expect(formatTrainSummary({ ...base, aheadCount: 0, windowDays: null, daysToRelease: 0 })).toBe(
      'due today',
    );
  });
});

describe('placeTrainLabels', () => {
  const today = { key: 'today', f: 0, text: 'Today', priority: 3, maxPx: 96 };
  const release = { key: 'release', f: 1, text: 'R-12-01', priority: 3, maxPx: 96 };

  it('drops a low-priority name colliding with TODAY at a narrow width', () => {
    const out = placeTrainLabels(
      [today, release, { key: 'a', f: 0.05, text: 'R-11-05', priority: 1, maxPx: 96 }],
      220,
    );
    expect(out.map((p) => [p.key, p.visible])).toEqual([
      ['today', true],
      ['release', true],
      ['a', false],
    ]);
  });

  it('keeps a mid-track name at a wide width, centred and inside the track', () => {
    const out = placeTrainLabels(
      [today, release, { key: 'a', f: 0.5, text: 'R-11-17', priority: 1, maxPx: 96 }],
      420,
    );
    expect(out.every((p) => p.visible)).toBe(true);
    expect(out[0].align).toBe('start');
    expect(out[1].align).toBe('end');
    expect(out[1].x1).toBe(420);
    expect(out[2].align).toBe('center');
  });

  it('clamps labels inside the track', () => {
    const [p] = placeTrainLabels(
      [{ key: 'a', f: 0.9, text: 'A long version name', priority: 1, maxPx: 96 }],
      200,
    );
    expect(p.x0).toBeGreaterThanOrEqual(0);
    expect(p.x1).toBeLessThanOrEqual(200);
  });
});
