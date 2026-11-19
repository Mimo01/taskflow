import { describe, expect, it } from 'vitest';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import {
  barGeometry,
  formatMs,
  groupLoads,
  isLoadOpen,
  loadName,
  loadSpan,
  loadTicks,
  requestLabel,
  rowStatus,
  tooltipLines,
  visibleRequestIds,
} from './timeline-loads';

const T0 = 1_700_000_000_000;

function mk(
  id: string,
  startOffset: number,
  ms: number,
  over: Partial<ApiLogEntry> = {},
): ApiLogEntry {
  const startedAt = T0 + startOffset;
  return {
    id,
    timestamp: new Date(startedAt).toISOString(),
    source: 'jira',
    method: 'GET',
    url: `https://jira.example.com/rest/api/2/${id}`,
    requestHeaders: {},
    status: 200,
    durationMs: ms,
    responseBody: '{}',
    state: 'done',
    startedAt,
    endedAt: startedAt + ms,
    route: '/backlog',
    ...over,
  };
}

describe('groupLoads', () => {
  it('splits on route change and returns newest first', () => {
    const loads = groupLoads([
      mk('a', 0, 100),
      mk('b', 50, 100),
      mk('c', 200, 100, { route: '/issue/PROJ-1' }),
    ]);
    expect(loads.map((l) => l.name)).toEqual(['Issue PROJ-1', 'Backlog']);
    expect(loads[1].entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(loads[1].id).toBe('load-a');
  });

  it('splits after more than 1.5 s idle but not within it', () => {
    expect(groupLoads([mk('a', 0, 100), mk('b', 1600, 100)])).toHaveLength(1);
    expect(groupLoads([mk('a', 0, 100), mk('b', 1700, 100)])).toHaveLength(2);
  });

  it('keeps a queued request in the load using queuedAt', () => {
    const loads = groupLoads([mk('a', 0, 100), mk('b', 3000, 100, { queuedAt: T0 + 500 })]);
    expect(loads).toHaveLength(1);
    expect(loads[0].start).toBe(T0);
  });

  it('never splits on a gap while something is pending', () => {
    const pending = mk('a', 0, 0, { state: 'pending', status: null, endedAt: undefined });
    const loads = groupLoads([pending, mk('b', 5000, 100)]);
    expect(loads).toHaveLength(1);
    expect(loads[0].hasPending).toBe(true);
  });

  it('does not split when a route is undefined', () => {
    const loads = groupLoads([mk('a', 0, 100), mk('b', 50, 100, { route: undefined })]);
    expect(loads).toHaveLength(1);
  });

  it('sorts entries by start then id and computes doneEnd', () => {
    const [load] = groupLoads([mk('b', 10, 100), mk('c', 0, 300), mk('a', 10, 50)]);
    expect(load.entries.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(load.doneEnd).toBe(T0 + 300);
    expect(load.hasPending).toBe(false);
  });

  it('keeps the load id stable when later requests join', () => {
    const first = groupLoads([mk('a', 0, 100)])[0].id;
    const later = groupLoads([mk('a', 0, 100), mk('b', 100, 100)])[0].id;
    expect(later).toBe(first);
  });
});

describe('loadSpan', () => {
  it('uses doneEnd, grows with now while pending, never below 1', () => {
    const [done] = groupLoads([mk('a', 0, 400)]);
    expect(loadSpan(done, T0 + 9999)).toBe(400);
    const pending = mk('p', 0, 0, { state: 'pending', status: null, endedAt: undefined });
    const [live] = groupLoads([mk('a', 0, 400), pending]);
    expect(loadSpan(live, T0 + 1000)).toBe(1000);
    const [zero] = groupLoads([mk('z', 0, 0)]);
    expect(loadSpan(zero, T0)).toBe(1);
  });
});

describe('loadName', () => {
  it.each([
    ['/backlog', 'Backlog'],
    ['/my-tasks', 'My Tasks'],
    ['/issue/PROJ-12', 'Issue PROJ-12'],
    ['/mr/17/42', 'Merge request !42'],
    ['/release/1001', 'Release 1001'],
    ['/aio-project/PRJ', 'AIO project PRJ'],
    ['/aio-cycle/PRJ/CY-3', 'AIO cycle CY-3'],
    ['/aio-cycle/PRJ/CY-3/run/9', 'AIO test run 9'],
    ['/dev-tools', 'Developer Tools'],
    ['/settings', 'Settings'],
    ['/', 'Home'],
    ['/some-new-page/x', 'Some New Page'],
    [undefined, 'Unknown page'],
    ['', 'Unknown page'],
  ])('%s -> %s', (route, name) => {
    expect(loadName(route)).toBe(name);
  });
});

describe('requestLabel', () => {
  it('prefers a trimmed operation', () => {
    expect(requestLabel({ operation: '  Epics ', url: 'https://x/a/b' })).toBe('Epics');
  });
  it('falls back to the last two decoded segments', () => {
    expect(requestLabel({ url: 'https://x/rest/api/2/issue/PROJ-1/remotelink' })).toBe(
      'PROJ-1/remotelink',
    );
    expect(requestLabel({ operation: '  ', url: 'https://x/a%20b/c' })).toBe('a b/c');
  });
  it('handles empty path and decode failure', () => {
    expect(requestLabel({ url: 'https://x' })).toBe('/');
    expect(requestLabel({ url: 'https://x/%E0%A4%A' })).toBe('/%E0%A4%A');
  });
});

describe('rowStatus', () => {
  it('maps states to text and tone', () => {
    const pending = mk('p', 0, 0, { state: 'pending', status: null });
    expect(rowStatus(pending)).toEqual({ text: 'loading', tone: 'pending' });
    expect(rowStatus(mk('e', 0, 1, { status: null, state: 'error' }))).toEqual({
      text: 'error',
      tone: 'error',
    });
    expect(rowStatus(mk('s', 0, 1, { status: 503 }))).toEqual({ text: '503', tone: 'error' });
    expect(rowStatus(mk('n', 0, 1, { status: 404 }))).toEqual({ text: '404', tone: 'warn' });
    expect(rowStatus(mk('o', 0, 1, { status: 200 }))).toBeNull();
    expect(rowStatus(mk('r', 0, 1, { status: 302 }))).toBeNull();
  });
});

describe('formatMs', () => {
  it('formats ms and seconds', () => {
    expect(formatMs(0)).toBe('0 ms');
    expect(formatMs(412.4)).toBe('412 ms');
    expect(formatMs(1234)).toBe('1.2 s');
    expect(formatMs(12000)).toBe('12 s');
  });
});

describe('loadTicks', () => {
  it('picks a step giving at most four intervals', () => {
    const ticks = loadTicks(1960);
    expect(ticks.map((t) => t.t)).toEqual([500, 1000, 1500]);
    expect(ticks[0].label).toBe('500 ms');
    expect(ticks[0].pct).toBeCloseTo((500 / (1960 * 1.02)) * 100);
  });
  it('uses whole-minute steps for very long spans', () => {
    const ticks = loadTicks(600_000);
    expect(ticks[0].t % 60_000).toBe(0);
    expect(ticks.length).toBeLessThanOrEqual(4);
  });
  it('has no ticks for a tiny span', () => {
    expect(loadTicks(50)).toEqual([]);
  });
});

describe('barGeometry', () => {
  it('computes percentages, wait lead-in and tone', () => {
    const e = mk('a', 200, 300, { queuedAt: T0 + 100, status: 404 });
    const [load] = groupLoads([e, mk('b', 0, 1000)]);
    const g = barGeometry(e, load, 1000, T0 + 5000);
    expect(g.left).toBeCloseTo((200 / 1020) * 100);
    expect(g.width).toBeCloseTo((300 / 1020) * 100);
    expect(g.wait?.left).toBeCloseTo((100 / 1020) * 100);
    expect(g.wait?.width).toBeCloseTo((100 / 1020) * 100);
    expect(g.tone).toBe('warn');
  });
  it('enforces a minimum width and no wait when not queued', () => {
    const e = mk('a', 0, 0);
    const [load] = groupLoads([e]);
    const g = barGeometry(e, load, 1000, T0);
    expect(g.width).toBe(0.4);
    expect(g.wait).toBeNull();
    expect(g.tone).toBe('ok');
  });
  it('grows a pending bar with now', () => {
    const p = mk('p', 0, 0, { state: 'pending', status: null, endedAt: undefined });
    const [load] = groupLoads([p]);
    const a = barGeometry(p, load, 1000, T0 + 200).width;
    const b = barGeometry(p, load, 1000, T0 + 600).width;
    expect(b).toBeGreaterThan(a);
    expect(barGeometry(p, load, 1000, T0).tone).toBe('pending');
  });
});

describe('tooltipLines', () => {
  it('returns three lines with the wait part only when queued', () => {
    const plain = mk('a', 100, 300);
    const queued = mk('b', 100, 300, { queuedAt: T0 - 400 });
    const [load] = groupLoads([plain, queued]);
    const l1 = tooltipLines(plain, load, T0);
    expect(l1).toHaveLength(3);
    expect(l1[0]).toBe('GET /rest/api/2/a');
    expect(l1[1]).toBe('Took 300 ms');
    expect(l1[2]).toBe(`Started ${formatMs(100 + 400)} after the page opened`);
    expect(tooltipLines(queued, load, T0)[1]).toBe(
      'Took 300 ms after waiting 500 ms for a Jira slot',
    );
  });
  it('describes pending requests', () => {
    const p = mk('p', 0, 0, { state: 'pending', status: null, endedAt: undefined });
    const [load] = groupLoads([p]);
    expect(tooltipLines(p, load, T0 + 1500)[1]).toBe('Still loading (1.5 s so far)');
  });
});

describe('open state', () => {
  const loads = groupLoads([
    mk('a', 0, 100, { route: '/backlog' }),
    mk('b', 10, 100, { route: '/backlog' }),
    mk('c', 200, 100, { route: '/epics' }),
  ]);
  it('defaults to newest open, explicit choice wins', () => {
    expect(isLoadOpen({}, 'x', 0)).toBe(true);
    expect(isLoadOpen({}, 'x', 1)).toBe(false);
    expect(isLoadOpen({ x: false }, 'x', 0)).toBe(false);
    expect(isLoadOpen({ x: true }, 'x', 3)).toBe(true);
  });
  it('lists visible ids in render order', () => {
    expect(visibleRequestIds(loads, {})).toEqual(['c']);
    expect(visibleRequestIds(loads, { [loads[1].id]: true })).toEqual(['c', 'a', 'b']);
    expect(visibleRequestIds(loads, { [loads[0].id]: false })).toEqual([]);
  });
});
