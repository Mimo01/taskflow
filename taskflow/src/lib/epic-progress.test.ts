import { describe, expect, it } from 'vitest';
import type { EpicStatusHistory, EpicWorklogDay, JiraIssue, JiraStatus } from '@/services/jira';
import {
  addCalendarDays,
  addWorkingDays,
  chartAxisStart,
  chartDomain,
  clampRange,
  CONFIDENCE_REASON_MAX,
  confidenceReason,
  finishStateSub,
  dateKeyMs,
  sourceNote,
  HISTORY_SOURCE_TEXT,
  historyDates,
  viewSample,
  VIEW_MAX_POINTS,
  timeTicks,
  formatDateRange,
  formatMonthYear,
  spanDays,
  rangeToOffsets,
  offsetsToRange,
  panRange,
  panDeltaDays,
  rebaseRange,
  ZOOM_MIN_SPAN_DAYS,
  PRESET_SHORT_MAX_DAYS,
  PRESET_MEDIUM_MAX_DAYS,
  padToDomain,
  presetRange,
  projectionCap,
  averageForecasts,
  buildStatusCategoryLookup,
  buildWorkCalendar,
  DEFAULT_CALENDAR,
  deriveRisks,
  holidaysBetween,
  PROJECTION_MAX_POINTS,
  type AveragedForecast,
  catOf,
  deriveAdaptiveForecast,
  deriveCfd,
  deriveProjection,
  deriveSummary,
  deriveTimeForecast,
  forecastFromThroughput,
  withProjection,
  workingDaysBetween,
  type EpicForecast,
  deriveAssigneeBuckets,
  deriveStatusBuckets,
  deriveTimeBurnup,
  deriveTimeTotals,
  estimateOf,
  loggedOf,
  formatMetric,
  doneDateKey,
  weightOf,
  BANDS,
  bandPct,
  bandTotal,
  summaryBands,
  formatChip,
  formatFinishDate,
  finishDateRows,
  FINISH_STATE_TEXT,
  projectFinish,
  visiblePresets,
  ZOOM_MIN_DAYS,
  zoomEnabled,
} from './epic-progress';

const SP = 'customfield_10016';
const TODAY = '2026-10-01';

interface Opts {
  cat?: 'new' | 'indeterminate' | 'done';
  status?: string;
  sp?: unknown;
  assignee?: string | null;
  created?: string;
  res?: string | null;
  scc?: string | null;
  updated?: string;
  est?: unknown;
  own?: unknown;
  spent?: unknown;
  rem?: unknown;
}
function st(key: string, o: Opts = {}): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary: key,
      status: {
        id: '1',
        name: o.status ?? 'To Do',
        ...(o.cat ? { statusCategory: { key: o.cat } } : {}),
      },
      assignee: o.assignee ? { displayName: o.assignee, avatarUrls: { '48x48': '' } } : null,
      customfield_10016: (o.sp as number | null) ?? null,
      issuetype: { name: 'Story', subtask: false },
      created: o.created,
      resolutiondate: o.res,
      statuscategorychangedate: o.scc,
      updated: o.updated,
      aggregatetimeoriginalestimate: o.est as number | null | undefined,
      aggregatetimespent: o.spent as number | null | undefined,
      aggregatetimeestimate: o.rem as number | null | undefined,
      timeoriginalestimate: o.own as number | null | undefined,
    },
  };
}

describe('catOf / weightOf', () => {
  it('defaults missing category to new', () => {
    expect(catOf(st('A'))).toBe('new');
  });
  it('weights by metric and tolerates non-numeric SP', () => {
    expect(weightOf(st('A', { sp: 5 }), 'count', SP)).toBe(1);
    expect(weightOf(st('A', { sp: 5 }), 'sp', SP)).toBe(5);
    expect(weightOf(st('A', { sp: null }), 'sp', SP)).toBe(0);
    expect(weightOf(st('A', { sp: 'x' }), 'sp', SP)).toBe(0);
  });
});

describe('doneDateKey', () => {
  it('is null for non-done even with resolutiondate', () => {
    const s = st('A', { cat: 'indeterminate', res: '2026-09-01T10:00:00.000+0000' });
    expect(doneDateKey(s, TODAY)).toBeNull();
  });
  it('falls back resolutiondate -> statuscategorychangedate -> updated -> today', () => {
    const base = { cat: 'done' as const };
    const full = st('A', {
      ...base,
      res: '2026-09-01T10:00:00.000+0000',
      scc: '2026-09-02',
      updated: '2026-09-03',
    });
    expect(doneDateKey(full, TODAY)).toBe('2026-09-01');
    const noRes = st('A', { ...base, scc: '2026-09-02T00:00:00', updated: '2026-09-03' });
    expect(doneDateKey(noRes, TODAY)).toBe('2026-09-02');
    expect(doneDateKey(st('A', { ...base, updated: '2026-09-03' }), TODAY)).toBe('2026-09-03');
    expect(doneDateKey(st('A', base), TODAY)).toBe(TODAY);
  });
});

describe('deriveStatusBuckets', () => {
  it('groups by status name ordered by category then value', () => {
    const stories = [
      st('A', { status: 'Done', cat: 'done', sp: 3 }),
      st('B', { status: 'To Do', cat: 'new', sp: 2 }),
      st('C', { status: 'Review', cat: 'indeterminate', sp: 5 }),
      st('D', { status: 'To Do', cat: 'new', sp: 1 }),
    ];
    const b = deriveStatusBuckets(stories, 'count', SP);
    expect(b.map((x) => x.name)).toEqual(['Done', 'Review', 'To Do']);
    expect(b[2]).toMatchObject({ count: 2, points: 3, value: 2, cat: 'new' });
    expect(deriveStatusBuckets(stories, 'sp', SP)[2].value).toBe(3);
  });
});

describe('deriveAssigneeBuckets', () => {
  it('includes Unassigned and sorts by remaining desc then name', () => {
    const stories = [
      st('A', { assignee: 'Zed', cat: 'done' }),
      st('B', { assignee: 'Amy', cat: 'indeterminate' }),
      st('C', { assignee: null }),
      st('D', { assignee: null, cat: 'new' }),
      st('E', { assignee: 'Bob', cat: 'new' }),
    ];
    const b = deriveAssigneeBuckets(stories, 'count', SP);
    expect(b.map((x) => x.name)).toEqual(['Unassigned', 'Amy', 'Bob', 'Zed']);
    expect(b[0]).toMatchObject({ todo: 2, remaining: 2 });
    expect(b[3]).toMatchObject({ done: 1, remaining: 0 });
  });
});

describe('review fixes (261001-fmk)', () => {
  it('clamps a done date past local today to today (chart intent covered by deriveCfd (h))', () => {
    const s = st('X-1', {
      cat: 'done',
      created: '2026-09-30',
      res: '2026-10-02T00:30:00.000+0200',
    });
    expect(doneDateKey(s, TODAY)).toBe(TODAY);
  });

  it('counts a story created past local today at today', () => {
    const s = st('X-2', { created: '2026-10-02T00:10:00.000+0200' });
    const lookup = buildStatusCategoryLookup(undefined, [s]);
    const { points } = deriveCfd({
      stories: [s],
      history: null,
      lookup,
      metric: 'count',
      spKey: SP,
      epicCreated: undefined,
      today: TODAY,
    });
    expect(points[points.length - 1]).toMatchObject({ date: TODAY, todo: 1 });
  });

  it('keeps same-named assignees with different usernames apart from each other and Unassigned', () => {
    const a = (key: string, username: string, display: string) => {
      const s = st(key, { assignee: display });
      (s.fields.assignee as { name?: string }).name = username;
      return s;
    };
    const buckets = deriveAssigneeBuckets(
      [
        a('Y-1', 'jsmith', 'John Smith'),
        a('Y-2', 'jsmith2', 'John Smith'),
        a('Y-3', 'u', 'Unassigned'),
        st('Y-4'),
      ],
      'count',
      SP,
    );
    expect(buckets).toHaveLength(4);
    expect(new Set(buckets.map((b) => b.id)).size).toBe(4);
  });

  it('keeps same-named statuses in different categories separate', () => {
    const buckets = deriveStatusBuckets(
      [
        st('Z-1', { status: 'Review', cat: 'indeterminate' }),
        st('Z-2', { status: 'Review', cat: 'done' }),
      ],
      'count',
      SP,
    );
    expect(buckets.map((b) => b.cat).sort()).toEqual(['done', 'indeterminate']);
  });
});

