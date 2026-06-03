/**
 * Tests for adapter.ts — adaptIssue + createAdapter.
 *
 * Coverage (Phase 71-05 plan, §<behavior>):
 *   A. Full-iteration over real-capture fixture (success criterion #4)
 *   B. D-02 story-points gate (statFieldId match)
 *   C. D-03 done-override of statusCategory
 *   D. D-07 missing-status fallback + warnOnce side-effect
 *   E. D-11 subtask: parentId/parentKey → fields.parent
 *   F. D-11 epic + flagged variants
 *   G. timeInColumn passthrough
 *
 * No new JSON fixture files — edge cases handwritten inline.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import allData from './__fixtures__/allData.real.json';
import { adaptIssue, createAdapter } from './adapter';
import { __resetWarnOnce, buildEntityMaps } from './entityMaps';
import type { EntityMaps, GhAllDataResponse, GhBoardIssue, GhIssue } from './types';

const typed = allData as unknown as GhAllDataResponse;
const maps = buildEntityMaps(typed);

// Pick a real, well-behaved fixture issue we can clone to build edge variants.
const realIssue = typed.issuesData.issues[0];
if (!realIssue) throw new Error('fixture allData.real.json has no issues[0]');

/** Build a complete GhBoardIssue-shaped edge fixture by cloning + overriding the
 *  real fixture issue. Keeps every required field typed and avoids re-writing
 *  the whole shape for each test. */
function edge(overrides: Partial<GhBoardIssue>): GhBoardIssue {
  return {
    ...realIssue,
    ...overrides,
    // estimateStatistic defaults to a non-storyPoints field so D-02 gate is off by default.
    estimateStatistic: overrides.estimateStatistic ?? {
      statFieldId: 'timetracking',
      statFieldValue: { value: 99 },
    },
    trackingStatistic: overrides.trackingStatistic ?? {
      statFieldId: 'timeestimate',
      statFieldValue: {},
    },
  } as GhBoardIssue;
}

beforeEach(() => {
  __resetWarnOnce();
});

describe('adaptIssue — Group A: full-iteration over real fixture (success criterion #4)', () => {
  it('produces a JiraIssue-shaped object for every issue without throwing', () => {
    for (const gh of typed.issuesData.issues) {
      const out = adaptIssue(gh, maps, 'customfield_10016');
      expect(out.id).toBe(String(gh.id));
      expect(out.key).toBe(gh.key);
      expect(out.fields.status.id).toBe(gh.statusId);
      expect(out.fields.issuetype.subtask).toBe(gh.parentId !== undefined);
      expect(out.done).toBe(gh.done);
      expect(out.color).toBe(gh.color);
    }
  });

  it('exposes top-level GH-only props (color, flagged, done) on every issue', () => {
    for (const gh of typed.issuesData.issues) {
      const out = adaptIssue(gh, maps, 'customfield_10016');
      expect(typeof out.color).toBe('string');
      expect(typeof out.flagged).toBe('boolean');
      expect(typeof out.done).toBe('boolean');
    }
  });
});

describe('adaptIssue — Group A2: priority synthesis (Phase 76 VISUAL-04/05)', () => {
  it('synthesizes fields.priority.name from priorityId via resolvePriority', () => {
    const known = maps.priorities[realIssue.priorityId];
    if (!known) throw new Error('fixture issue[0] has an unmapped priorityId');
    const out = adaptIssue(realIssue, maps, 'customfield_10016');
    expect((out.fields.priority as { name: string } | null | undefined)?.name).toBe(
      known.priorityName,
    );
  });

  it('shims { name: "Unknown" } for an unmapped priorityId (stripe falls back to gray)', () => {
    const gh = edge({ priorityId: 'nonexistent-priority-id' });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect((out.fields.priority as { name: string } | null | undefined)?.name).toBe('Unknown');
  });
});

describe('adaptIssue — Group B: D-02 story-points gate', () => {
  it('synthesizes customfield_10016 when statFieldId matches storyPointsFieldKey', () => {
    const gh = edge({
      estimateStatistic: {
        statFieldId: 'customfield_10016',
        statFieldValue: { value: 5 },
      },
    });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect(out.fields.customfield_10016).toBe(5);
  });

  it('returns null for customfield_10016 when statFieldId is unrelated (timetracking)', () => {
    const gh = edge({
      estimateStatistic: {
        statFieldId: 'timetracking',
        statFieldValue: { value: 99 },
      },
    });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect(out.fields.customfield_10016).toBeNull();
  });

  it('returns null when statFieldId matches but value is absent', () => {
    const gh = edge({
      estimateStatistic: {
        statFieldId: 'customfield_10016',
        statFieldValue: {},
      },
    });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect(out.fields.customfield_10016).toBeNull();
  });
});

