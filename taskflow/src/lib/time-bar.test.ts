import { describe, expect, it } from 'vitest';
import { type TimedSource, timeBarIssues, timeBarModel } from './time-bar';

const H = 3600;

function src(
  cat: 'new' | 'indeterminate' | 'done',
  t: { spent?: number; est?: number; rem?: number } = {},
  agg: Partial<TimedSource['fields']> = {},
): TimedSource {
  return {
    key: 'X-1',
    fields: {
      status: { statusCategory: { key: cat } },
      timetracking: {
        timeSpentSeconds: t.spent === undefined ? undefined : t.spent * H,
        originalEstimateSeconds: t.est === undefined ? undefined : t.est * H,
        remainingEstimateSeconds: t.rem === undefined ? undefined : t.rem * H,
      },
      ...agg,
    },
  };
}

const model = (s: TimedSource, subs?: TimedSource[]) => timeBarModel(timeBarIssues(s, subs));
const parts = (s: TimedSource, subs?: TimedSource[]) =>
  model(s, subs).segments.map((g) => `${g.cat}:${g.part}:${g.seconds / H}${g.severe ? '!' : ''}`);

// One case per state in the 261105-dsl sketch (option A).
describe('timeBarModel — every bar state', () => {
  it('To Do, nothing logged: all remaining, no overrun', () => {
    expect(parts(src('new', { spent: 0, est: 4, rem: 4 }))).toEqual(['new:remaining:4']);
  });

  it('To Do, some time logged: logged + remaining', () => {
    expect(parts(src('new', { spent: 1, est: 4, rem: 3 }))).toEqual([
      'new:logged:1',
      'new:remaining:3',
    ]);
  });

  it('In progress, on track', () => {
    const m = model(src('indeterminate', { spent: 1, est: 4, rem: 3 }));
    expect(m).toMatchObject({ logged: H, remaining: 3 * H, estimate: 4 * H, over: 0, under: 0 });
    expect(m.loggedOverrun).toBe('none');
  });

  it('In progress, will overrun: Jira remaining beyond the estimate is a forecast overspend', () => {
    expect(parts(src('indeterminate', { spent: 3, est: 4, rem: 3 }))).toEqual([
      'indeterminate:logged:3!',
      'indeterminate:remaining:1!',
      'indeterminate:remainingOver:2!',
    ]);
    const m = model(src('indeterminate', { spent: 3, est: 4, rem: 3 }));
    expect(m.over).toBe(2 * H);
    expect(m.loggedOverrun).toBe('none');
  });

  it('Logged over, within 125%: amber caption', () => {
    const m = model(src('indeterminate', { spent: 4.5, est: 4, rem: 0.5 }));
    expect(m.loggedOverrun).toBe('amber');
    expect(parts(src('indeterminate', { spent: 4.5, est: 4, rem: 0.5 }))).toEqual([
      'indeterminate:logged:4',
      'indeterminate:loggedOver:0.5',
      'indeterminate:remainingOver:0.5',
    ]);
  });

  it('Logged over 125%: red', () => {
    const m = model(src('indeterminate', { spent: 6, est: 4, rem: 1 }));
    expect(m.loggedOverrun).toBe('red');
    expect(m.segments.every((g) => g.severe)).toBe(true);
  });

  it('Done under estimate: no remaining (Jira zeroes it), under budget shown', () => {
    const m = model(src('done', { spent: 3, est: 4, rem: 0 }));
    expect(parts(src('done', { spent: 3, est: 4, rem: 0 }))).toEqual(['done:logged:3']);
    expect(m.under).toBe(H);
  });

  it('Done on / over estimate', () => {
    expect(model(src('done', { spent: 4, est: 4 })).loggedOverrun).toBe('none');
    expect(model(src('done', { spent: 5, est: 4 })).loggedOverrun).toBe('amber');
  });

  it('remaining falls back to estimate − logged when Jira has none', () => {
    expect(model(src('indeterminate', { spent: 1, est: 4 })).remaining).toBe(3 * H);
  });

  it('No estimate, time logged: estimate 0, logged kept', () => {
    const m = model(src('indeterminate', { spent: 2 }));
    expect(m).toMatchObject({ estimate: 0, logged: 2 * H });
  });

  it('Tempo-style remaining without an original estimate becomes logged + remaining', () => {
    expect(model(src('indeterminate', { spent: 1, rem: 4 })).estimate).toBe(5 * H);
  });

  it('Story with mixed subtasks splits by subtask status', () => {
    const story = src('indeterminate', {});
    const subs = [
      src('done', { spent: 2, est: 2, rem: 0 }),
      src('indeterminate', { spent: 1, est: 3, rem: 2 }),
      src('new', { spent: 0, est: 2, rem: 2 }),
    ];
    expect(parts(story, subs)).toEqual([
      'done:logged:2',
      'indeterminate:logged:1',
      'indeterminate:remaining:2',
      'new:remaining:2',
    ]);
    expect(model(story, subs).estimate).toBe(7 * H);
  });
});

