import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import type {
  GhAllDataResponse,
  GhBacklogResponse,
  GhIssue,
} from '@/services/jira/greenhopper/types';
import {
  buildResultModel,
  buildSearchIndex,
  classifyBodyHit,
  entryFromJiraIssue,
  findIndexEntry,
  matchesSecondary,
  PER_TIER_CAP,
  resolveKeyLookup,
  type ResultSection,
  TOTAL_CAP,
} from './global-search';

const EPIC_FIELD = 'customfield_10014';

interface IssueSpec {
  id: number;
  key: string;
  summary: string;
  done?: boolean;
  parentKey?: string;
  epicId?: number;
  typeId?: string;
}

function gh(s: IssueSpec): GhIssue {
  return {
    id: s.id,
    key: s.key,
    hidden: false,
    typeId: s.typeId ?? (s.parentKey ? '3' : '1'),
    summary: s.summary,
    priorityId: '1',
    done: s.done ?? false,
    hasCustomUserAvatar: false,
    color: '#000',
    epicId: s.epicId,
    parentKey: s.parentKey,
    estimateStatisticRequired: false,
    estimateStatistic: { statFieldId: 'x', statFieldValue: {} },
    trackingStatistic: { statFieldId: 'x', statFieldValue: {} },
    statusId: s.done ? '3' : '1',
    fixVersions: [],
    projectId: 1,
  } as GhIssue;
}

const entityData = {
  statuses: {
    '1': {
      statusUrl: '',
      statusName: 'To Do',
      status: {
        id: '1',
        name: 'To Do',
        description: '',
        iconUrl: '',
        statusCategory: { id: '2', key: 'new', colorName: '' },
      },
    },
    '3': {
      statusUrl: '',
      statusName: 'Done',
      status: {
        id: '3',
        name: 'Done',
        description: '',
        iconUrl: '',
        statusCategory: { id: '3', key: 'done', colorName: '' },
      },
    },
  },
  priorities: {},
  types: {
    '1': { typeUrl: '', typeName: 'Story' },
    '2': { typeUrl: '', typeName: 'Epic' },
    '3': { typeUrl: '', typeName: 'Sub-task' },
  },
  epics: {
    '900': {
      epicField: {
        id: '900',
        label: 'E',
        editable: false,
        renderer: '',
        epicKey: 'ESHOP-1',
        epicColor: 'color_1',
        text: 'Checkout',
      },
    },
  },
} as unknown as GhBacklogResponse['entityData'];

function sprint(
  id: number,
  name: string,
  state: 'ACTIVE' | 'FUTURE' | 'CLOSED',
  issuesIds: number[],
) {
  return { id, name, state, issuesIds } as unknown as GhBacklogResponse['sprints'][number];
}

function makeBacklog(o: {
  sprints?: GhBacklogResponse['sprints'];
  issues: IssueSpec[];
}): GhBacklogResponse {
  return {
    issues: o.issues.map(gh),
    entityData,
    sprints: o.sprints ?? [],
  } as unknown as GhBacklogResponse;
}

function makeAllData(issues: IssueSpec[]): GhAllDataResponse {
  return { entityData, issuesData: { issues: issues.map(gh) } } as unknown as GhAllDataResponse;
}

function jira(
  key: string,
  summary: string,
  extra: {
    description?: string | null;
    parent?: string;
    done?: boolean;
    assignee?: string;
    epic?: string;
  } = {},
): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: {
        id: '1',
        name: extra.done ? 'Done' : 'In Progress',
        statusCategory: { key: extra.done ? 'done' : 'indeterminate' },
      },
      assignee: extra.assignee
        ? { displayName: extra.assignee, avatarUrls: { '48x48': 'http://a' } }
        : null,
      customfield_10016: null,
      issuetype: { name: extra.parent ? 'Sub-task' : 'Story', subtask: !!extra.parent },
      description: extra.description ?? null,
      ...(extra.parent ? { parent: { id: '1', key: extra.parent, fields: { summary: 'p' } } } : {}),
      ...(extra.epic ? { [EPIC_FIELD]: extra.epic } : {}),
    },
  } as unknown as JiraIssue;
}

function model(
  index: ReturnType<typeof buildSearchIndex>,
  query: string,
  o: Partial<Parameters<typeof buildResultModel>[0]> = {},
): ResultSection[] {
  return buildResultModel({
    index,
    query,
    bodyIssues: [],
    closedIssues: [],
    includeClosed: false,
    expandedTiers: new Set(),
    epicLinkFieldKey: EPIC_FIELD,
    ...o,
  });
}

