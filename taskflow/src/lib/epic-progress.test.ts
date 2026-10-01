import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import {
  catOf,
  deriveAssigneeBuckets,
  deriveBurnup,
  deriveForecast,
  deriveStatusBuckets,
  deriveTimeTotals,
  formatMetric,
  doneDateKey,
  weightOf,
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

describe('deriveBurnup', () => {
  it('returns [] when no story has created', () => {
    expect(deriveBurnup([st('A')], 'count', SP, '2026-09-01', TODAY)).toEqual([]);
    expect(deriveBurnup([], 'count', SP, '2026-09-01', TODAY)).toEqual([]);
  });
  it('is daily for spans <= 31 days with cumulative scope/done', () => {
    const stories = [
      st('A', { created: '2026-09-28', cat: 'done', res: '2026-09-30T00:00:00.000+0000' }),
      st('B', { created: '2026-09-30' }),
    ];
    const pts = deriveBurnup(stories, 'count', SP, '2026-09-29', TODAY);
    expect(pts[0].date).toBe('2026-09-28');
    expect(pts[pts.length - 1].date).toBe(TODAY);
    expect(pts).toHaveLength(4);
    expect(pts.map((p) => p.scope)).toEqual([1, 1, 2, 2]);
    expect(pts.map((p) => p.done)).toEqual([0, 0, 1, 1]);
  });
  it('is weekly for long spans with a final point at today', () => {
    const pts = deriveBurnup([st('A', { created: '2026-06-01' })], 'count', SP, undefined, TODAY);
    expect(pts[0].date).toBe('2026-06-07');
    expect(pts[pts.length - 1].date).toBe(TODAY);
    expect(pts[0].label).toBe('Jun 7');
  });
  it('starts at epic creation when earlier than stories and clamps done to scope', () => {
    const stories = [st('A', { created: '2026-09-30', cat: 'done', res: '2026-09-29' })];
    const pts = deriveBurnup(stories, 'count', SP, '2026-09-27', TODAY);
    expect(pts[0].date).toBe('2026-09-27');
    expect(pts.every((p) => p.done <= p.scope)).toBe(true);
  });
  it('uses SP weights', () => {
    const pts = deriveBurnup(
      [st('A', { created: '2026-09-30', sp: 8 })],
      'sp',
      SP,
      undefined,
      TODAY,
    );
    expect(pts[pts.length - 1].scope).toBe(8);
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

describe('deriveForecast', () => {
  it('reports done when everything is done', () => {
    const f = deriveForecast([st('A', { cat: 'done' })], 'count', SP, TODAY);
    expect(f).toMatchObject({ reason: 'done', finishDate: null, pctDone: 100 });
  });
  it('is insufficient with fewer than 2 recent completions', () => {
    const stories = [st('A', { cat: 'done', res: '2026-09-25' }), st('B')];
    expect(deriveForecast(stories, 'count', SP, TODAY).reason).toBe('insufficient');
    const old = [
      st('A', { cat: 'done', res: '2026-01-01' }),
      st('B', { cat: 'done', res: '2026-01-02' }),
      st('C'),
    ];
    expect(deriveForecast(old, 'count', SP, TODAY).reason).toBe('insufficient');
  });
  it('projects finish from 4-week throughput', () => {
    const stories = [
      st('A', { cat: 'done', res: '2026-09-25' }),
      st('B', { cat: 'done', res: '2026-09-26' }),
      st('C'),
      st('D'),
    ];
    // 2 done / 4 weeks = 0.5 per week; remaining 2 -> 4 weeks -> 28 days
    const f = deriveForecast(stories, 'count', SP, TODAY);
    expect(f).toMatchObject({ reason: 'ok', finishDate: '2026-10-29', pctDone: 50 });
  });
  it('counts unestimated and unassigned open; SP mode counts unestimated as 0', () => {
    const stories = [
      st('A', { cat: 'done', sp: 3, assignee: 'X' }),
      st('B', { sp: 1, assignee: 'X' }),
      st('C', { cat: 'indeterminate' }),
      st('D', { cat: 'done' }),
    ];
    const c = deriveForecast(stories, 'count', SP, TODAY);
    expect(c).toMatchObject({ unestimated: 2, unassignedOpen: 1, pctDone: 50 });
    const s = deriveForecast(stories, 'sp', SP, TODAY);
    expect(s).toMatchObject({ pctDone: 75, total: 4, doneTotal: 3 });
  });
});

describe('review fixes (261001-fmk)', () => {
  it('clamps a done date past local today to today, so burnup and % done agree', () => {
    const s = st('X-1', {
      cat: 'done',
      created: '2026-09-30',
      res: '2026-10-02T00:30:00.000+0200',
    });
    expect(doneDateKey(s, TODAY)).toBe(TODAY);
    const last = deriveBurnup([s], 'count', SP, undefined, TODAY).slice(-1)[0];
    expect(last).toMatchObject({ date: TODAY, scope: 1, done: 1 });
  });

  it('counts a story created past local today in scope at today', () => {
    const s = st('X-2', { created: '2026-10-02T00:10:00.000+0200' });
    expect(deriveBurnup([s], 'count', SP, undefined, TODAY).slice(-1)[0]).toMatchObject({
      scope: 1,
    });
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

  it('burnup in time mode accumulates estimates by created and done date', () => {
    const stories = [
      st('A', { created: '2026-09-29', cat: 'done', res: '2026-09-30', est: 3600 }),
      st('B', { created: '2026-09-30', est: 7200 }),
    ];
    const pts = deriveBurnup(stories, 'time', SP, undefined, '2026-10-01');
    const last = pts[pts.length - 1];
    expect(last.scope).toBe(10800);
    expect(last.done).toBe(3600);
    expect(pts.find((p) => p.date === '2026-09-29')?.scope).toBe(3600);
  });

  it('deriveTimeTotals sums and guards zero estimate', () => {
    const r = deriveTimeTotals([
      st('A', { est: 3600, spent: 1800, rem: 1800 }),
      st('B', { est: 7200, spent: 3600 }),
      st('C'),
    ]);
    expect(r).toEqual({ estimated: 10800, logged: 5400, remaining: 1800, pctLogged: 50 });
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