describe('time metric', () => {
  it('weightOf time uses aggregate estimate, coercing bad values to 0', () => {
    expect(weightOf(st('A', { est: 7200 }), 'time', SP)).toBe(7200);
    for (const bad of [null, undefined, 'x', Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      expect(weightOf(st('A', { est: bad }), 'time', SP)).toBe(0);
    }
  });

  it('status buckets carry seconds in every mode and value in time mode', () => {
    const stories = [st('A', { est: 3600, sp: 2 }), st('B', { est: 1800 })];
    const t = deriveStatusBuckets(stories, 'time', SP);
    expect(t[0].value).toBe(5400);
    expect(t[0].seconds).toBe(5400);
    expect(t[0].count).toBe(2);
    expect(t[0].points).toBe(2);
    const c = deriveStatusBuckets(stories, 'count', SP);
    expect(c[0].seconds).toBe(5400);
    expect(c[0].value).toBe(2);
  });

  it('assignee buckets sum logged/estimate in every mode and weight by estimate in time mode', () => {
    const stories = [
      st('A', { assignee: 'Ann', cat: 'done', est: 3600, spent: 1800 }),
      st('B', { assignee: 'Ann', est: 7200, spent: 600 }),
    ];
    const t = deriveAssigneeBuckets(stories, 'time', SP);
    expect(t[0]).toMatchObject({
      estimate: 10800,
      logged: 2400,
      done: 3600,
      todo: 7200,
      remaining: 7200,
    });
    const c = deriveAssigneeBuckets(stories, 'count', SP);
    expect(c[0]).toMatchObject({ estimate: 10800, logged: 2400, done: 1, todo: 1 });
  });

  it('deriveTimeTotals sums and guards zero estimate', () => {
    const r = deriveTimeTotals([
      st('A', { est: 3600, spent: 1800, rem: 1800 }),
      st('B', { est: 7200, spent: 3600 }),
      st('C'),
    ]);
    expect(r).toEqual({ estimated: 10800, logged: 5400, remaining: 5400, pctLogged: 50 });
    expect(deriveTimeTotals([st('A', { spent: 60 })]).pctLogged).toBeNull();
  });

  it('formatMetric formats per metric', () => {
    expect(formatMetric(3, 'count')).toBe('3');
    expect(formatMetric(2.5, 'count')).toBe('2.5');
    expect(formatMetric(5, 'sp')).toBe('5 SP');
    expect(formatMetric(9000, 'time')).toBe('2h 30m');
    expect(formatMetric(0, 'time')).toBe('0m');
  });
});

describe('estimateOf / loggedOf (261001-hsz)', () => {
  it('uses the subtask sum when subtasks carry estimates', () => {
    expect(estimateOf(st('A', { own: 3600, est: 10800 }))).toBe(7200);
  });
  it('falls back to the own estimate when no subtask estimates', () => {
    expect(estimateOf(st('A', { own: 3600, est: 3600 }))).toBe(3600);
  });
  it('treats missing own estimate as aggregate (old fixtures)', () => {
    expect(estimateOf(st('A', { est: 7200 }))).toBe(7200);
  });
  it('is 0 for null / negative / NaN', () => {
    expect(estimateOf(st('A'))).toBe(0);
    expect(estimateOf(st('A', { est: -5, own: Number.NaN }))).toBe(0);
  });
  it('loggedOf reads the aggregate spent, default 0', () => {
    expect(loggedOf(st('A', { spent: 60 }))).toBe(60);
    expect(loggedOf(st('A'))).toBe(0);
  });
  it('weightOf time, status seconds and assignee estimate use estimateOf', () => {
    const s = st('A', { own: 3600, est: 10800, spent: 600, assignee: 'Ann' });
    expect(weightOf(s, 'time', SP)).toBe(7200);
    expect(deriveStatusBuckets([s], 'count', SP)[0].seconds).toBe(7200);
    const a = deriveAssigneeBuckets([s], 'count', SP)[0];
    expect(a.estimate).toBe(7200);
    expect(a.logged).toBe(600);
  });
  it('deriveTimeTotals remaining sums open max(est - logged, 0) only', () => {
    const r = deriveTimeTotals([
      st('A', { est: 3600, spent: 7200 }),
      st('B', { est: 3600, spent: 600 }),
      st('C', { est: 3600, spent: 600, cat: 'done' }),
    ]);
    expect(r.remaining).toBe(3000);
    expect(r.estimated).toBe(10800);
  });
});

describe('deriveTimeBurnup (261001-hsz)', () => {
  const H = 3600;
  const at = (pts: ReturnType<typeof deriveTimeBurnup>, d: string) => {
    const p = pts.find((x) => x.date === d);
    if (!p) throw new Error(`no point ${d}`);
    return p;
  };
  const log = (day: string, seconds: number) => ({ day, seconds });

  it('intermediate logs raise Logged while Estimate stays', () => {
    const pts = deriveTimeBurnup(
      [st('A', { est: 4 * H, created: '2026-09-28' })],
      new Map([['A', [log('2026-09-29', H), log('2026-09-30', H)]]]),
      undefined,
      TODAY,
    );
    expect(at(pts, '2026-09-28')).toMatchObject({ estimate: 4 * H, logged: 0 });
    expect(at(pts, '2026-09-29')).toMatchObject({ estimate: 4 * H, logged: H });
    expect(at(pts, TODAY)).toMatchObject({ estimate: 4 * H, logged: 2 * H });
  });

  it('done story estimate collapses to logged-so-far from its done date', () => {
    const pts = deriveTimeBurnup(
      [st('A', { est: 4 * H, created: '2026-09-28', cat: 'done', res: '2026-09-30' })],
      new Map([['A', [log('2026-09-29', H)]]]),
      undefined,
      TODAY,
    );
    expect(at(pts, '2026-09-29').estimate).toBe(4 * H);
    expect(at(pts, '2026-09-30')).toMatchObject({ estimate: H, logged: H });
  });

  it('overrun on an open story raises Estimate to logged', () => {
    const pts = deriveTimeBurnup(
      [st('A', { est: H, created: '2026-09-28' })],
      new Map([['A', [log('2026-09-29', 3 * H)]]]),
      undefined,
      TODAY,
    );
    expect(at(pts, TODAY)).toMatchObject({ estimate: 3 * H, logged: 3 * H });
  });

  it('a log before the shared axis start is counted on the first day', () => {
    const pts = deriveTimeBurnup(
      [st('A', { est: 0, created: '2026-09-30' })],
      new Map([['A', [log('2026-09-27', H)]]]),
      undefined,
      TODAY,
    );
    expect(pts[0].date).toBe('2026-09-30');
    expect(pts[0].logged).toBe(H);
    for (const p of pts) expect(p.estimate).toBeGreaterThanOrEqual(p.logged);
  });

  it('clamps a future-dated log to today', () => {
    const pts = deriveTimeBurnup(
      [st('A', { est: 2 * H, created: '2026-09-29' })],
      new Map([['A', [log('2026-12-25', H)]]]),
      undefined,
      TODAY,
    );
    expect(pts[pts.length - 1].date).toBe(TODAY);
    expect(at(pts, '2026-09-30').logged).toBe(0);
    expect(at(pts, TODAY).logged).toBe(H);
  });

  it('done with zero logs drops the story estimate to 0 at done date', () => {
    const pts = deriveTimeBurnup(
      [st('A', { est: 2 * H, created: '2026-09-28', cat: 'done', res: '2026-09-30' })],
      new Map(),
      undefined,
      TODAY,
    );
    expect(at(pts, '2026-09-29').estimate).toBe(2 * H);
    expect(at(pts, '2026-09-30').estimate).toBe(0);
  });

  it('invariants: estimate >= logged and final gap equals Remaining tile', () => {
    const stories = [
      st('A', { est: 4 * H, spent: H, created: '2026-09-20' }),
      st('B', { est: 2 * H, spent: 3 * H, created: '2026-09-22' }),
      st('C', { est: 5 * H, spent: H, created: '2026-09-23', cat: 'done', res: '2026-09-29' }),
      st('D', { est: H, created: 'garbage' }),
    ];
    const logs = new Map([
      ['A', [log('2026-09-21', H)]],
      ['B', [log('2026-09-24', 2 * H), log('2026-09-25', H)]],
      ['C', [log('2026-09-26', H)]],
    ]);
    const pts = deriveTimeBurnup(stories, logs, '2026-09-20', TODAY);
    for (const p of pts) expect(p.estimate).toBeGreaterThanOrEqual(p.logged);
    const last = pts[pts.length - 1];
    expect(last.estimate - last.logged).toBe(deriveTimeTotals(stories).remaining);
  });

  it('invalid created with logs starts at its first log day', () => {
    const pts = deriveTimeBurnup(
      [st('A', { est: 2 * H })],
      new Map([['A', [log('2026-09-29', H)]]]),
      undefined,
      TODAY,
    );
    expect(pts[0].date).toBe('2026-09-29');
    expect(pts[0].estimate).toBe(2 * H);
  });

  it('returns [] when nothing is dated and epicCreated is invalid', () => {
    expect(deriveTimeBurnup([st('A', { est: H })], new Map(), undefined, TODAY)).toEqual([]);
  });
});

describe('deriveTimeBurnup review fixes (261001-hsz)', () => {
  const H = 3600;
  it('reconciles undatable logged time onto today so the final gap equals the Remaining tile', () => {
    const stories = [st('A', { est: 4 * H, spent: 3 * H, created: '2026-09-28' })];
    const logs = new Map([
      [
        'A',
        [
          { day: '2026-09-29', seconds: H },
          { day: '', seconds: 2 * H },
        ],
      ],
    ]);
    const pts = deriveTimeBurnup(stories, logs, undefined, TODAY);
    const last = pts[pts.length - 1];
    expect(last.logged).toBe(3 * H);
    expect(last.estimate - last.logged).toBe(deriveTimeTotals(stories).remaining);
  });
});

// ── 261001-ilq ───────────────────────────────────────────────────────────────

const WED = '2026-09-30';

/** The n most recent working days ending at WED (inclusive), newest first. */
function workingDaysBack(n: number): string[] {
  const out: string[] = [];
  let d = new Date(Date.UTC(2026, 8, 30));
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() - 86_400_000);
  }
  return out;
}

const doneOn = (key: string, day: string, created = '2026-01-01T10:00:00.000+0000') =>
  st(key, { cat: 'done', res: `${day}T12:00:00.000+0000`, created });
const openStory = (key: string, created = '2026-01-01T10:00:00.000+0000') => st(key, { created });

describe('working days', () => {
  it('addWorkingDays skips weekends', () => {
    expect(addWorkingDays('2026-09-30', 3)).toBe('2026-10-05');
    expect(addWorkingDays('2026-09-30', 0)).toBe('2026-09-30');
    expect(addWorkingDays('2026-09-30', 10)).toBe('2026-10-14');
    expect(addWorkingDays('2026-10-03', 1)).toBe('2026-10-05');
  });
  it('workingDaysBetween excludes the start day and counts Mon-Fri only', () => {
    expect(workingDaysBetween('2026-09-25', '2026-09-30')).toBe(3);
    expect(workingDaysBetween('2026-09-30', '2026-09-30')).toBe(0);
    expect(workingDaysBetween('2026-09-30', '2026-09-25')).toBe(0);
    expect(workingDaysBetween('2026-09-01', '2026-09-30')).toBe(21);
  });
});