const allKeys = (s: ResultSection[]) => s.flatMap((x) => x.rows.map((r) => r.entry.key));

const baseSprints = [
  sprint(1, 'Sprint 42', 'ACTIVE', [1, 2, 6]),
  sprint(2, 'Sprint 43', 'FUTURE', [3]),
  sprint(3, 'Ready to plan', 'FUTURE', [4]),
  sprint(4, 'Sprint 41', 'CLOSED', [5]),
];

describe('tier order', () => {
  const backlog = makeBacklog({
    sprints: baseSprints,
    issues: [
      { id: 1, key: 'ESHOP-1', summary: 'cur' },
      { id: 2, key: 'ESHOP-2', summary: 'cur done', done: true },
      { id: 3, key: 'ESHOP-3', summary: 'next' },
      { id: 4, key: 'ESHOP-4', summary: 'later' },
      { id: 5, key: 'ESHOP-5', summary: 'closed sprint only' },
      { id: 6, key: 'ESHOP-6', summary: 'in active and future' },
      { id: 7, key: 'ESHOP-7', summary: 'plain backlog' },
    ],
  });
  backlog.sprints[1].issuesIds.push(6);
  const index = buildSearchIndex(backlog);

  it('orders and labels tiers', () => {
    const t = (id: string) => index.tiers.get(id);
    expect(t('current')).toMatchObject({ rank: 0, label: 'Current sprint' });
    expect(t('sprint:2')).toMatchObject({ rank: 1, label: 'Sprint 43 (next)' });
    expect(t('sprint:3')).toMatchObject({ rank: 2, label: 'Ready to plan' });
    expect(t('backlog')?.rank).toBe(1000);
    expect(t('closed')?.rank).toBe(2000);
  });

  it('BL-01: closed-sprint-only issue falls to backlog', () => {
    expect(index.byKey.get('ESHOP-5')?.tierId).toBe('backlog');
  });

  it('issue in active and future takes the lowest rank', () => {
    expect(index.byKey.get('ESHOP-6')?.tierId).toBe('current');
  });

  it('D-05: current-sprint comment hit precedes backlog title hit', () => {
    const idx = buildSearchIndex(
      makeBacklog({
        sprints: [sprint(1, 'S', 'ACTIVE', [1])],
        issues: [
          { id: 1, key: 'ESHOP-1', summary: 'unrelated thing' },
          { id: 2, key: 'ESHOP-2', summary: 'zebra crossing' },
        ],
      }),
    );
    const out = model(idx, 'zebra', {
      bodyIssues: [jira('ESHOP-1', 'unrelated thing', { description: 'nothing' })],
    });
    expect(out.map((s) => s.tier.id)).toEqual(['current', 'backlog']);
    expect(allKeys(out)).toEqual(['ESHOP-1', 'ESHOP-2']);
  });

  it('omits empty tiers', () => {
    const out = model(index, 'plain');
    expect(out.map((s) => s.tier.id)).toEqual(['backlog']);
  });
});

describe('closed', () => {
  const backlog = makeBacklog({
    sprints: [sprint(1, 'S', 'ACTIVE', [1, 2]), sprint(2, 'F', 'FUTURE', [3])],
    issues: [
      { id: 1, key: 'ESHOP-1', summary: 'alpha done active', done: true },
      { id: 2, key: 'ESHOP-2', summary: 'alpha open active' },
      { id: 3, key: 'ESHOP-3', summary: 'alpha done future', done: true },
      { id: 4, key: 'ESHOP-4', summary: 'alpha done backlog', done: true },
    ],
  });
  const index = buildSearchIndex(backlog);

  it('D-20: done in active sprint stays current, elsewhere closed', () => {
    expect(index.byKey.get('ESHOP-1')?.tierId).toBe('current');
    expect(index.byKey.get('ESHOP-3')?.tierId).toBe('closed');
    expect(index.byKey.get('ESHOP-4')?.tierId).toBe('closed');
  });

  it('excludes closed unless includeClosed, then lists them last', () => {
    expect(allKeys(model(index, 'alpha'))).toEqual(['ESHOP-1', 'ESHOP-2']);
    const out = model(index, 'alpha', { includeClosed: true });
    expect(out[out.length - 1].tier.id).toBe('closed');
    expect(allKeys(out)).toContain('ESHOP-3');
  });

  it('closedIssues ignored when not includeClosed; honoured otherwise', () => {
    const closed = [jira('ESHOP-99', 'omega released', { done: true })];
    expect(allKeys(model(index, 'omega', { closedIssues: closed }))).toEqual([]);
    const out = model(index, 'omega', { closedIssues: closed, includeClosed: true });
    expect(out[0].tier.id).toBe('closed');
    expect(allKeys(out)).toEqual(['ESHOP-99']);
  });

  it('closed-scope issue indexed in current stays in current', () => {
    const e = entryFromJiraIssue(
      jira('ESHOP-1', 'alpha done active', { done: true }),
      index,
      EPIC_FIELD,
      'closed',
    );
    expect(e.tierId).toBe('current');
  });
});