describe('adaptIssue — Group C: D-03 done-override', () => {
  // Inject a status entity whose category resolves to 'indeterminate'
  const customMaps: EntityMaps = {
    ...maps,
    statuses: {
      ...maps.statuses,
      X1: {
        statusUrl: '',
        statusName: 'Verified',
        status: {
          id: 'X1',
          name: 'Verified',
          description: '',
          iconUrl: '',
          statusCategory: { id: '4', key: 'indeterminate', colorName: 'yellow' },
        },
      },
    },
  };

  it('forces statusCategory.key to "done" when gh.done is true and resolved category is "indeterminate"', () => {
    const gh = edge({ statusId: 'X1', done: true });
    const out = adaptIssue(gh, customMaps, 'customfield_10016');
    expect(out.fields.status.statusCategory?.key).toBe('done');
  });

  it('keeps resolved statusCategory.key when gh.done is false', () => {
    const gh = edge({ statusId: 'X1', done: false });
    const out = adaptIssue(gh, customMaps, 'customfield_10016');
    expect(out.fields.status.statusCategory?.key).toBe('indeterminate');
  });
});

describe('adaptIssue — Group D: D-07 missing-status fallback', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('uses Unknown shim when statusId is not in entity maps and warns once', () => {
    const gh = edge({ statusId: 'NOT_IN_MAP' });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect(out.fields.status.name).toBe('Unknown');
    expect(out.fields.status.statusCategory?.key).toBe('indeterminate');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('adaptIssue — Group E: D-11 subtask parent', () => {
  it('sets issuetype.subtask=true and synthesizes fields.parent when parentId is present', () => {
    const gh = edge({ parentId: 12345, parentKey: 'PROJ-7' });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect(out.fields.issuetype.subtask).toBe(true);
    expect(out.fields.parent).toBeDefined();
    expect(out.fields.parent?.id).toBe('12345');
    expect(out.fields.parent?.key).toBe('PROJ-7');
    expect(out.fields.parent?.fields.summary).toBe('');
  });

  it('populates issuetype.id from gh.typeId (needed by Phase 72 GH transitions peek)', () => {
    const gh = edge({ typeId: '10001' });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect(out.fields.issuetype.id).toBe('10001');
  });

  it('leaves fields.parent undefined when parentId is absent', () => {
    const gh = edge({ parentId: undefined, parentKey: undefined });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect(out.fields.issuetype.subtask).toBe(false);
    expect(out.fields.parent).toBeUndefined();
  });
});

describe('adaptIssue — Group F: D-11 epic + flagged variants', () => {
  it('does NOT synthesize a top-level epic property on fields (Phase 71 ambiguity #3)', () => {
    const gh = edge({});
    const out = adaptIssue(gh, maps, 'customfield_10016');
    // Phase 71 leaves epic out — Phase 73 consumes via entityMaps directly.
    expect('epic' in out.fields).toBe(false);
  });

  it('flagged=true on input flows to top-level out.flagged', () => {
    const gh = edge({ flagged: true });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect(out.flagged).toBe(true);
  });

  it('flagged absent on input defaults to false on output', () => {
    const gh = edge({ flagged: undefined });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect(out.flagged).toBe(false);
  });

  it('WR-06: gh.flagged === false and gh.flagged === undefined both produce out.flagged === false', () => {
    // Explicit coverage of the `undefined → false` collapse documented in the
    // adapter header. Both inputs are observationally indistinguishable on
    // AdaptedIssue — consumers needing the distinction must read raw GhIssue.
    const explicitFalse = adaptIssue(edge({ flagged: false }), maps, 'customfield_10016');
    const missing = adaptIssue(edge({ flagged: undefined }), maps, 'customfield_10016');
    expect(explicitFalse.flagged).toBe(false);
    expect(missing.flagged).toBe(false);
    expect(explicitFalse.flagged).toBe(missing.flagged);
  });
});

describe('adaptIssue — Group G: timeInColumn passthrough', () => {
  it('passes through timeInColumn when present (GhBoardIssue)', () => {
    const gh = edge({ timeInColumn: { enteredStatus: 123, durationPreviously: 0 } });
    const out = adaptIssue(gh, maps, 'customfield_10016');
    expect(out.timeInColumn?.enteredStatus).toBe(123);
    expect(out.timeInColumn?.durationPreviously).toBe(0);
  });

  it('leaves timeInColumn undefined when input is a GhIssue (no timeInColumn key)', () => {
    // WR-03: build a plain GhIssue by object-rest-stripping timeInColumn from
    // the GhBoardIssue clone. Stays exhaustive when GhIssue gains fields — the
    // previous hand-rolled enumeration silently dropped any new field.
    const { timeInColumn: _drop, ...ghIssue } = edge({});
    const out = adaptIssue(ghIssue as GhIssue, maps, 'customfield_10016');
    expect(out.timeInColumn).toBeUndefined();
  });
});

describe('createAdapter — factory closure', () => {
  it('returns a closure that calls adaptIssue with bound options', () => {
    const adapt = createAdapter({ storyPointsFieldKey: 'customfield_10016', entityMaps: maps });
    const gh = edge({
      estimateStatistic: {
        statFieldId: 'customfield_10016',
        statFieldValue: { value: 8 },
      },
    });
    const out = adapt(gh);
    expect(out.fields.customfield_10016).toBe(8);
    expect(out.id).toBe(String(gh.id));
  });
});
