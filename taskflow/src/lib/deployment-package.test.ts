import { describe, expect, it } from 'vitest';
import {
  buildPackageFieldValue,
  computeFixVersionsForFix,
  evaluatePackageSync,
  extractDeploymentPackageKey,
  extractLinkedIssueKey,
  findChildForProject,
  findWeekForDate,
  formatWeekLabel,
  indexChildToWeek,
  isDateInWeek,
  parseWeekRange,
  planBulkSync,
  type RmWeek,
} from './deployment-package';

const week43: RmWeek = {
  key: 'RM-1',
  summary: 'WEEK43 (19.10.2026 - 25.10.2026) VIANOCNA PONUKA',
  weekNo: 43,
  start: '2026-10-19',
  end: '2026-10-25',
  children: [
    { key: 'RM-11', summary: 'Core deployment' },
    { key: 'RM-12', summary: 'Shop deployment' },
  ],
};
const week44: RmWeek = {
  key: 'RM-2',
  summary: 'WEEK44 (26.10.2026 - 01.11.2026)',
  weekNo: 44,
  start: '2026-10-26',
  end: '2026-11-01',
  children: [{ key: 'RM-21', summary: 'Core deployment' }],
};
const weeks = [week43, week44];

describe('parseWeekRange', () => {
  it('parses a WEEK summary and ignores trailing text', () => {
    expect(parseWeekRange('WEEK43 (19.10.2026 - 25.10.2026) VIANOCNA PONUKA')).toEqual({
      weekNo: 43,
      start: '2026-10-19',
      end: '2026-10-25',
    });
  });
  it('accepts flexible whitespace around the dash', () => {
    expect(parseWeekRange('WEEK5 (01.02.2026-07.02.2026)')?.end).toBe('2026-02-07');
    expect(parseWeekRange('WEEK5 (01.02.2026   -   07.02.2026)')?.start).toBe('2026-02-01');
  });
  it('returns null for malformed input', () => {
    expect(parseWeekRange('WEEK43')).toBeNull();
    expect(parseWeekRange('WEEK43 (19.10.2026)')).toBeNull();
    expect(parseWeekRange('WEEK43 (19.13.2026 - 25.10.2026)')).toBeNull();
    expect(parseWeekRange('Release notes (19.10.2026 - 25.10.2026)')).toBeNull();
  });
});

describe('isDateInWeek / findWeekForDate', () => {
  it('is inclusive on both boundaries', () => {
    expect(isDateInWeek('2026-10-19', week43)).toBe(true);
    expect(isDateInWeek('2026-10-25', week43)).toBe(true);
    expect(isDateInWeek('2026-10-26', week43)).toBe(false);
    expect(isDateInWeek('2026-10-18', week43)).toBe(false);
  });
  it('finds the containing week or null', () => {
    expect(findWeekForDate(weeks, '2026-10-27')?.key).toBe('RM-2');
    expect(findWeekForDate(weeks, '2027-01-01')).toBeNull();
  });
});

describe('findChildForProject', () => {
  it('matches case-insensitively', () => {
    expect(findChildForProject(week43, 'core')?.key).toBe('RM-11');
  });
  it('returns null when nothing matches', () => {
    expect(findChildForProject(week43, 'Billing')).toBeNull();
    expect(findChildForProject(week43, '')).toBeNull();
  });
  it('prefers word-boundary then exact over a substring match', () => {
    const w: RmWeek = {
      ...week43,
      children: [
        { key: 'A-1', summary: 'CoreAdmin deploy' },
        { key: 'A-2', summary: 'Core' },
      ],
    };
    expect(findChildForProject(w, 'Core')?.key).toBe('A-2');
  });
  it('returns null when still ambiguous', () => {
    const w: RmWeek = {
      ...week43,
      children: [
        { key: 'A-1', summary: 'Core web' },
        { key: 'A-2', summary: 'Core api' },
      ],
    };
    expect(findChildForProject(w, 'Core')).toBeNull();
  });
});

describe('extractDeploymentPackageKey', () => {
  it('accepts the supported shapes', () => {
    expect(extractDeploymentPackageKey('ABC-12')).toBe('ABC-12');
    expect(extractDeploymentPackageKey({ key: 'ABC-12' })).toBe('ABC-12');
    expect(extractDeploymentPackageKey(['ABC-12'])).toBe('ABC-12');
    expect(extractDeploymentPackageKey([{ key: 'ABC-12' }])).toBe('ABC-12');
  });
  it('rejects everything else', () => {
    expect(extractDeploymentPackageKey(null)).toBeNull();
    expect(extractDeploymentPackageKey('')).toBeNull();
    expect(extractDeploymentPackageKey('not a key')).toBeNull();
    expect(extractDeploymentPackageKey([])).toBeNull();
    expect(extractDeploymentPackageKey(['ABC-1', 'ABC-2'])).toBeNull();
  });
});