describe('direct match', () => {
  const index = buildSearchIndex(
    makeBacklog({ issues: [{ id: 1, key: 'ESHOP-412', summary: 'x' }] }),
  );
  it('finds index entry case-insensitively, null on miss', () => {
    expect(findIndexEntry(index, 'eshop-412')?.key).toBe('ESHOP-412');
    expect(findIndexEntry(index, 'ESHOP-1')).toBeNull();
  });
  it('resolveKeyLookup', () => {
    expect(resolveKeyLookup('eshop-412', null)).toBe('ESHOP-412');
    expect(resolveKeyLookup('412', 'ESHOP')).toBe('ESHOP-412');
    expect(resolveKeyLookup('412', null)).toBe('');
    expect(resolveKeyLookup('cart', 'ESHOP')).toBe('');
  });
});

describe('index sources', () => {
  const backlog = makeBacklog({
    sprints: [sprint(1, 'S', 'ACTIVE', [1])],
    issues: [
      { id: 1, key: 'ESHOP-1', summary: 'parent story', epicId: 900 },
      { id: 2, key: 'ESHOP-2', summary: 'backlog story' },
    ],
  });
  it('resolves epic and populates epicsByKey', () => {
    const index = buildSearchIndex(backlog);
    expect(index.byKey.get('ESHOP-1')?.epic).toEqual({
      key: 'ESHOP-1',
      name: 'Checkout',
      color: 'color_1',
    });
    expect(index.epicsByKey.get('ESHOP-1')?.name).toBe('Checkout');
  });
  it('D-19: adds subtasks from all-data once, inheriting parent tier', () => {
    const index = buildSearchIndex(
      backlog,
      makeAllData([
        { id: 10, key: 'ESHOP-10', summary: 'sub a', parentKey: 'ESHOP-2' },
        { id: 11, key: 'ESHOP-11', summary: 'sub b', parentKey: 'NOPE-1' },
        { id: 12, key: 'ESHOP-2', summary: 'dup', parentKey: 'ESHOP-1' },
      ]),
    );
    expect(index.byKey.get('ESHOP-10')).toMatchObject({ isSubtask: true, tierId: 'backlog' });
    expect(index.byKey.get('ESHOP-11')?.tierId).toBe('current');
    expect(index.byKey.get('ESHOP-2')?.summary).toBe('backlog story');
    expect(index.entries.filter((e) => e.key === 'ESHOP-2')).toHaveLength(1);
  });
  it('entryFromJiraIssue tiers and epic', () => {
    const index = buildSearchIndex(backlog);
    expect(
      entryFromJiraIssue(jira('ESHOP-1', 's', { assignee: 'Ann' }), index, EPIC_FIELD, 'open'),
    ).toMatchObject({
      tierId: 'current',
      assigneeName: 'Ann',
    });
    expect(
      entryFromJiraIssue(jira('ESHOP-50', 's', { parent: 'ESHOP-1' }), index, EPIC_FIELD, 'open')
        .tierId,
    ).toBe('current');
    expect(
      entryFromJiraIssue(jira('ESHOP-51', 's', { epic: 'ESHOP-1' }), index, EPIC_FIELD, 'open'),
    ).toMatchObject({
      tierId: 'backlog',
      epic: { name: 'Checkout' },
    });
    expect(entryFromJiraIssue(jira('ESHOP-52', 's'), index, EPIC_FIELD, 'closed').tierId).toBe(
      'closed',
    );
  });
});