describe('adaptive forecast case table (261001-ilq)', () => {
  const run = (stories: JiraIssue[]) =>
    deriveAdaptiveForecast(stories, 'count', SP, undefined, WED);
  const ordered = (f: EpicForecast) => {
    expect(f.optimistic).not.toBeNull();
    expect((f.optimistic as string) <= (f.likely as string)).toBe(true);
    expect((f.likely as string) <= (f.pessimistic as string)).toBe(true);
  };

  it('(1) a 1-week-old epic forecasts ~25 working days, not ~20 weeks', () => {
    const created = '2026-09-20T12:00:00.000+0000';
    const stories = [
      doneOn('A-1', '2026-09-29', created),
      doneOn('A-2', '2026-09-25', created),
      st('A-3', { cat: 'indeterminate', scc: '2026-09-24T12:00:00.000+0000', created }),
      ...Array.from({ length: 9 }, (_, i) => openStory(`A-${i + 4}`, created)),
    ];
    const f = run(stories);
    expect(f.state).toBe('ok');
    expect(f.windowDays).toBe(5);
    expect(f.confidence).toBe('low');
    expect(f.nLikely).toBeGreaterThanOrEqual(15);
    expect(f.nLikely).toBeLessThanOrEqual(40);
    expect(f.nLikely).toBeLessThan(50);
    expect(f.nLikely).toBe(27);
    ordered(f);
  });

  it('(2) a 3-day-old high-velocity epic still forecasts', () => {
    const created = '2026-09-25T12:00:00.000+0000';
    const stories = [
      doneOn('B-1', '2026-09-30', created),
      doneOn('B-2', '2026-09-30', created),
      doneOn('B-3', '2026-09-29', created),
      doneOn('B-4', '2026-09-29', created),
      doneOn('B-5', '2026-09-28', created),
      doneOn('B-6', '2026-09-28', created),
      ...Array.from({ length: 6 }, (_, i) =>
        openStory(`B-${i + 7}`, '2026-09-28T09:00:00.000+0000'),
      ),
    ];
    const f = run(stories);
    expect(f.state).toBe('ok');
    expect(f.windowDays).toBe(3);
    expect(f.nLikely).toBe(3);
    expect(f.confidence).toBe('low');
    ordered(f);
  });

  it('(3) a steady long-running epic is high confidence with a narrow band', () => {
    const stories = [
      ...workingDaysBack(60).map((d, i) => doneOn(`C-${i + 1}`, d)),
      ...Array.from({ length: 20 }, (_, i) => openStory(`C-${100 + i}`)),
    ];
    const f = run(stories);
    expect(f.state).toBe('ok');
    expect(f.windowDays).toBe(30);
    expect(f.nLikely).toBe(20);
    expect(f.confidence).toBe('high');
    expect(((f.nPess as number) - (f.nOpt as number)) / (f.nLikely as number)).toBeLessThanOrEqual(
      0.5,
    );
    ordered(f);
  });

  it('(4) stalled when the last completion is 15 working days old', () => {
    const days = workingDaysBack(40).slice(15);
    const stories = [
      ...days.map((d, i) => doneOn(`D-${i + 1}`, d)),
      ...Array.from({ length: 5 }, (_, i) => openStory(`D-${100 + i}`)),
    ];
    const f = run(stories);
    expect(f.state).toBe('stalled');
    expect(f.likely).toBeNull();
    expect(f.optimistic).toBeNull();
    expect(f.pessimistic).toBeNull();
    expect(f.explanation).toContain('15 working days');
  });

  it('(5) not converging when scope grows faster than work completes', () => {
    const days = workingDaysBack(20);
    const stories: JiraIssue[] = days.map((d, i) => doneOn(`E-${i + 1}`, d));
    let n = 0;
    // 1.5 stories created per working day after the first activity (oldest day of `days`).
    days.slice(0, 19).forEach((d, i) => {
      stories.push(openStory(`E-${100 + n++}`, `${d}T12:00:00.000+0000`));
      if (i % 2 === 0) stories.push(openStory(`E-${100 + n++}`, `${d}T12:00:00.000+0000`));
    });
    const f = run(stories);
    expect(f.state).toBe('not-converging');
    expect(f.explanation).toMatch(/Scope grew .*\/wk vs .*\/wk done/);
    expect(f.likely).toBeNull();
  });

  it('(6) too early with a single completion on a 1-day-old epic', () => {
    const f = run([
      doneOn('F-1', WED, '2026-09-30T08:00:00.000+0000'),
      openStory('F-2', WED),
      openStory('F-3', WED),
    ]);
    expect(f.state).toBe('too-early');
  });

  it('(7) done when everything is done', () => {
    const f = run([doneOn('G-1', WED), doneOn('G-2', '2026-09-29')]);
    expect(f.state).toBe('done');
  });

  it('(8) time mode projects from the daily logged rate vs remaining time', () => {
    const days = workingDaysBack(12);
    const a = st('H-1', { created: '2026-09-01T10:00:00.000+0000', est: 158_400, spent: 86_400 });
    const logs = new Map<string, EpicWorklogDay[]>([
      ['H-1', days.map((day) => ({ day, seconds: 7200 }))],
    ]);
    expect(deriveTimeTotals([a]).remaining).toBe(72_000);
    const f = deriveTimeForecast([a], logs, WED);
    expect(f.state).toBe('ok');
    expect(f.nLikely).toBe(10);
    expect(f.windowDays).toBe(12);
    ordered(f);
  });

  it('counts a weekend completion toward the following Monday', () => {
    const base = {
      scopeAdds: [],
      remaining: 10,
      allDone: false,
      firstActivity: '2026-09-21',
      eventCount: 5,
      unit: 'count' as const,
    };
    const onSat = forecastFromThroughput(
      {
        ...base,
        completions: [
          { day: '2026-09-26', w: 5 },
          { day: WED, w: 1 },
        ],
      },
      WED,
    );
    const onMon = forecastFromThroughput(
      {
        ...base,
        completions: [
          { day: '2026-09-28', w: 5 },
          { day: WED, w: 1 },
        ],
      },
      WED,
    );
    expect(onSat).toEqual(onMon);
  });

  it('a 0-completion epic just past the too-early window is never "not converging"', () => {
    for (const scc of ['2026-09-16', '2026-09-17', '2026-09-18']) {
      const f = run([
        st('I-1', { cat: 'indeterminate', scc: `${scc}T12:00:00.000+0000`, created: '2026-09-01' }),
        openStory('I-2', '2026-09-01'),
      ]);
      expect(f.state).not.toBe('not-converging');
    }
  });

  it('a 0-completion epic with 10+ working days of in-progress activity is stalled', () => {
    const f = run([
      st('I-1', {
        cat: 'indeterminate',
        scc: '2026-09-10T12:00:00.000+0000',
        created: '2026-09-01',
      }),
      openStory('I-2', '2026-09-01'),
    ]);
    expect(f.state).toBe('stalled');
  });

  it('SP mode with 0 remaining but unestimated open work is ok with likely = today', () => {
    const stories = [
      st('J-1', { cat: 'done', sp: 3, res: '2026-09-29T12:00:00.000+0000', created: '2026-09-01' }),
      st('J-2', { created: '2026-09-01' }),
    ];
    const f = deriveAdaptiveForecast(stories, 'sp', SP, undefined, WED);
    expect(f.state).toBe('ok');
    expect(f.likely).toBe(WED);
    expect(f.explanation).toMatch(/unestimated/);
  });
});

describe('deriveSummary', () => {
  const stories = [
    st('A', { cat: 'done', sp: 3, assignee: 'X' }),
    st('B', { sp: 1, assignee: 'X' }),
    st('C', { cat: 'indeterminate' }),
    st('D', { cat: 'done' }),
  ];
  it('counts unestimated and unassigned open (count mode)', () => {
    expect(deriveSummary(stories, 'count', SP)).toMatchObject({
      unestimatedSp: 2,
      unassignedOpen: 1,
      pctDone: 50,
      count: 4,
      doneCount: 2,
      inProgressCount: 1,
      todoCount: 1,
      remainingCount: 2,
    });
  });
  it('SP mode counts unestimated as 0 and splits totals per category', () => {
    expect(deriveSummary(stories, 'sp', SP)).toMatchObject({
      pctDone: 75,
      total: 4,
      doneTotal: 3,
      inProgressTotal: 0,
      todoTotal: 1,
      remainingSp: 1,
    });
  });
  it('time totals: remaining seconds and unestimated open stories only', () => {
    const t = [
      st('A', { est: 7200, spent: 3600 }),
      st('B'),
      st('C', { cat: 'done' }),
      st('D', { cat: 'indeterminate', est: 3600, spent: 7200 }),
    ];
    const s = deriveSummary(t, 'time', SP);
    expect(s.remainingSeconds).toBe(3600);
    expect(s.unestimatedTime).toBe(1);
  });
});

describe('deriveAssigneeBuckets avatarUrl', () => {
  it('uses the 48x48 avatar when non-empty, else null; Unassigned is null', () => {
    const withUrl = st('A', { assignee: 'Amy' });
    (withUrl.fields.assignee as { avatarUrls: { '48x48': string } }).avatarUrls['48x48'] =
      'https://x/a.png';
    const b = deriveAssigneeBuckets([withUrl, st('B', { assignee: 'Bob' }), st('C')], 'count', SP);
    expect(b.find((x) => x.name === 'Amy')?.avatarUrl).toBe('https://x/a.png');
    expect(b.find((x) => x.name === 'Bob')?.avatarUrl).toBeNull();
    expect(b.find((x) => x.name === 'Unassigned')?.avatarUrl).toBeNull();
  });
});

describe('buildStatusCategoryLookup', () => {
  const list: JiraStatus[] = [
    { id: '1', name: 'To Do', statusCategory: { id: 2, key: 'new', name: 'To Do' } },
    {
      id: '2',
      name: 'In Review',
      statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
    },
  ];
  it('resolves id, then list name, then story name, then new', () => {
    const lookup = buildStatusCategoryLookup(list, [st('A', { status: 'Legacy', cat: 'done' })]);
    expect(lookup('2', null)).toBe('indeterminate');
    expect(lookup('999', 'In Review')).toBe('indeterminate');
    expect(lookup('999', 'Legacy')).toBe('done');
    expect(lookup('999', 'Mystery')).toBe('new');
    expect(lookup(null, null)).toBe('new');
  });
  it('works with no status list', () => {
    const lookup = buildStatusCategoryLookup(undefined, [st('A', { status: 'X', cat: 'done' })]);
    expect(lookup('9', 'X')).toBe('done');
  });
});

describe('deriveCfd', () => {
  const list: JiraStatus[] = [
    { id: '1', name: 'To Do', statusCategory: { id: 2, key: 'new', name: 'To Do' } },
    {
      id: '2',
      name: 'In Progress',
      statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
    },
    { id: '3', name: 'Done', statusCategory: { id: 3, key: 'done', name: 'Done' } },
  ];
  const tr = (
    at: string,
    fromId: string | null,
    toId: string | null,
    fromName: string | null = null,
    toName: string | null = null,
  ) => ({ at: `${at}T12:00:00.000+0000`, fromId, fromName, toId, toName });
  const H = (
    transitions: ReturnType<typeof tr>[],
    joinedAt: string | null = null,
  ): EpicStatusHistory => ({ transitions, joinedAt });
  const lookup = buildStatusCategoryLookup(list, []);
  const baseArgs = { lookup, metric: 'count' as const, spKey: SP, today: TODAY };
  const at = (pts: { date: string }[], d: string) => pts.find((p) => p.date === d);

  it('ends today on the current status when history ends on an unmapped status', () => {
    const s = st('U', { cat: 'done', created: '2026-09-01T10:00:00.000+0000' });
    const { points } = deriveCfd({
      ...baseArgs,
      stories: [s],
      history: new Map([['U', H([tr('2026-09-10', '1', '99', 'To Do', 'Mystery')])]]),
      epicCreated: '2026-09-01',
    });
    expect(points[points.length - 1]).toMatchObject({ done: 1, todo: 0, inProgress: 0 });
  });

  it('(a) real history: to do, then in progress, then done', () => {
    const s = st('A', { cat: 'done', created: '2026-09-01T10:00:00.000+0000' });
    const { points, approximate } = deriveCfd({
      ...baseArgs,
      stories: [s],
      history: new Map([['A', H([tr('2026-09-10', '1', '2'), tr('2026-09-15', '2', '3')])]]),
      epicCreated: '2026-09-01',
    });
    expect(approximate).toBe(false);
    expect(at(points, '2026-09-05')).toMatchObject({ todo: 1, inProgress: 0, done: 0 });
    expect(at(points, '2026-09-10')).toMatchObject({
      todo: 0,
      inProgress: 1,
      done: 0,
      remaining: 1,
    });
    expect(at(points, '2026-09-15')).toMatchObject({ inProgress: 0, done: 1, remaining: 0 });
  });

  it('(b) a story created before the epic enters on epicCreated in its category that day', () => {
    const s = st('A', { cat: 'done', created: '2026-08-01T10:00:00.000+0000' });
    const { points } = deriveCfd({
      ...baseArgs,
      stories: [s],
      history: new Map([['A', H([tr('2026-08-10', '1', '2'), tr('2026-09-12', '2', '3')])]]),
      epicCreated: '2026-09-10',
    });
    expect(points[0].date).toBe('2026-09-10');
    expect(points[0]).toMatchObject({ inProgress: 1, todo: 0, done: 0 });
    expect(at(points, '2026-09-12')).toMatchObject({ done: 1 });
  });

  it('(c) a truncated changelog anchors the initial category on the first from', () => {
    const s = st('A', { cat: 'done', created: '2026-09-01T10:00:00.000+0000' });
    const { points } = deriveCfd({
      ...baseArgs,
      stories: [s],
      history: new Map([['A', H([tr('2026-09-20', '2', '3')])]]),
      epicCreated: '2026-09-01',
    });
    expect(at(points, '2026-09-02')).toMatchObject({ inProgress: 1, todo: 0 });
    expect(at(points, '2026-09-20')).toMatchObject({ done: 1 });
  });

  it('(d) an unmapped id maps by name; an unknown status maps to new', () => {
    const s = st('A', { created: '2026-09-25T10:00:00.000+0000' });
    const { points } = deriveCfd({
      ...baseArgs,
      stories: [s],
      history: new Map([
        [
          'A',
          H([
            tr('2026-09-26', '1', '77', 'To Do', 'In Progress'),
            tr('2026-09-28', '77', '88', 'In Progress', 'Wat'),
          ]),
        ],
      ]),
      epicCreated: '2026-09-25',
    });
    expect(at(points, '2026-09-27')).toMatchObject({ inProgress: 1 });
    expect(at(points, '2026-09-29')).toMatchObject({ todo: 1, inProgress: 0 });
  });

  it('(e) null history falls back to the current-state approximation', () => {
    const stories = [
      st('A', { created: '2026-09-20' }),
      st('B', { cat: 'indeterminate', scc: '2026-09-25T10:00:00.000+0000', created: '2026-09-20' }),
      st('C', { cat: 'done', res: '2026-09-27T10:00:00.000+0000', created: '2026-09-20' }),
    ];
    const { points, approximate } = deriveCfd({
      ...baseArgs,
      stories,
      history: null,
      epicCreated: '2026-09-20',
    });
    expect(approximate).toBe(true);
    expect(at(points, '2026-09-21')).toMatchObject({ todo: 3, inProgress: 0, done: 0 });
    expect(at(points, '2026-09-25')).toMatchObject({ todo: 2, inProgress: 1, done: 0 });
    expect(at(points, '2026-09-27')).toMatchObject({ todo: 1, inProgress: 1, done: 1 });
  });

  it('(f) a story missing from the history map uses the fallback only for itself', () => {
    const stories = [
      st('A', { created: '2026-09-20' }),
      st('B', { cat: 'done', res: '2026-09-27T10:00:00.000+0000', created: '2026-09-20' }),
    ];
    const { points, approximate } = deriveCfd({
      ...baseArgs,
      stories,
      history: new Map([['A', H([])]]),
      epicCreated: '2026-09-20',
    });
    expect(approximate).toBe(true);
    expect(at(points, '2026-09-26')).toMatchObject({ todo: 2, done: 0 });
    expect(at(points, '2026-09-27')).toMatchObject({ todo: 1, done: 1 });
  });

  it('(g) remaining = inProgress + todo and the three sum to the entered weight (SP weights)', () => {
    const stories = [
      st('A', { cat: 'done', sp: 5, res: '2026-09-25T10:00:00.000+0000', created: '2026-09-20' }),
      st('B', { sp: 3, created: '2026-09-23' }),
    ];
    const { points } = deriveCfd({
      ...baseArgs,
      metric: 'sp',
      stories,
      history: null,
      epicCreated: '2026-09-20',
    });
    for (const p of points) {
      expect(p.remaining).toBe((p.inProgress as number) + (p.todo as number));
      const entered = (p.date >= '2026-09-20' ? 5 : 0) + (p.date >= '2026-09-23' ? 3 : 0);
      expect((p.done as number) + (p.inProgress as number) + (p.todo as number)).toBe(entered);
    }
    expect(points[points.length - 1]).toMatchObject({ done: 5, todo: 3 });
  });

  it('(h) a done date past local today clamps to today', () => {
    const s = st('X-1', {
      cat: 'done',
      created: '2026-09-30',
      res: '2026-10-02T00:30:00.000+0200',
    });
    const { points } = deriveCfd({
      ...baseArgs,
      stories: [s],
      history: null,
      epicCreated: undefined,
    });
    expect(points[points.length - 1]).toMatchObject({ date: TODAY, done: 1, remaining: 0 });
    expect(at(points, '2026-09-30')).toMatchObject({ todo: 1, done: 0 });
  });

  it('(i) the axis is daily at any span (402 days gives 402 rows) and ends today', () => {
    const daily = deriveCfd({
      ...baseArgs,
      stories: [st('A', { created: '2026-06-03' })],
      history: null,
      epicCreated: undefined,
    });
    expect(daily.points).toHaveLength(121);
    const long = deriveCfd({
      ...baseArgs,
      stories: [st('A', { created: '2025-08-26' })],
      history: null,
      epicCreated: undefined,
    });
    expect(long.points).toHaveLength(402);
    expect(long.points[long.points.length - 1].date).toBe(TODAY);
    expect(long.points[0].date).toBe('2025-08-26');
  });

  it('(j) no created dates and no epicCreated gives no points', () => {
    const none = { ...baseArgs, history: null, epicCreated: undefined };
    expect(deriveCfd({ ...none, stories: [st('A')] }).points).toEqual([]);
    expect(deriveCfd({ ...none, stories: [] }).points).toEqual([]);
  });
});