describe('buildPackageFieldValue', () => {
  it('follows the editmeta shape', () => {
    expect(buildPackageFieldValue('RM-1', 'array')).toEqual(['RM-1']);
    expect(buildPackageFieldValue('RM-1', 'single')).toBe('RM-1');
  });
});

describe('indexChildToWeek', () => {
  it('maps child keys to their week', () => {
    expect(indexChildToWeek(weeks).get('RM-21')?.key).toBe('RM-2');
  });
});

describe('evaluatePackageSync', () => {
  const v43 = { id: '1', name: 'R-43', releaseDate: '2026-10-22' };
  const v44 = { id: '2', name: 'R-44', releaseDate: '2026-10-29' };
  const base = { weeks, projectName: 'Core', projectVersions: [v43, v44] };

  it('none', () => {
    expect(evaluatePackageSync({ ...base, pkgKey: null, fixVersions: [] }).state).toBe('none');
  });
  it('ok when any fix version is in the package week', () => {
    expect(evaluatePackageSync({ ...base, pkgKey: 'RM-11', fixVersions: [v44, v43] }).state).toBe(
      'ok',
    );
  });
  it('pkg-only offers set-fix-version when exactly one version is in the week', () => {
    const r = evaluatePackageSync({ ...base, pkgKey: 'RM-11', fixVersions: [] });
    expect(r.state).toBe('pkg-only');
    expect(r.fixes).toEqual([{ kind: 'set-fix-version', versionId: '1', versionName: 'R-43' }]);
  });
  it('fv-only offers set-package for the matching child', () => {
    const r = evaluatePackageSync({ ...base, pkgKey: null, fixVersions: [v44] });
    expect(r.state).toBe('fv-only');
    expect(r.fixes).toEqual([
      { kind: 'set-package', childKey: 'RM-21', childSummary: 'Core deployment' },
    ]);
  });
  it('fv-only explains why no package could be derived', () => {
    const noChild = evaluatePackageSync({
      ...base,
      pkgKey: null,
      fixVersions: [v43],
      projectName: 'Billing',
    });
    expect(noChild.fixes).toEqual([]);
    expect(noChild.hint).toContain('No task for "Billing"');
    expect(noChild.hint).toContain('Week 43');
    expect(noChild.hint).toContain('Core deployment');

    const noWeek = evaluatePackageSync({
      ...base,
      pkgKey: null,
      fixVersions: [{ id: '9', name: 'R-99', releaseDate: '2027-01-01' }],
    });
    expect(noWeek.hint).toContain('No Release Management week covers R-99');

    const many = evaluatePackageSync({ ...base, pkgKey: null, fixVersions: [v43, v44] });
    expect(many.hint).toContain('Several fix versions');
  });
  it('mismatch offers both fixes', () => {
    const r = evaluatePackageSync({ ...base, pkgKey: 'RM-11', fixVersions: [v44] });
    expect(r.state).toBe('mismatch');
    expect(r.fixes.map((f) => f.kind).sort()).toEqual(['set-fix-version', 'set-package']);
  });
  it('unresolved for unknown package key or undated fix versions', () => {
    expect(evaluatePackageSync({ ...base, pkgKey: 'RM-999', fixVersions: [v43] }).state).toBe(
      'unresolved',
    );
    const r = evaluatePackageSync({
      ...base,
      pkgKey: 'RM-11',
      fixVersions: [{ id: '9', name: 'undated' }],
    });
    expect(r.state).toBe('unresolved');
    expect(r.fixes).toEqual([]);
  });
});

describe('computeFixVersionsForFix', () => {
  it('drops dated versions outside the week, keeps undated, adds the target', () => {
    const current = [
      { id: '2', name: 'R-44', releaseDate: '2026-10-29' },
      { id: '7', name: 'undated' },
    ];
    expect(computeFixVersionsForFix(current, '1', week43, [])).toEqual([{ id: '7' }, { id: '1' }]);
  });
});