describe('field tier', () => {
  it('classifies description vs comment', () => {
    const d = classifyBodyHit(
      'cart empty',
      jira('A-1', 'x', { description: 'h2. Repro\nThe cart is empty after login' }),
    );
    expect(d.field).toBe(1);
    expect(d.snippet?.text).toContain('cart');
    expect(classifyBodyHit('cart empty', jira('A-1', 'x', { description: null }))).toEqual({
      field: 2,
      snippet: null,
    });
    expect(
      classifyBodyHit('cart empty', jira('A-1', 'x', { description: 'nothing here' })).field,
    ).toBe(2);
  });

  it('orders title < desc < comment within a tier; exact beats fuzzy', () => {
    const index = buildSearchIndex(
      makeBacklog({
        issues: [
          { id: 1, key: 'P-1', summary: 'chec kout flow' },
          { id: 2, key: 'P-2', summary: 'checkout flow' },
        ],
      }),
    );
    const out = model(index, 'checkout', {
      bodyIssues: [
        jira('P-3', 'unrelated', { description: 'about checkout here' }),
        jira('P-4', 'other', { description: 'zzz' }),
      ],
    });
    expect(allKeys(out)).toEqual(['P-2', 'P-1', 'P-3', 'P-4']);
    expect(out[0].rows.map((r) => r.tag)).toEqual([null, null, 'desc', 'comment']);
  });

  it('body hit whose summary matches is a title hit; same key merges to one row', () => {
    const index = buildSearchIndex(
      makeBacklog({ issues: [{ id: 1, key: 'P-1', summary: 'checkout flow' }] }),
    );
    const out = model(index, 'checkout', {
      bodyIssues: [jira('P-1', 'checkout flow', { assignee: 'Bob' })],
    });
    expect(allKeys(out)).toEqual(['P-1']);
    expect(out[0].rows[0]).toMatchObject({ field: 0, tag: null });
    expect(out[0].rows[0].entry.assigneeName).toBe('Bob');
    expect(out[0].rows[0].titleRanges.length).toBeGreaterThan(0);
  });

  it('short query yields nothing', () => {
    const index = buildSearchIndex(makeBacklog({ issues: [{ id: 1, key: 'P-1', summary: 'a' }] }));
    expect(model(index, 'a')).toEqual([]);
  });
});

describe('grouping', () => {
  const backlog = makeBacklog({
    sprints: [sprint(1, 'S', 'ACTIVE', [1, 2, 3])],
    issues: [
      { id: 1, key: 'P-1', summary: 'parent story' },
      { id: 2, key: 'P-2', summary: 'cart story' },
      { id: 3, key: 'P-3', summary: 'quiet story' },
      { id: 4, key: 'P-4', summary: 'backlog story' },
    ],
  });
  const all = makeAllData([
    { id: 11, key: 'P-11', summary: 'cart sub', parentKey: 'P-2' },
    { id: 12, key: 'P-12', summary: 'other sub', parentKey: 'P-2' },
    { id: 13, key: 'P-13', summary: 'cart child', parentKey: 'P-3' },
    { id: 14, key: 'P-14', summary: 'sibling', parentKey: 'P-3' },
    { id: 15, key: 'P-15', summary: 'cart under backlog', parentKey: 'P-4' },
  ]);
  const index = buildSearchIndex(backlog, all);

  it('parent with own hit leads its matching subtask', () => {
    const out = model(index, 'cart');
    const rows = out[0].rows.filter((r) => ['P-2', 'P-11'].includes(r.entry.key));
    expect(rows.map((r) => [r.entry.key, r.indent, r.dimmed])).toEqual([
      ['P-2', false, false],
      ['P-11', true, false],
    ]);
  });

  it('child-only group dims the parent, hides siblings, ranks below own title hit', () => {
    const out = model(index, 'cart');
    const keys = out[0].rows.map((r) => r.entry.key);
    expect(keys).toEqual(['P-2', 'P-11', 'P-3', 'P-13']);
    const dim = out[0].rows[2];
    expect(dim).toMatchObject({ field: null, dimmed: true, titleRanges: [] });
    expect(keys).not.toContain('P-14');
  });

  it('child-only group ranks above a stand-alone comment hit', () => {
    const out = model(index, 'cart', {
      bodyIssues: [jira('P-1', 'parent story', { description: 'x' })],
    });
    expect(out[0].rows.map((r) => r.entry.key)).toEqual(['P-2', 'P-11', 'P-3', 'P-13', 'P-1']);
  });

  it('subtask stays under its parent tier and appears once', () => {
    const out = model(index, 'cart', {
      bodyIssues: [jira('P-15', 'cart under backlog', { parent: 'P-4' })],
    });
    const backlogSection = out.find((s) => s.tier.id === 'backlog');
    expect(backlogSection?.rows.map((r) => [r.entry.key, r.indent])).toEqual([
      ['P-4', false],
      ['P-15', true],
    ]);
    const keys = allKeys(out);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('subtask with unknown parent is standalone in its own tier', () => {
    const idx = buildSearchIndex(
      makeBacklog({ issues: [] }),
      makeAllData([{ id: 1, key: 'Z-1', summary: 'orphan cart', parentKey: 'Z-0' }]),
    );
    const out = model(idx, 'cart');
    expect(out[0].rows).toHaveLength(1);
    expect(out[0].rows[0]).toMatchObject({ indent: false, dimmed: false });
  });
});

describe('fuzzy', () => {
  it('finds a typo in the title', () => {
    const index = buildSearchIndex(
      makeBacklog({ issues: [{ id: 1, key: 'P-1', summary: 'Checkout redesign' }] }),
    );
    expect(allKeys(model(index, 'chekout'))).toEqual(['P-1']);
  });
});

describe('caps', () => {
  const issues = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    key: `P-${i + 1}`,
    summary: `widget ${i}`,
  }));
  const index = buildSearchIndex(makeBacklog({ issues }));

  it('limits a tier to PER_TIER_CAP and reports hidden', () => {
    const out = model(index, 'widget');
    expect(out[0].rows).toHaveLength(PER_TIER_CAP);
    expect(out[0].hiddenCount).toBe(4);
  });
  it('expanded tier shows everything', () => {
    const out = model(index, 'widget', { expandedTiers: new Set(['backlog']) });
    expect(out[0].rows).toHaveLength(12);
    expect(out[0].hiddenCount).toBe(0);
  });
  it('total cap across sections', () => {
    const sprints = Array.from({ length: 6 }, (_, i) =>
      sprint(
        i + 1,
        `F${i}`,
        'FUTURE',
        Array.from({ length: 8 }, (_, k) => i * 8 + k + 1),
      ),
    );
    const many = Array.from({ length: 48 }, (_, i) => ({
      id: i + 1,
      key: `Q-${i + 1}`,
      summary: `gadget ${i}`,
    }));
    const idx = buildSearchIndex(makeBacklog({ sprints, issues: many }));
    const out = model(idx, 'gadget');
    const shown = out.reduce((n, s) => n + s.rows.length, 0);
    expect(shown).toBeLessThanOrEqual(TOTAL_CAP);
    expect(out.reduce((n, s) => n + s.rows.length + s.hiddenCount, 0)).toBe(48);
  });
  it('never splits a group across the cap', () => {
    const subs = Array.from({ length: 7 }, (_, i) => ({
      id: 100 + i,
      key: `S-${i}`,
      summary: `widget sub ${i}`,
      parentKey: 'P-1',
    }));
    const idx = buildSearchIndex(makeBacklog({ issues }), makeAllData(subs));
    const out = model(idx, 'widget');
    const rows = out[0].rows;
    const p1 = rows.findIndex((r) => r.entry.key === 'P-1');
    if (p1 !== -1) {
      const children = rows.filter((r) => r.indent).length;
      expect(children === 0 || children === 7).toBe(true);
    }
  });
});