describe('deriveProjection / withProjection', () => {
  const ok: EpicForecast = {
    state: 'ok',
    likely: addWorkingDays(WED, 5),
    optimistic: addWorkingDays(WED, 4),
    pessimistic: addWorkingDays(WED, 8),
    nLikely: 5,
    nOpt: 4,
    nPess: 8,
    remaining: 10,
    ratePerWeek: 5,
    scopeRatePerWeek: 0,
    windowDays: 10,
    completions: 5,
    confidence: 'medium',
    explanation: '',
  };
  it('projects today, optimistic, likely and pessimistic with a band', () => {
    const { points, clippedAfter } = deriveProjection(ok, WED, '2026-09-01');
    expect(clippedAfter).toBeNull();
    expect(points.map((p) => p.date)).toEqual([
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);
    const dates = points.map((p) => p.date);
    expect(dates).toContain(ok.optimistic);
    expect(dates).toContain(ok.likely);
    expect(dates).toContain(ok.pessimistic);
    expect(points[0]).toMatchObject({ forecast: 10, band: [10, 10], wd: 0 });
    const likely = points.find((p) => p.date === ok.likely) as (typeof points)[number];
    expect(likely.forecast).toBe(0);
    expect(likely.band).toEqual([0, 10 - (10 / 8) * 5]);
    for (const p of points) {
      expect(p.forecast).toBeGreaterThanOrEqual(0);
      expect(p.band[0]).toBeGreaterThanOrEqual(0);
      expect(p.band[1]).toBeGreaterThanOrEqual(p.band[0]);
    }
  });
  it('clips a pessimistic date beyond the cap', () => {
    const far: EpicForecast = { ...ok, pessimistic: '2027-06-01', nPess: 200 };
    const { points, clippedAfter } = deriveProjection(far, WED, '2026-09-20');
    expect(clippedAfter).toBe('2026-11-29');
    expect(points[points.length - 1].date).toBe('2026-11-29');
  });
  it('is empty for non-ok states', () => {
    expect(deriveProjection({ ...ok, state: 'stalled' }, WED, null).points).toEqual([]);
  });
  it('withProjection pins today to remaining and appends null-series future points', () => {
    const base = [
      { date: '2026-09-29', t: Date.UTC(2026, 8, 29), label: 'Sep 29', done: 1, remaining: 12 },
      { date: WED, t: Date.UTC(2026, 8, 30), label: 'Sep 30', done: 2, remaining: 10 },
    ];
    const merged = withProjection(base, deriveProjection(ok, WED, '2026-09-29'));
    expect(merged[0]).toMatchObject({ forecast: null, band: null });
    expect(merged[1]).toMatchObject({ forecast: 10, band: [10, 10] });
    expect(merged[1].wd).toBe(0);
    expect(merged).toHaveLength(14);
    expect(merged[2]).toMatchObject({ done: null, remaining: null });
    expect(merged.map((p) => p.t)).toEqual([...merged.map((p) => p.t)].sort((a, b) => a - b));
  });
});

// ── 261001-qvu ───────────────────────────────────────────────────────────────

const okForecast = (o: Partial<EpicForecast> = {}): EpicForecast => ({
  state: 'ok',
  likely: addWorkingDays(WED, 10),
  optimistic: addWorkingDays(WED, 8),
  pessimistic: addWorkingDays(WED, 14),
  nLikely: 10,
  nOpt: 8,
  nPess: 14,
  remaining: 10,
  ratePerWeek: 5,
  scopeRatePerWeek: 0,
  windowDays: 10,
  completions: 5,
  confidence: 'medium',
  explanation: 'ok-expl',
  ...o,
});
const stateForecast = (state: EpicForecast['state'], o: Partial<EpicForecast> = {}) =>
  okForecast({
    state,
    likely: null,
    optimistic: null,
    pessimistic: null,
    nLikely: null,
    nOpt: null,
    nPess: null,
    confidence: null,
    explanation: `${state}-expl`,
    ...o,
  });

describe('work calendar (261001-qvu)', () => {
  const hol = (...days: string[]) => buildWorkCalendar(new Map(days.map((d) => [d, 'HOLIDAY'])));

  it('skips a holiday inside the projection', () => {
    const cal = hol('2026-10-02');
    expect(addWorkingDays(WED, 2, cal)).toBe('2026-10-05');
    expect(workingDaysBetween(WED, '2026-10-05', cal)).toBe(2);
    expect(holidaysBetween(cal, WED, '2026-10-05')).toBe(1);
  });
  it('handles weekend and holiday adjacency', () => {
    const cal = hol('2026-10-05');
    expect(addWorkingDays('2026-10-02', 1, cal)).toBe('2026-10-06');
    expect(addWorkingDays('2026-10-05', 1, cal)).toBe('2026-10-06');
  });
  it('ignores a Tempo working day on a weekend and reports the source', () => {
    const cal = buildWorkCalendar(new Map([['2026-10-03', 'WORKING_DAY']]));
    expect(cal.isWorkingDay('2026-10-03')).toBe(false);
    expect(cal.source).toBe('tempo');
    expect(buildWorkCalendar(new Map()).source).toBe('weekends');
    expect(buildWorkCalendar(null)).toBe(DEFAULT_CALENDAR);
  });
  it('ignores malformed keys and unknown types', () => {
    const cal = buildWorkCalendar(
      new Map([
        ['garbage', 'HOLIDAY'],
        ['2026-10-02', 'SOMETHING'],
      ]),
    );
    expect(cal.holidays).toEqual([]);
  });
  it('a holiday inside the sampling window does not lower the rate', () => {
    const days = workingDaysBack(10);
    const thu = '2026-09-24';
    const cal = hol(thu);
    const completions = days.filter((d) => d !== thu).map((day) => ({ day, w: 1 }));
    const input = {
      completions,
      scopeAdds: [],
      remaining: 10,
      allDone: false,
      firstActivity: days[days.length - 1],
      eventCount: 9,
      unit: 'count' as const,
    };
    expect(forecastFromThroughput(input, WED, cal).ratePerWeek).toBeCloseTo(5, 5);
    // Holiday-less calendar sees a zero day and a lower pace.
    const noHol = forecastFromThroughput(input, WED);
    expect(noHol.ratePerWeek).toBeLessThan(5);
  });
  it('pushes the likely date one working day when a holiday falls inside', () => {
    const stories = [
      ...workingDaysBack(10).map((d, i) => doneOn(`D-${i}`, d)),
      openStory('O-1'),
      openStory('O-2'),
    ];
    const plain = deriveAdaptiveForecast(stories, 'count', SP, undefined, WED);
    expect(plain.state).toBe('ok');
    const likely = plain.likely as string;
    const cal = hol(addWorkingDays(WED, 1));
    const withHol = deriveAdaptiveForecast(stories, 'count', SP, undefined, WED, cal);
    expect(withHol.state).toBe('ok');
    expect(withHol.likely).toBe(addWorkingDays(likely, 1));
  });
});

describe('averageForecasts (261001-qvu)', () => {
  it('averages offsets, flags disagreement and lowers confidence', () => {
    const a = okForecast({ nLikely: 10, nOpt: 8, nPess: 14, confidence: 'medium' });
    const b = okForecast({ nLikely: 20, nOpt: 16, nPess: 30, confidence: 'high' });
    const r = averageForecasts(
      [
        { metric: 'count', forecast: a },
        { metric: 'sp', forecast: b },
      ],
      WED,
    );
    expect(r).toMatchObject({ state: 'ok', nLikely: 15, nOpt: 12, nPess: 22, disagree: true });
    expect(r.likely).toBe(addWorkingDays(WED, 15));
    expect(r.confidence).toBe('low');
    expect(r.explanation).toContain('Items and SP');
    expect(r.explanation).not.toContain('disagree');
  });
  it('keeps the lowest confidence when contributors agree', () => {
    const r = averageForecasts(
      [
        {
          metric: 'count',
          forecast: okForecast({ nLikely: 5, nOpt: 4, nPess: 8, confidence: 'high' }),
        },
        {
          metric: 'sp',
          forecast: okForecast({ nLikely: 6, nOpt: 5, nPess: 9, confidence: 'high' }),
        },
      ],
      WED,
    );
    expect(r.disagree).toBe(false);
    expect(r.confidence).toBe('high');
  });
  it('excludes unavailable metrics with reasons', () => {
    const r = averageForecasts(
      [
        { metric: 'count', forecast: okForecast() },
        { metric: 'sp', forecast: okForecast({ nLikely: 0, nOpt: 0, nPess: 0 }) },
        { metric: 'time', forecast: null, pending: 'loading' },
      ],
      WED,
    );
    expect(r.nLikely).toBe(10);
    expect(r.parts.map((p) => [p.metric, p.included, p.reason])).toEqual([
      ['count', true, null],
      ['sp', false, 'no estimates'],
      ['time', false, 'loading'],
    ]);
    expect(r.explanation).toContain('Items');
    expect(r.explanation).not.toContain('SP');
  });
  it('explains time exclusions', () => {
    const reasons = (part: { forecast: EpicForecast | null; pending?: 'loading' | 'error' }) =>
      averageForecasts([{ metric: 'time', ...part }], WED).parts[0].reason;
    expect(reasons({ forecast: null, pending: 'error' })).toBe('unavailable');
    expect(reasons({ forecast: stateForecast('too-early', { completions: 0 }) })).toBe(
      'no logged time',
    );
    expect(reasons({ forecast: stateForecast('too-early', { completions: 3 }) })).toBe('too early');
  });
  it('falls back to state messaging when nothing contributes', () => {
    const stalledMix = averageForecasts(
      [
        { metric: 'count', forecast: stateForecast('stalled') },
        { metric: 'sp', forecast: stateForecast('too-early') },
        { metric: 'time', forecast: null, pending: 'loading' },
      ],
      WED,
    );
    expect(stalledMix).toMatchObject({
      state: 'stalled',
      explanation: 'stalled-expl',
      likely: null,
    });
    expect(
      averageForecasts(
        [
          { metric: 'count', forecast: stateForecast('not-converging') },
          { metric: 'sp', forecast: stateForecast('too-early') },
        ],
        WED,
      ).state,
    ).toBe('not-converging');
    expect(
      averageForecasts([{ metric: 'count', forecast: stateForecast('too-early') }], WED).state,
    ).toBe('too-early');
    expect(
      averageForecasts(
        [
          { metric: 'count', forecast: stateForecast('done') },
          { metric: 'time', forecast: null, pending: 'loading' },
        ],
        WED,
      ).state,
    ).toBe('done');
    expect(averageForecasts([], WED).state).toBe('too-early');
  });
  it('keeps nOpt <= nLikely <= nPess and every n >= 1', () => {
    const r = averageForecasts(
      [
        { metric: 'count', forecast: okForecast({ nLikely: 1, nOpt: 1, nPess: 1 }) },
        { metric: 'sp', forecast: okForecast({ nLikely: 2, nOpt: 1, nPess: 2 }) },
      ],
      WED,
    );
    const { nOpt, nLikely, nPess } = r;
    expect(nOpt).not.toBeNull();
    expect((nOpt as number) <= (nLikely as number)).toBe(true);
    expect((nLikely as number) <= (nPess as number)).toBe(true);
    expect(nOpt as number).toBeGreaterThanOrEqual(1);
  });
});

describe('deriveProjection per-day points (261001-qvu)', () => {
  const ok = okForecast({
    nLikely: 5,
    nOpt: 4,
    nPess: 8,
    likely: addWorkingDays(WED, 5),
    optimistic: addWorkingDays(WED, 4),
    pessimistic: addWorkingDays(WED, 8),
  });
  it('is flat on weekends and wd is non-decreasing', () => {
    const { points } = deriveProjection(ok, WED, '2026-09-01');
    const byDate = new Map(points.map((p) => [p.date, p]));
    const fri = byDate.get('2026-10-02');
    for (const d of ['2026-10-03', '2026-10-04']) {
      const p = byDate.get(d);
      expect(p?.workingDay).toBe(false);
      expect(p?.forecast).toBe(fri?.forecast);
      expect(p?.band).toEqual(fri?.band);
    }
    const wds = points.map((p) => p.wd);
    expect(wds).toEqual([...wds].sort((a, b) => a - b));
  });
  it('marks a holiday as non-working with the previous day values', () => {
    const cal = buildWorkCalendar(new Map([['2026-10-02', 'HOLIDAY']]));
    const f = okForecast({
      nLikely: 5,
      nOpt: 4,
      nPess: 8,
      likely: addWorkingDays(WED, 5, cal),
      optimistic: addWorkingDays(WED, 4, cal),
      pessimistic: addWorkingDays(WED, 8, cal),
    });
    const { points } = deriveProjection(f, WED, '2026-09-01', cal);
    const byDate = new Map(points.map((p) => [p.date, p]));
    expect(byDate.get('2026-10-02')?.workingDay).toBe(false);
    expect(byDate.get('2026-10-02')?.forecast).toBe(byDate.get('2026-10-01')?.forecast);
  });
  it('caps long horizons while keeping the key dates', () => {
    const far = okForecast({
      nLikely: 100,
      nOpt: 90,
      nPess: 400,
      likely: addWorkingDays(WED, 100),
      optimistic: addWorkingDays(WED, 90),
      pessimistic: addWorkingDays(WED, 400),
    });
    const { points } = deriveProjection(far, WED, '2025-01-01');
    expect(points.length).toBeLessThanOrEqual(PROJECTION_MAX_POINTS);
    const dates = points.map((p) => p.date);
    expect(dates).toContain(far.optimistic);
    expect(dates).toContain(far.likely);
    expect(dates[0]).toBe(WED);
  });
});

describe('deriveRisks (261001-qvu)', () => {
  const stories = [
    st('A-1', { cat: 'done', sp: 3, assignee: 'Amy', res: '2026-09-29T10:00:00.000+0000' }),
    st('A-2', { cat: 'indeterminate', sp: 2, assignee: 'Amy' }),
    st('A-3', { sp: 2 }),
    st('A-4', { assignee: 'Bob' }),
  ];
  const fin = (parts: AveragedForecast['parts'] = [], o: Partial<AveragedForecast> = {}) =>
    ({
      state: 'too-early',
      likely: null,
      optimistic: null,
      pessimistic: null,
      nLikely: null,
      nOpt: null,
      nPess: null,
      confidence: null,
      disagree: false,
      parts,
      explanation: '',
      ...o,
    }) as AveragedForecast;
  const base = { stories, spKey: SP, dueDate: null, today: WED };

  it('unestimated risk counts open items only (done stories without SP are ignored)', () => {
    const withDone = [...stories, st('A-5', { cat: 'done', res: '2026-09-28T10:00:00.000+0000' })];
    const r = deriveRisks({ ...base, stories: withDone, finish: fin() });
    const u = r.find((x) => x.key === 'unestimated');
    expect(u?.count).toBe(1);
    expect(u?.issues.map((i) => i.key)).toEqual(['A-4']);
  });

  it('reports unestimated and unassigned info risks', () => {
    const r = deriveRisks({ ...base, finish: fin() });
    expect(r.map((x) => [x.key, x.text, x.severity])).toEqual([
      ['unestimated', '1 unestimated', 'info'],
      ['unassigned', '1 unassigned', 'info'],
    ]);
    expect(r[0].issues).toEqual([{ key: 'A-4', summary: 'A-4' }]);
    expect(r[1].issues).toEqual([{ key: 'A-3', summary: 'A-3' }]);
  });
  it('flags overdue first, and late when the forecast passes the due date', () => {
    const over = deriveRisks({ ...base, finish: fin(), dueDate: '2026-09-20' });
    expect(over[0]).toMatchObject({
      key: 'overdue',
      severity: 'warning',
      text: 'Overdue 10 days',
    });
    // 261002-0xf: overdue has no issue list (the Stories list already shows open items);
    // supersedes 261002-0et WR-01.
    expect(over[0]).toMatchObject({ chip: '10d', issues: [] });
    const one = deriveRisks({ ...base, finish: fin(), dueDate: '2026-09-29' });
    expect(one[0].text).toBe('Overdue 1 day');
    const late = deriveRisks({
      ...base,
      dueDate: '2026-10-05',
      finish: fin([], { state: 'ok', likely: '2026-10-09' }),
    });
    expect(late[0]).toMatchObject({
      key: 'late',
      severity: 'warning',
      text: 'Finishes 4 days after due date',
      chip: '+4d',
      issues: [],
    });
    const done = deriveRisks({
      ...base,
      stories: [stories[0]],
      dueDate: '2026-09-20',
      finish: fin(),
    });
    expect(done.find((x) => x.key === 'overdue' || x.key === 'late')).toBeUndefined();
  });
  it('flags stalled, not-converging and significant scope growth', () => {
    const parts = (f: EpicForecast) => [
      { metric: 'count' as const, forecast: f, included: false, reason: null },
    ];
    // Finish already says "Stalled": no duplicate risk.
    const finishStalled = deriveRisks({
      ...base,
      finish: fin(parts(stateForecast('stalled')), { state: 'stalled' }),
    });
    expect(finishStalled.find((x) => x.key === 'stalled')).toBeUndefined();
    // Finish ok but a contributing view stalled: the risk shows, and scope is suppressed.
    const okFin = { state: 'ok' as const, likely: '2026-10-20' };
    const stalled = deriveRisks({
      ...base,
      finish: fin(
        [
          ...parts(stateForecast('stalled')),
          {
            metric: 'sp' as const,
            forecast: stateForecast('not-converging'),
            included: false,
            reason: null,
          },
        ],
        okFin,
      ),
    });
    expect(stalled.find((x) => x.key === 'stalled')).toMatchObject({
      severity: 'warning',
      detail: 'stalled-expl',
    });
    expect(stalled.find((x) => x.key === 'scope')).toBeUndefined();
    // A view not converging while Finish is ok -> scope warning; omitted when Finish says it.
    const nc = deriveRisks({ ...base, finish: fin(parts(stateForecast('not-converging')), okFin) });
    expect(nc.find((x) => x.key === 'scope')?.severity).toBe('warning');
    const ncFinish = deriveRisks({
      ...base,
      finish: fin(parts(stateForecast('not-converging')), { state: 'not-converging' }),
    });
    expect(ncFinish.find((x) => x.key === 'scope')).toBeUndefined();
    const growth = deriveRisks({
      ...base,
      finish: fin(parts(okForecast({ ratePerWeek: 4, scopeRatePerWeek: 2 }))),
    });
    expect(growth.find((x) => x.key === 'scope')?.severity).toBe('info');
    const calm = deriveRisks({
      ...base,
      finish: fin(parts(okForecast({ ratePerWeek: 4, scopeRatePerWeek: 1 }))),
    });
    expect(calm.find((x) => x.key === 'scope')).toBeUndefined();
  });
  it('blank summaries show a placeholder instead of an empty row', () => {
    const blank = st('B-1', { sp: 1 });
    (blank.fields as { summary: string }).summary = '   ';
    const r = deriveRisks({ ...base, stories: [blank], finish: fin() });
    expect(r.find((x) => x.key === 'unassigned')?.issues[0].summary).toBe('(no summary)');
  });

  it('orders warnings first; overdue has no issues', () => {
    const many = Array.from({ length: 5 }, (_, i) => st(`M-${i + 1}`, { sp: 1 }));
    const r = deriveRisks({ ...base, stories: many, dueDate: '2026-09-01', finish: fin() });
    expect(r[0].key).toBe('overdue');
    expect(r[0].issues).toEqual([]);
    expect(r.find((x) => x.key === 'unassigned')?.issues.map((i) => i.key)).toEqual([
      'M-1',
      'M-2',
      'M-3',
      'M-4',
      'M-5',
    ]);
    const sevs = r.map((x) => x.severity);
    expect(sevs).toEqual([...sevs].sort((a, b) => (a === b ? 0 : a === 'warning' ? -1 : 1)));
  });
  it('risks are tab-independent: unestimated means neither points nor a time estimate', () => {
    const mixed = [
      st('U-1', { sp: 3 }), // points only -> estimated
      st('U-2', { est: 3600 }), // time only -> estimated
      st('U-3', {}), // neither -> unestimated
    ];
    const r = deriveRisks({ ...base, stories: mixed, finish: fin() });
    const u = r.find((x) => x.key === 'unestimated');
    expect(u?.count).toBe(1);
    expect(u?.issues.map((i) => i.key)).toEqual(['U-3']);
    expect(u?.detail).toBe('Open items with no points or time estimate');
  });

  it('never returns more than 4 risks', () => {
    const many = Array.from({ length: 6 }, (_, i) => st(`R-${i + 1}`, {}));
    const r = deriveRisks({ ...base, stories: many, dueDate: '2026-09-01', finish: fin() });
    expect(r.length).toBeLessThanOrEqual(4);
  });
});

describe('projectFinish (261001-rtw)', () => {
  const mk = () =>
    averageForecasts(
      [
        {
          metric: 'count',
          forecast: okForecast({ nLikely: 5, nOpt: 4, nPess: 8, confidence: 'high' }),
        },
        {
          metric: 'sp',
          forecast: okForecast({ nLikely: 5, nOpt: 4, nPess: 8, confidence: 'high' }),
        },
      ],
      WED,
    );
  it('scales by remaining with identical dates and working days', () => {
    const finish = mk();
    const a = projectFinish(finish, 10, WED, '2026-09-01').points;
    const b = projectFinish(finish, 40, WED, '2026-09-01').points;
    expect(a.map((p) => p.date)).toEqual(b.map((p) => p.date));
    expect(a.map((p) => p.wd)).toEqual(b.map((p) => p.wd));
    a.forEach((p, i) => {
      expect(b[i].forecast).toBeCloseTo(p.forecast * 4, 6);
      expect(b[i].band[0]).toBeCloseTo(p.band[0] * 4, 6);
      expect(b[i].band[1]).toBeCloseTo(p.band[1] * 4, 6);
    });
  });
  it('reaches 0 at the averaged dates', () => {
    const finish = mk();
    const { points } = projectFinish(finish, 10, WED, '2026-09-01');
    expect(points[0]).toMatchObject({ forecast: 10, band: [10, 10], wd: 0 });
    const at = (d: string | null) => points.find((p) => p.date === d);
    expect(at(finish.likely)?.forecast).toBe(0);
    expect(at(finish.optimistic)?.band[0]).toBe(0);
    expect(at(finish.pessimistic)?.band[1]).toBe(0);
  });
  it('is empty for non-ok states and zero remaining', () => {
    const finish = mk();
    expect(projectFinish(finish, 0, WED, null).points).toEqual([]);
    const states = [
      averageForecasts([{ metric: 'count', forecast: okForecast({ state: 'done' }) }], WED),
      averageForecasts([{ metric: 'count', forecast: okForecast({ state: 'stalled' }) }], WED),
      averageForecasts([{ metric: 'count', forecast: okForecast({ state: 'too-early' }) }], WED),
      averageForecasts(
        [{ metric: 'count', forecast: okForecast({ state: 'not-converging' }) }],
        WED,
      ),
    ];
    for (const f of states) {
      expect(f.state).not.toBe('ok');
      expect(projectFinish(f, 10, WED, null).points).toEqual([]);
    }
  });
  it('is flat on holidays like deriveProjection', () => {
    const cal = buildWorkCalendar(new Map([['2026-10-02', 'HOLIDAY']]));
    const finish = averageForecasts(
      [{ metric: 'count', forecast: okForecast({ nLikely: 5, nOpt: 4, nPess: 8 }) }],
      WED,
      cal,
    );
    const { points } = projectFinish(finish, 10, WED, '2026-09-01', cal);
    const by = new Map(points.map((p) => [p.date, p]));
    expect(by.get('2026-10-02')?.workingDay).toBe(false);
    expect(by.get('2026-10-02')?.forecast).toBe(by.get('2026-10-01')?.forecast);
  });
});

describe('status bands (261001-rtw)', () => {
  const H = 3600;
  const stories = [
    st('A', { cat: 'done', sp: 3, est: H, assignee: 'Amy' }),
    st('B', { cat: 'indeterminate', sp: 2, est: 2 * H, spent: 5 * H, assignee: 'Amy' }),
    st('C', { sp: 5, est: 2 * H, assignee: 'Bob' }),
    st('D', { sp: 1, assignee: null }),
  ];
  it('assignee buckets sum to the summary bands for every metric', () => {
    for (const metric of ['count', 'sp', 'time'] as const) {
      const bk = deriveAssigneeBuckets(stories, metric, SP);
      const sum = { done: 0, inProgress: 0, todo: 0 };
      for (const b of bk) {
        sum.done += b.done;
        sum.inProgress += b.inProgress;
        sum.todo += b.todo;
      }
      expect(sum).toEqual(summaryBands(deriveSummary(stories, metric, SP)));
    }
  });
  it('time bands are estimate sums, not logged', () => {
    const b = summaryBands(deriveSummary(stories, 'time', SP));
    expect(b.done).toBe(H);
    expect(b.todo).toBe(2 * H);
  });
  it('bandPct / bandTotal', () => {
    expect(bandPct({ done: 1, inProgress: 1, todo: 2 }, 'todo')).toBe(50);
    expect(bandPct({ done: 0, inProgress: 0, todo: 0 }, 'done')).toBe(0);
    expect(bandTotal({ done: 1, inProgress: 2, todo: 3 })).toBe(6);
    expect(BANDS.map((x) => x.cat)).toEqual(['done', 'indeterminate', 'new']);
  });
  it('formatChip', () => {
    expect(formatChip(2, 'count')).toBe('2');
    expect(formatChip(2.25, 'sp')).toBe('2.3');
    expect(formatChip(5400, 'time')).toBe('1h 30m');
    expect(formatChip(0, 'time')).toBe('0m');
  });
  it('time burnup remaining today equals the totals remaining', () => {
    const ss = [
      st('O1', { est: 2 * H, spent: 3 * H, created: '2026-09-28' }),
      st('O2', { est: 4 * H, spent: H, created: '2026-09-28' }),
      st('D1', { est: H, spent: H, cat: 'done', res: '2026-09-30', created: '2026-09-28' }),
    ];
    const wl = new Map([
      ['O1', [{ day: '2026-09-29', seconds: 3 * H }]],
      ['O2', [{ day: '2026-09-29', seconds: H }]],
      ['D1', [{ day: '2026-09-29', seconds: H }]],
    ]);
    const pts = deriveTimeBurnup(ss, wl, undefined, TODAY);
    const last = pts[pts.length - 1];
    expect(last.estimate - last.logged).toBe(deriveTimeTotals(ss).remaining);
  });
});

describe('finish helpers (261001-rtw)', () => {
  const finish = averageForecasts(
    [
      { metric: 'count', forecast: okForecast({ nLikely: 5, nOpt: 4, nPess: 8 }) },
      { metric: 'sp', forecast: okForecast({ nLikely: 5, nOpt: 4, nPess: 8 }) },
    ],
    WED,
  );
  it('finishDateRows', () => {
    const rows = finishDateRows(finish);
    expect(rows.map((r) => r.label)).toEqual(['Likely', 'Earliest', 'Latest']);
    expect(rows.map((r) => r.date)).toEqual([finish.likely, finish.optimistic, finish.pessimistic]);
    expect(rows.map((r) => r.n)).toEqual([5, 4, 8]);
    const done = averageForecasts(
      [{ metric: 'count', forecast: okForecast({ state: 'done' }) }],
      WED,
    );
    expect(finishDateRows(done)).toEqual([]);
  });
  it('state text', () => {
    expect(FINISH_STATE_TEXT).toEqual({
      done: 'Complete',
      'too-early': 'Too early',
      stalled: 'Stalled',
      'not-converging': 'No end date',
    });
  });
  it('formatFinishDate', () => {
    expect(formatFinishDate('2026-10-07', WED)).toBe('Oct 7');
    expect(formatFinishDate('2027-01-04', WED)).toBe('Jan 4, 2027');
  });
});

// ── 261001-sqm ───────────────────────────────────────────────────────────────

describe('261001-sqm lib', () => {
  const T = '2026-10-01';
  const H = 3600;
  const logOn = (day: string, seconds: number): EpicWorklogDay =>
    ({ day, seconds }) as EpicWorklogDay;
  const mkFinish = (o: Partial<AveragedForecast> = {}, parts: AveragedForecast['parts'] = []) =>
    ({
      state: 'too-early',
      likely: null,
      optimistic: null,
      pessimistic: null,
      nLikely: null,
      nOpt: null,
      nPess: null,
      confidence: null,
      disagree: false,
      parts,
      explanation: '',
      ...o,
    }) as AveragedForecast;
  const part = (
    metric: 'count' | 'sp' | 'time',
    f: Partial<EpicForecast>,
  ): AveragedForecast['parts'][number] => ({
    metric,
    forecast: okForecast(f),
    included: true,
    reason: null,
  });
  const okFinish = (parts: AveragedForecast['parts'], o: Partial<AveragedForecast> = {}) =>
    mkFinish({ state: 'ok', confidence: 'medium', ...o }, parts);

  describe('chartAxisStart', () => {
    it('uses the epic day when it precedes today', () => {
      expect(chartAxisStart([st('A', { created: '2026-09-20' })], '2026-09-10', T)).toBe(
        '2026-09-10',
      );
    });
    it('falls back to the earliest story day for a future or missing epic', () => {
      const stories = [st('A', { created: '2026-09-25' }), st('B', { created: '2026-09-22' })];
      expect(chartAxisStart(stories, '2027-01-01', T)).toBe('2026-09-22');
      expect(chartAxisStart(stories, undefined, T)).toBe('2026-09-22');
    });
    it('is null when nothing is valid', () => {
      expect(chartAxisStart([st('A')], undefined, T)).toBeNull();
    });
  });

  describe('shared sampling', () => {
    it('CFD and Time start and sample identically', () => {
      const stories = [st('A', { created: '2026-03-01', est: H })];
      const cfd = deriveCfd({
        stories,
        history: null,
        lookup: () => 'new',
        metric: 'count',
        spKey: SP,
        epicCreated: '2026-01-01',
        today: T,
      });
      const time = deriveTimeBurnup(stories, new Map(), '2026-01-01', T);
      expect(time.map((p) => p.date)).toEqual(cfd.points.map((p) => p.date));
      expect(time.map((p) => p.date)).toEqual(historyDates('2026-01-01', T));
      expect(cfd.points.length).toBeGreaterThan(2);
    });
    it('historyDates is always daily and ends on today', () => {
      expect(historyDates('2026-09-28', T)).toHaveLength(4);
      const long = historyDates('2025-01-01', T);
      expect(long[0]).toBe('2025-01-01');
      expect(long[long.length - 1]).toBe(T);
      expect(long).toHaveLength(639);
      expect(historyDates('2024-10-02', '2026-10-02')).toHaveLength(731);
    });
    it('keeps estimate >= logged with a log before the axis start', () => {
      const pts = deriveTimeBurnup(
        [st('A', { est: 0, created: '2026-09-30' })],
        new Map([['A', [logOn('2026-09-20', H)]]]),
        undefined,
        T,
      );
      expect(pts[0].logged).toBe(H);
      for (const p of pts) expect(p.estimate).toBeGreaterThanOrEqual(p.logged);
    });
  });

  describe('chartDomain / padToDomain', () => {
    it('extends to the latest forecast date for an ok finish', () => {
      const d = chartDomain('2026-09-01', T, mkFinish({ state: 'ok', pessimistic: '2026-10-20' }));
      expect(d).toEqual({ from: '2026-09-01', to: '2026-10-20', clippedAfter: null });
    });
    it('ends at today for a not-ok finish and is null without a start', () => {
      expect(chartDomain('2026-09-01', T, mkFinish())?.to).toBe(T);
      expect(chartDomain(null, T, mkFinish())).toBeNull();
    });
    it('clips beyond the projection cap', () => {
      const cap = projectionCap(T, '2026-09-01');
      const d = chartDomain('2026-09-01', T, mkFinish({ state: 'ok', pessimistic: '2030-01-01' }));
      expect(d).toMatchObject({ to: cap, clippedAfter: cap });
    });
    it('padToDomain appends one blank row, or nothing when already reached', () => {
      const pts = [
        { date: '2026-09-30', t: dateKeyMs('2026-09-30'), label: 'x', v: 1 as number | null },
      ];
      const out = padToDomain(pts, '2026-10-05');
      expect(out).toHaveLength(2);
      expect(out[1]).toMatchObject({ date: '2026-10-05', v: null, label: 'Oct 5' });
      expect(padToDomain(pts, '2026-09-30')).toBe(pts);
    });
  });

  describe('presetRange / clampRange', () => {
    const domain = { from: '2026-03-01', to: '2026-11-01' };
    it('1m and 3m end today; short domains clamp', () => {
      expect(presetRange('1m', domain, T)).toEqual({ from: '2026-09-01', to: T });
      expect(presetRange('3m', { from: '2026-09-20', to: T }, T)).toEqual({
        from: '2026-09-20',
        to: T,
      });
    });
    it('forecast spans today-14 to the domain end, or null at today', () => {
      expect(presetRange('forecast', domain, T)).toEqual({ from: '2026-09-17', to: '2026-11-01' });
      expect(presetRange('forecast', { from: '2026-09-01', to: T }, T)).toBeNull();
    });
    it('all returns the domain', () => {
      expect(presetRange('all', domain, T)).toBe(domain);
    });
    it('clampRange clamps and falls back to the domain', () => {
      expect(clampRange({ from: '2025-01-01', to: '2030-01-01' }, domain)).toEqual(domain);
      expect(clampRange({ from: '2026-05-01', to: '2026-05-01' }, domain)).toEqual(domain);
    });
  });

  describe('confidenceReason', () => {
    it('is null unless ok with an included part', () => {
      expect(confidenceReason(mkFinish())).toBeNull();
      expect(confidenceReason(okFinish([]))).toBeNull();
    });
    it('reports disagreement in working days', () => {
      const f = okFinish([part('count', { nLikely: 4 }), part('time', { nLikely: 10 })], {
        disagree: true,
      });
      expect(confidenceReason(f)).toBe('Views disagree by 6 working days');
    });
    it('low: short history, few completions, singular, time noun', () => {
      expect(
        confidenceReason(okFinish([part('count', { confidence: 'low', windowDays: 6 })])),
      ).toBe('Only 6 working days of history');
      expect(
        confidenceReason(
          okFinish([part('count', { confidence: 'low', windowDays: 12, completions: 3 })]),
        ),
      ).toBe('Only 3 completions in 12 working days');
      expect(
        confidenceReason(
          okFinish([part('sp', { confidence: 'low', windowDays: 12, completions: 1 })]),
        ),
      ).toBe('Only 1 completion in 12 working days');
      expect(
        confidenceReason(
          okFinish([part('time', { confidence: 'low', windowDays: 12, completions: 3 })]),
        ),
      ).toBe('Only 3 logged days in 12 working days');
    });
    it('medium: wide range once history and completions are sufficient', () => {
      const f = okFinish([
        part('count', { confidence: 'medium', windowDays: 25, completions: 9, nOpt: 5, nPess: 20 }),
      ]);
      expect(confidenceReason(f)).toBe('Wide range: 5–20 working days');
    });
    it('high: steady pace', () => {
      const f = okFinish([part('count', { confidence: 'high', windowDays: 30, completions: 12 })], {
        confidence: 'high',
      });
      expect(confidenceReason(f)).toBe('Steady pace over 30 working days');
    });
    it('uses the weakest part, first on ties', () => {
      const f = okFinish([
        part('count', { confidence: 'high', windowDays: 30 }),
        part('sp', { confidence: 'low', windowDays: 5 }),
        part('time', { confidence: 'low', windowDays: 8 }),
      ]);
      expect(confidenceReason(f)).toBe('Only 5 working days of history');
    });
    it('every reason fits on one line (<= CONFIDENCE_REASON_MAX)', () => {
      const big = { windowDays: 999, completions: 999, nOpt: 999, nPess: 9999, nLikely: 9999 };
      const reasons = [
        confidenceReason(
          okFinish([part('count', { nLikely: 0 }), part('time', { nLikely: 9999 })], {
            disagree: true,
          }),
        ),
        confidenceReason(okFinish([part('count', { ...big, confidence: 'low', windowDays: 9 })])),
        ...(['count', 'sp', 'time'] as const).map((m) =>
          confidenceReason(okFinish([part(m, { ...big, confidence: 'low' })])),
        ),
        confidenceReason(
          okFinish([part('count', { ...big, confidence: 'medium', windowDays: 19 })]),
        ),
        confidenceReason(
          okFinish([part('time', { ...big, confidence: 'medium', completions: 7 })]),
        ),
        confidenceReason(okFinish([part('count', { ...big, confidence: 'medium' })])),
        confidenceReason(okFinish([part('count', { ...big, confidence: 'high' })])),
      ];
      for (const r of reasons) {
        expect(r).not.toBeNull();
        expect((r as string).length).toBeLessThanOrEqual(CONFIDENCE_REASON_MAX);
      }
    });
  });

  describe('zoom threshold and visible presets (261002-0et)', () => {
    const TODAY = '2026-09-30';
    it('is enabled only above ZOOM_MIN_DAYS (28/29-day boundary)', () => {
      expect(ZOOM_MIN_DAYS).toBe(28);
      expect(zoomEnabled({ from: '2026-08-01', to: '2026-08-29' })).toBe(false);
      expect(zoomEnabled({ from: '2026-08-01', to: '2026-08-30' })).toBe(true);
    });
    it('returns no presets when zoom is disabled', () => {
      expect(visiblePresets({ from: '2026-09-10', to: '2026-09-30' }, TODAY)).toEqual([]);
    });
    it('long domain (> 240d) with a future shows the long adaptive set', () => {
      expect(visiblePresets({ from: '2026-01-01', to: '2026-11-01' }, TODAY)).toEqual([
        'all',
        '6m',
        '3m',
        '1m',
        'forecast',
      ]);
    });
    it('hides Forecast without a future and presets that would not cut history', () => {
      expect(visiblePresets({ from: '2026-08-01', to: TODAY }, TODAY)).toEqual(['all', '2w']);
      expect(visiblePresets({ from: '2026-08-11', to: '2026-10-30' }, TODAY)).toEqual([
        'all',
        '2w',
        'forecast',
      ]);
    });
    it('hides 1M when the domain starts exactly 30 days before today', () => {
      const p = visiblePresets({ from: '2026-08-31', to: '2026-12-30' }, TODAY);
      expect(p).not.toContain('1m');
      expect(p).toContain('2w');
    });
    it('never offers a lone "All" (domain just over 28 days, all presets clipped)', () => {
      // 29-day domain wholly in the future: every preset's range starts at/before the domain start
      const d = { from: '2026-10-05', to: '2026-11-03' };
      expect(zoomEnabled(d)).toBe(true);
      expect(visiblePresets(d, TODAY)).toEqual([]);
    });
  });

  describe('finishStateSub', () => {
    it('gives a short sub-line per non-ok state and none when ok', () => {
      expect(finishStateSub(mkFinish({ state: 'ok' }))).toBeNull();
      expect(finishStateSub(mkFinish({ state: 'done' }))).toBe('All work done');
      expect(finishStateSub(mkFinish({ state: 'too-early' }))).toBe('Needs more completed work');
      expect(finishStateSub(mkFinish({ state: 'not-converging' }))).toBe(
        'Scope grows faster than done',
      );
      expect(finishStateSub(mkFinish({ state: 'stalled' }))).toBe('No recent progress');
      expect(
        finishStateSub(
          mkFinish({ state: 'stalled' }, [
            part('count', { state: 'stalled', explanation: 'No progress in 12 working days.' }),
          ]),
        ),
      ).toBe('No progress in 12 working days');
    });
  });

  it('HISTORY_SOURCE_TEXT is short', () => {
    for (const t of Object.values(HISTORY_SOURCE_TEXT)) {
      expect(t.split(/\s+/).length).toBeLessThanOrEqual(5);
    }
  });

  describe('sourceNote', () => {
    const tempo = buildWorkCalendar(new Map([['2026-10-05', 'HOLIDAY']]));
    const base = { history: 'real', worklogs: 'loaded', calendar: tempo } as const;
    it('is null when every source is real', () => {
      expect(sourceNote({ metric: 'count', ...base })).toBeNull();
      expect(sourceNote({ metric: 'time', ...base })).toBeNull();
    });
    it('names history tokens on Count/SP and worklog tokens on Time', () => {
      expect(sourceNote({ metric: 'sp', ...base, history: 'partial' })).toBe(
        'Partial status history',
      );
      expect(sourceNote({ metric: 'count', ...base, history: 'loading' })).toBe(
        'Status history loading',
      );
      expect(sourceNote({ metric: 'count', ...base, history: 'unavailable' })).toBe(
        'No status history',
      );
      expect(sourceNote({ metric: 'time', ...base, worklogs: 'loading' })).toBe('Worklogs loading');
      expect(sourceNote({ metric: 'time', ...base, worklogs: 'unavailable' })).toBe(
        'Worklogs unavailable',
      );
      // History state is irrelevant on the Time tab.
      expect(sourceNote({ metric: 'time', ...base, history: 'loading' })).toBeNull();
    });
    it('adds the calendar token, at most 2 tokens, within 8 words', () => {
      expect(sourceNote({ metric: 'count', ...base, calendar: DEFAULT_CALENDAR })).toBe(
        'No holiday calendar',
      );
      const both = sourceNote({
        metric: 'count',
        ...base,
        history: 'partial',
        calendar: DEFAULT_CALENDAR,
      });
      expect(both).toBe('Partial status history \u00b7 No holiday calendar');
      expect((both ?? '').split(/\s+/).filter((w) => /\w/.test(w)).length).toBeLessThanOrEqual(8);
    });
  });

  it('deriveRisks lists every affected issue (7 unassigned -> 7 issues)', () => {
    const many = Array.from({ length: 7 }, (_, i) => st(`Z-${i + 1}`, { sp: 1 }));
    const r = deriveRisks({
      stories: many,
      spKey: SP,
      finish: mkFinish(),
      dueDate: '2026-09-01',
      today: T,
    });
    const unassigned = r.find((x) => x.key === 'unassigned');
    expect(unassigned?.issues).toHaveLength(7);
    expect('moreKeys' in (unassigned ?? {})).toBe(false);
  });
});

describe('zoom range matrix (261002-0xf)', () => {
  const T = '2026-10-02';
  const rowsOf = (from: string, to: string) => {
    const out: { date: string; t: number }[] = [];
    for (let d = from; d <= to; d = addCalendarDays(d, 1)) out.push({ date: d, t: dateKeyMs(d) });
    return out;
  };
  const dim = (a: string, b: string) => Math.round((dateKeyMs(b) - dateKeyMs(a)) / 86_400_000);
  const MIN = ZOOM_MIN_SPAN_DAYS;

  it('A: 35d domain enables zoom with [all, 2w, forecast]', () => {
    const d = { from: '2026-09-11', to: '2026-10-16' };
    expect(zoomEnabled(d)).toBe(true);
    expect(visiblePresets(d, T)).toEqual(['all', '2w', 'forecast']);
  });
  it('B: 91d domain offers 1m/2w/forecast; forecast preset starts 14d before today', () => {
    const d = { from: '2026-08-28', to: '2026-11-27' };
    expect(visiblePresets(d, T)).toEqual(['all', '1m', '2w', 'forecast']);
    expect(presetRange('forecast', d, T)).toEqual({ from: '2026-09-18', to: '2026-11-27' });
    const [today] = rangeToOffsets({ from: T, to: d.to }, d);
    expect(today / spanDays(d)).toBeCloseTo(0.38, 1);
  });
  it('C: 70d domain without a future offers [all, 2w]; 1M ends today', () => {
    const d = { from: '2026-07-24', to: T };
    expect(visiblePresets(d, T)).toEqual(['all', '2w']);
    expect(presetRange('1m', d, T)).toEqual({ from: '2026-09-02', to: T });
  });
  it('D: 126d domain offers [all, 1m, 2w, forecast]', () => {
    expect(visiblePresets({ from: '2026-07-02', to: '2026-11-06' }, T)).toEqual([
      'all',
      '1m',
      '2w',
      'forecast',
    ]);
  });
  it('E: 250d domain offers the long set; today at 50%; 2W keeps 15 daily rows', () => {
    const d = { from: addCalendarDays(T, -125), to: addCalendarDays(T, 125) };
    expect(visiblePresets(d, T)).toEqual(['all', '3m', '1m', 'forecast']);
    const [today] = rangeToOffsets({ from: T, to: d.to }, d);
    expect(today / spanDays(d)).toBe(0.5);
    const r = presetRange('2w', d, T) as { from: string; to: string };
    const inWin = viewSample(rowsOf(d.from, d.to), r).filter(
      (x) => x.date >= r.from && x.date <= r.to,
    );
    expect(inWin).toHaveLength(15);
  });
  it('F: one-year domain offers 6m/3m/1m/forecast; ticks are monthly and carry the year', () => {
    const d = { from: '2026-01-02', to: '2027-01-02' };
    expect(visiblePresets(d, T)).toEqual(['all', '6m', '3m', '1m', 'forecast']);
    const ticks = timeTicks(d.from, d.to, 640);
    expect(ticks.length).toBeLessThanOrEqual(8);
    expect(ticks[0].label).toContain('2026');
    expect(ticks.map((x) => x.label)).toContain('Jan 2027');
  });
  it('G: far pessimistic finish is clipped to the projection cap; <= 260 sampled rows', () => {
    const start = '2025-10-02';
    const finish = { state: 'ok', pessimistic: '2030-01-01' } as unknown as AveragedForecast;
    const d = chartDomain(start, T, finish);
    expect(d).not.toBeNull();
    const dom = d as NonNullable<typeof d>;
    expect(dom.to).toBe(projectionCap(T, start));
    expect(dom.clippedAfter).toBe(dom.to);
    expect(viewSample(rowsOf(dom.from, dom.to), dom).length).toBeLessThanOrEqual(260);
  });
  it('H: 2y domain samples <= 260 at All, keeps 15 daily rows at 2W, last tick near the end', () => {
    const d = { from: '2025-04-02', to: '2027-04-02' };
    const rows = rowsOf(d.from, d.to);
    expect(rows).toHaveLength(731);
    expect(viewSample(rows, d).length).toBeLessThanOrEqual(260);
    const w = { from: '2026-09-18', to: T };
    const inWin = viewSample(rows, w).filter((x) => x.date >= w.from && x.date <= w.to);
    expect(inWin).toHaveLength(15);
    const ticks = timeTicks(d.from, d.to, 640);
    const lastDate = new Date(ticks[ticks.length - 1].t).toISOString().slice(0, 10);
    expect(dim(lastDate, d.to)).toBeLessThanOrEqual(92);
  });

  describe('viewSample', () => {
    const rows = rowsOf('2026-01-01', '2026-12-31');
    it('keeps every in-window row plus one neighbour each side when under budget', () => {
      const out = viewSample(rows, { from: '2026-03-10', to: '2026-03-20' });
      expect(out[0].date).toBe('2026-03-09');
      expect(out[out.length - 1].date).toBe('2026-03-21');
      expect(out).toHaveLength(13);
    });
    it('thins above budget; keeps ends, neighbours and keep dates; sorted and unique', () => {
      const out = viewSample(rows, { from: '2026-01-02', to: '2026-12-30' }, 50, ['2026-06-15']);
      expect(out.length).toBeLessThanOrEqual(50 + 1 + 2);
      const dates = out.map((x) => x.date);
      for (const k of ['2026-01-01', '2026-01-02', '2026-12-30', '2026-12-31', '2026-06-15']) {
        expect(dates).toContain(k);
      }
      expect([...dates].sort()).toEqual(dates);
      expect(new Set(dates).size).toBe(dates.length);
    });
    it('default budget is VIEW_MAX_POINTS', () => {
      const out = viewSample(rows, { from: '2026-01-01', to: '2026-12-31' });
      expect(out.length).toBeLessThanOrEqual(VIEW_MAX_POINTS + 2);
    });
  });

  describe('timeTicks', () => {
    it('single-day range gives one tick at from', () => {
      expect(timeTicks('2026-09-14', '2026-09-14', 600)).toEqual([
        { t: dateKeyMs('2026-09-14'), label: 'Sep 14' },
      ]);
    });
    it('short range uses day ticks labelled "Sep 14"', () => {
      const t = timeTicks('2026-09-14', '2026-09-18', 600);
      expect(t.map((x) => x.label)).toEqual(['Sep 14', 'Sep 15', 'Sep 16', 'Sep 17', 'Sep 18']);
    });
    it('week ticks land on Mondays', () => {
      const t = timeTicks('2026-09-01', '2026-10-15', 600);
      for (const x of t) expect(new Date(x.t).getUTCDay()).toBe(1);
      expect(t.length).toBeLessThanOrEqual(8);
    });
    it('every tick is within [from, to]', () => {
      for (const x of timeTicks('2026-02-03', '2026-11-20', 480)) {
        expect(x.t).toBeGreaterThanOrEqual(dateKeyMs('2026-02-03'));
        expect(x.t).toBeLessThanOrEqual(dateKeyMs('2026-11-20'));
      }
    });
    it('panning a 30-day window by 1 day keeps every shared tick and label', () => {
      const a = timeTicks('2026-09-01', '2026-10-01', 600);
      const b = new Map(timeTicks('2026-09-02', '2026-10-02', 600).map((x) => [x.t, x.label]));
      const shared = a.filter((x) => b.has(x.t));
      expect(shared.length).toBeGreaterThan(0);
      for (const x of shared) expect(b.get(x.t)).toBe(x.label);
    });
  });

  describe('offsets, pan, clamp, rebase', () => {
    const dom = { from: '2026-09-01', to: '2026-10-01' };
    it('rangeToOffsets / offsetsToRange round-trip', () => {
      const r = { from: '2026-09-05', to: '2026-09-20' };
      const o = rangeToOffsets(r, dom);
      expect(o).toEqual([4, 19]);
      expect(offsetsToRange(o, dom)).toEqual(r);
    });
    it('panRange keeps the span and clamps both ends', () => {
      const r = { from: '2026-09-05', to: '2026-09-15' };
      expect(panRange(r, dom, 3)).toEqual({ from: '2026-09-08', to: '2026-09-18' });
      expect(panRange(r, dom, -100)).toEqual({ from: '2026-09-01', to: '2026-09-11' });
      expect(panRange(r, dom, 100)).toEqual({ from: '2026-09-21', to: '2026-10-01' });
    });
    it('panDeltaDays maps pixels to whole days', () => {
      expect(panDeltaDays(150, 100, 500, 30)).toBe(3);
      expect(panDeltaDays(50, 100, 500, 30)).toBe(-3);
      expect(panDeltaDays(100, 100, 500, 30)).toBe(0);
      expect(panDeltaDays(900, 100, 0, 30)).toBe(0);
    });
    it('clampRange widens spans below minSpan; every result spans >= minSpan', () => {
      expect(MIN).toBe(7);
      expect(clampRange({ from: '2026-09-10', to: '2026-09-12' }, dom, MIN)).toEqual({
        from: '2026-09-10',
        to: '2026-09-17',
      });
      const edge = clampRange({ from: '2026-09-29', to: '2026-09-30' }, dom, MIN);
      expect(spanDays(edge)).toBeGreaterThanOrEqual(MIN);
      expect(edge.to).toBe('2026-10-01');
      expect(clampRange({ from: '2026-09-10', to: '2026-09-10' }, dom, MIN)).toEqual(dom);
      // sweep: every committed range keeps the minimum span
      for (let a = 0; a < 30; a++) {
        for (let b = a; b < 30; b++) {
          const r = clampRange(offsetsToRange([a, b], dom), dom, MIN);
          expect(spanDays(r)).toBeGreaterThanOrEqual(MIN);
        }
      }
    });
    it('rebaseRange follows a new domain end only when pinned to the old one', () => {
      const next = { from: '2026-09-01', to: '2026-10-10' };
      expect(
        rebaseRange({ from: '2026-09-15', to: '2026-10-01' }, '2026-10-01', next, MIN),
      ).toEqual({ from: '2026-09-15', to: '2026-10-10' });
      expect(
        rebaseRange({ from: '2026-09-05', to: '2026-09-20' }, '2026-10-01', next, MIN),
      ).toEqual({ from: '2026-09-05', to: '2026-09-20' });
      const tiny = rebaseRange({ from: '2026-09-09', to: '2026-09-10' }, '2026-10-01', next, MIN);
      expect(spanDays(tiny)).toBeGreaterThanOrEqual(MIN);
    });
    it('panning a minimum-span range never shrinks it', () => {
      const r = { from: '2026-09-10', to: '2026-09-17' };
      for (const delta of [-50, -3, 0, 4, 50]) {
        expect(spanDays(panRange(r, dom, delta))).toBe(MIN);
      }
    });
  });

  it('adaptive preset thresholds are exported', () => {
    expect(PRESET_SHORT_MAX_DAYS).toBe(90);
    expect(PRESET_MEDIUM_MAX_DAYS).toBe(240);
  });

  describe('formatDateRange / formatMonthYear', () => {
    it('same month', () => {
      expect(formatDateRange('2026-10-09', '2026-10-28', T)).toBe('Oct 9 – 28');
    });
    it('cross month', () => {
      expect(formatDateRange('2026-10-09', '2026-11-02', T)).toBe('Oct 9 – Nov 2');
    });
    it('next-year suffix', () => {
      expect(formatDateRange('2026-12-20', '2027-01-05', T)).toBe("Dec 20 – Jan 5 '27");
    });
    it('formatMonthYear', () => {
      expect(formatMonthYear('2026-03-14')).toBe('Mar 2026');
    });
  });
});