describe('timeBarIssues — sources', () => {
  it('a story without subtask data uses Jira aggregates (Tempo time the nested object misses)', () => {
    const story = src(
      'indeterminate',
      {},
      {
        aggregatetimespent: 5 * H,
        aggregatetimeoriginalestimate: 8 * H,
        aggregatetimeestimate: 4 * H,
      },
    );
    expect(model(story)).toMatchObject({ logged: 5 * H, estimate: 8 * H, remaining: 4 * H });
  });

  it('with subtasks, the story own part is aggregate − subtasks so totals equal Jira', () => {
    const story = src(
      'indeterminate',
      {},
      {
        aggregatetimespent: 5 * H,
        aggregatetimeoriginalestimate: 8 * H,
      },
    );
    const subs = [src('done', { spent: 2, est: 3, rem: 0 })];
    const m = model(story, subs);
    expect(m.logged).toBe(5 * H);
    expect(m.estimate).toBe(8 * H);
  });

  it('a subtask ignores the subtasks argument', () => {
    const s = src('indeterminate', { spent: 1, est: 2 });
    const issues = timeBarIssues(s, [src('done', { spent: 99, est: 99 })], { isSubtask: true });
    expect(timeBarModel(issues).estimate).toBe(2 * H);
  });

  it('a subtask with an empty nested timetracking uses Jira aggregates (estimate counted)', () => {
    const s = src(
      'indeterminate',
      {},
      {
        aggregatetimespent: 1 * H,
        aggregatetimeoriginalestimate: 3 * H,
        aggregatetimeestimate: 2 * H,
      },
    );
    const issues = timeBarIssues(s, null, { isSubtask: true });
    expect(timeBarModel(issues)).toMatchObject({
      logged: 1 * H,
      estimate: 3 * H,
      remaining: 2 * H,
    });
  });

  it('a subtask falls back to top-level timeoriginalestimate / timeestimate', () => {
    const s = src('indeterminate', {}, { timeoriginalestimate: 4 * H, timeestimate: 3 * H });
    const issues = timeBarIssues(s, null, { isSubtask: true });
    expect(timeBarModel(issues)).toMatchObject({ estimate: 4 * H, remaining: 3 * H });
  });

  it('a story total is its own estimate + every subtask estimate (Jira aggregates)', () => {
    // Story own 2h + subtasks 3h + 1h = 6h aggregate.
    const story = src(
      'indeterminate',
      { est: 2 },
      { aggregatetimeoriginalestimate: 6 * H, aggregatetimespent: 0 },
    );
    const subs = [src('new', { est: 3 }), src('new', { est: 1 })];
    expect(model(story, subs).estimate).toBe(6 * H);
  });

  it('a story total is own + subtasks without aggregates too', () => {
    const story = src('indeterminate', { est: 2, spent: 1 });
    const subs = [src('new', { est: 3 }), src('done', { est: 1, spent: 1 })];
    expect(model(story, subs)).toMatchObject({ estimate: 6 * H, logged: 2 * H });
  });

  it('timespent fills in when nested timeSpentSeconds is missing', () => {
    const s: TimedSource = {
      fields: { status: { statusCategory: { key: 'new' } }, timespent: 2 * H },
    };
    expect(model(s).logged).toBe(2 * H);
  });
});