describe('secondary', () => {
  it('matches all tokens against labels', () => {
    expect(matchesSecondary('sprint', 'Sprint Board')).toBe(true);
    expect(matchesSecondary('!42', 'Fix login', '!42')).toBe(true);
    expect(matchesSecondary('zzz', 'Dashboard')).toBe(false);
  });
});

describe('epics', () => {
  it('puts open epics from the backlog in their own Epics section after Backlog', () => {
    const index = buildSearchIndex(
      makeBacklog({
        issues: [
          { id: 1, key: 'P-1', summary: 'Payments story' },
          { id: 2, key: 'P-2', summary: 'Payments epic', typeId: '2' },
        ],
      }),
    );
    const sections = model(index, 'payments');
    expect(sections.map((s) => [s.tier.label, s.rows.map((r) => r.entry.key)])).toEqual([
      ['Backlog', ['P-1']],
      ['Epics', ['P-2']],
    ]);
  });

  it('keeps done epics in Closed', () => {
    const index = buildSearchIndex(
      makeBacklog({
        issues: [{ id: 2, key: 'P-2', summary: 'Old epic', typeId: '2', done: true }],
      }),
    );
    expect(model(index, 'old epic')).toEqual([]);
    expect(model(index, 'old epic', { includeClosed: true })[0].tier.label).toBe('Closed');
  });

  it('puts an open epic found only by the Jira search in Epics', () => {
    const index = buildSearchIndex(makeBacklog({ issues: [] }));
    const epic = jira('P-7', 'Loyalty programme');
    (epic.fields as unknown as { issuetype: unknown }).issuetype = { name: 'Epic', subtask: false };
    const sections = model(index, 'loyalty', { bodyIssues: [epic] });
    expect(sections.map((s) => s.tier.label)).toEqual(['Epics']);
  });
});