describe('planBulkSync', () => {
  const story = (key: string, pkg: unknown, type = 'Story', project = 'Core') => ({
    key,
    fields: { issuetype: { name: type }, project: { name: project }, customfield_15725: pkg },
  });
  const version = { releaseDate: '2026-10-22' };

  it('sets the package on missing or other-week stories, skips ok / non-Story', () => {
    const plan = planBulkSync(
      [
        story('S-1', null),
        story('S-2', 'RM-21'),
        story('S-3', 'RM-11'),
        story('S-4', null, 'Epic'),
        story('S-5', null, 'Story', 'Unknown'),
      ],
      version,
      weeks,
      'array',
    );
    expect(plan).toEqual([
      { key: 'S-1', fields: { customfield_15725: ['RM-11'] } },
      { key: 'S-2', fields: { customfield_15725: ['RM-11'] } },
    ]);
  });
  it('uses the single shape and returns nothing when not editable or undated', () => {
    expect(planBulkSync([story('S-1', null)], version, weeks, 'single')[0].fields).toEqual({
      customfield_15725: 'RM-11',
    });
    expect(planBulkSync([story('S-1', null)], version, weeks, 'not-editable')).toEqual([]);
    expect(planBulkSync([story('S-1', null)], {}, weeks, 'array')).toEqual([]);
  });
});

describe('extractLinkedIssueKey', () => {
  it('reads string, {key}, {data:{key}} and single-element arrays', () => {
    expect(extractLinkedIssueKey('RM-12')).toBe('RM-12');
    expect(extractLinkedIssueKey({ key: 'RM-12' })).toBe('RM-12');
    expect(extractLinkedIssueKey({ hasEpicLink: false, data: { key: 'RM-12' } })).toBe('RM-12');
    expect(extractLinkedIssueKey(['RM-12'])).toBe('RM-12');
  });
  it('returns null for anything else', () => {
    expect(extractLinkedIssueKey(null)).toBeNull();
    expect(extractLinkedIssueKey('not a key')).toBeNull();
    expect(extractLinkedIssueKey(['RM-1', 'RM-2'])).toBeNull();
    expect(extractLinkedIssueKey({})).toBeNull();
  });
});

describe('formatWeekLabel', () => {
  it('title-cases an all-caps name and normalises the week prefix and dash', () => {
    expect(formatWeekLabel('WEEK43 (19.10.2026 - 25.10.2026) VIANOCNA PONUKA')).toBe(
      'Week 43 (19.10.2026 – 25.10.2026) Vianocna Ponuka',
    );
  });
  it('keeps short words (acronyms) and already mixed-case names', () => {
    expect(formatWeekLabel('WEEK5 (26.01.2026 - 01.02.2026) SAP RELEASE')).toBe(
      'Week 5 (26.01.2026 – 01.02.2026) SAP Release',
    );
    expect(formatWeekLabel('WEEK6 (02.02.2026 - 08.02.2026) Regular')).toBe(
      'Week 6 (02.02.2026 – 08.02.2026) Regular',
    );
  });
  it('works without a trailing name and passes unparseable input through', () => {
    expect(formatWeekLabel('WEEK43 (19.10.2026 - 25.10.2026)')).toBe(
      'Week 43 (19.10.2026 – 25.10.2026)',
    );
    expect(formatWeekLabel('Something else')).toBe('Something else');
  });
});

describe('findChildForProject (app-name tasks)', () => {
  const week: RmWeek = {
    ...week43,
    children: [
      { key: 'RM-31', summary: 'Mobile Banking' },
      { key: 'RM-32', summary: 'Web Shop' },
    ],
  };
  it('matches when the Jira project name contains the task (app) name', () => {
    expect(findChildForProject(week, 'Mobile Banking Platform')?.key).toBe('RM-31');
  });
  it('falls back to the project key as a whole word', () => {
    expect(findChildForProject(week, 'Internal platform', 'WEB')?.key).toBe('RM-32');
  });
  it('returns null when nothing or several match', () => {
    expect(findChildForProject(week, 'Billing', 'BIL')).toBeNull();
  });
});

describe('week parsing with non-padded dates', () => {
  it('parses d.M.yyyy and pads to YYYY-MM-DD', () => {
    expect(parseWeekRange('WEEK45 (2.11.2026 - 8.11.2026) STANDARD')).toEqual({
      weekNo: 45,
      start: '2026-11-02',
      end: '2026-11-08',
    });
  });
  it('finds the week for a date and formats the label without losing the unpadded form', () => {
    const w = parseWeekRange('WEEK45 (2.11.2026 - 8.11.2026) STANDARD');
    expect(w && isDateInWeek('2026-11-03', w)).toBe(true);
    expect(formatWeekLabel('WEEK45 (2.11.2026 - 8.11.2026) STANDARD')).toBe(
      'Week 45 (2.11.2026 – 8.11.2026) Standard',
    );
  });
});
