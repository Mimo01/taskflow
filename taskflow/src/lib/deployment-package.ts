/**
 * Deployment package <-> fix version sync (quick 261014-eym).
 *
 * Pure module (no React / store imports). The Jira "Deployment package" field
 * (customfield_15725) points at a child issue of a Release Management (RM)
 * WEEK parent whose summary carries the week's inclusive date range, e.g.
 * `WEEK43 (19.10.2026 - 25.10.2026) VIANOCNA PONUKA`. A Story's fix version
 * "matches" its package when the version's releaseDate falls in that range.
 *
 * All date comparisons are done on YYYY-MM-DD strings so there is no timezone
 * off-by-one (no Date objects anywhere in here).
 */

export interface RmChild {
  key: string;
  summary: string;
}

export interface RmWeek {
  /** Key of the WEEK parent issue. */
  key: string;
  summary: string;
  weekNo: number;
  /** Inclusive start, YYYY-MM-DD. */
  start: string;
  /** Inclusive end, YYYY-MM-DD. */
  end: string;
  children: RmChild[];
}

export type PackageEditShape = 'array' | 'single' | 'not-editable';

export type PackageSyncState = 'none' | 'ok' | 'pkg-only' | 'fv-only' | 'mismatch' | 'unresolved';

export type PackageFix =
  | { kind: 'set-fix-version'; versionId: string; versionName: string }
  | { kind: 'set-package'; childKey: string; childSummary: string };

export interface PackageFixVersion {
  id: string;
  name: string;
  releaseDate?: string;
}

export interface PackageSyncResult {
  state: PackageSyncState;
  hint: string;
  /** Optional secondary line (e.g. which tasks exist under the week). */
  detail?: string;
  fixes: PackageFix[];
}

/** Minimal structural shape of a story the planner needs (JiraIssue satisfies it). */
export interface PackageStoryLike {
  key: string;
  fields: {
    issuetype?: { name: string };
    project?: { name?: string; key?: string };
    customfield_15725?: unknown;
    fixVersions?: PackageFixVersion[];
  };
}

export const DEPLOYMENT_PACKAGE_FIELD = 'customfield_15725';

const ISSUE_KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/;
const WEEK_RE =
  /WEEK\s*(\d+)\s*\(\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*\)/i;

function toYmd(dd: string, mm: string, yyyy: string): string | null {
  const d = Number(dd);
  const m = Number(mm);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${yyyy}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Display label for a WEEK summary: `WEEK43 (19.10.2026 - 25.10.2026) VIANOCNA PONUKA`
 * -> `Week 43 (19.10.2026 – 25.10.2026) Vianocna Ponuka`. The trailing name is only
 * re-cased when it is entirely uppercase; words of <= 3 letters stay as-is (acronyms).
 * Falls back to the raw summary when it doesn't parse.
 */
export function formatWeekLabel(summary: string): string {
  const m = WEEK_RE.exec(summary);
  if (!m) return summary;
  const tail = summary
    .slice(m.index + m[0].length)
    .trim()
    .replace(/^[-–:]\s*/, '');
  const name =
    tail && tail === tail.toUpperCase()
      ? tail.replace(/\p{L}+/gu, (w) =>
          w.length <= 3 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase(),
        )
      : tail;
  const base = `Week ${Number(m[1])} (${m[2]}.${m[3]}.${m[4]} – ${m[5]}.${m[6]}.${m[7]})`;
  return name ? `${base} ${name}` : base;
}

/** Parse `WEEK43 (19.10.2026 - 25.10.2026) ...` into a normalised range, or null. */
export function parseWeekRange(
  summary: string,
): { weekNo: number; start: string; end: string } | null {
  const m = WEEK_RE.exec(summary);
  if (!m) return null;
  const start = toYmd(m[2], m[3], m[4]);
  const end = toYmd(m[5], m[6], m[7]);
  if (!start || !end || start > end) return null;
  return { weekNo: Number(m[1]), start, end };
}

/** Inclusive on both ends; pure string comparison on YYYY-MM-DD. */
export function isDateInWeek(ymd: string, week: { start: string; end: string }): boolean {
  return ymd >= week.start && ymd <= week.end;
}

export function findWeekForDate(weeks: RmWeek[], ymd: string): RmWeek | null {
  return weeks.find((w) => isDateInWeek(ymd, w)) ?? null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the week's child for an application. Tries, in order, the first step that
 * yields exactly one candidate: child summary contains the project name; project
 * name contains the child summary (RM task is just the app name, >= 3 chars);
 * child summary contains the project key as a whole word. Within a step an
 * ambiguous result is narrowed by word-boundary then exact equality; if still
 * ambiguous or empty the step is skipped, and null is returned so callers never
 * auto-fix a guess.
 */
export function findChildForProject(
  week: RmWeek,
  projectName: string,
  projectKey?: string,
): RmChild | null {
  const name = projectName.trim().toLowerCase();
  const key = (projectKey ?? '').trim().toLowerCase();
  const wordRe = (needle: string) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}($|[^\\p{L}\\p{N}])`, 'iu');
  const pick = (pool: RmChild[], needle: string): RmChild | null => {
    if (pool.length === 1) return pool[0];
    if (pool.length === 0) return null;
    const re = wordRe(needle);
    const boundary = pool.filter((c) => re.test(c.summary));
    if (boundary.length === 1) return boundary[0];
    const narrowed = boundary.length > 0 ? boundary : pool;
    const exact = narrowed.filter((c) => c.summary.trim().toLowerCase() === needle);
    return exact.length === 1 ? exact[0] : null;
  };

  if (name) {
    const hit = pick(
      week.children.filter((c) => c.summary.toLowerCase().includes(name)),
      name,
    );
    if (hit) return hit;
    const reverse = week.children.filter((c) => {
      const cs = c.summary.trim().toLowerCase();
      return cs.length >= 3 && name.includes(cs);
    });
    if (reverse.length === 1) return reverse[0];
  }
  if (key.length >= 2) {
    const re = wordRe(key);
    const hit = week.children.filter((c) => re.test(c.summary));
    if (hit.length === 1) return hit[0];
  }
  return null;
}

/**
 * Read the RM issue key out of whatever shape Jira returns for an issue-picker
 * field: 'ABC-12', {key}, ['ABC-12'], [{key}]. Anything else yields null.
 */
export function extractDeploymentPackageKey(field: unknown): string | null {
  let v: unknown = field;
  if (Array.isArray(v)) {
    if (v.length !== 1) return null;
    v = v[0];
  }
  if (v && typeof v === 'object') v = (v as { key?: unknown }).key;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return ISSUE_KEY_RE.test(t) ? t : null;
}

/**
 * Read the target issue key out of a parent-style link field (Epic Link,
 * Advanced Roadmaps "Parent Link"). Tolerates 'ABC-1', {key}, {data:{key}}
 * and a one-element array of those; anything else yields null.
 */
export function extractLinkedIssueKey(value: unknown): string | null {
  if (Array.isArray(value)) return value.length === 1 ? extractLinkedIssueKey(value[0]) : null;
  if (typeof value === 'string') {
    const k = value.trim();
    return ISSUE_KEY_RE.test(k) ? k : null;
  }
  if (value && typeof value === 'object') {
    const o = value as { key?: unknown; data?: unknown };
    if (typeof o.key === 'string' && ISSUE_KEY_RE.test(o.key)) return o.key;
    if (o.data && typeof o.data === 'object') return extractLinkedIssueKey(o.data);
  }
  return null;
}

/**
 * Add (or merge into) a week by key: children are unioned by key. Returns a new
 * array; used to fold directly-resolved package weeks into the lazy week list.
 */
export function mergeWeek(weeks: RmWeek[], week: RmWeek): RmWeek[] {
  const i = weeks.findIndex((w) => w.key === week.key);
  if (i < 0) return [...weeks, week];
  const have = new Set(weeks[i].children.map((c) => c.key));
  const extra = week.children.filter((c) => !have.has(c.key));
  if (extra.length === 0) return weeks;
  const out = [...weeks];
  out[i] = { ...weeks[i], children: [...weeks[i].children, ...extra] };
  return out;
}

/** Build the PUT value for the package field in the shape editmeta reported. */
export function buildPackageFieldValue(key: string, shape: 'array' | 'single'): string | string[] {
  return shape === 'array' ? [key] : key;
}

export function indexChildToWeek(weeks: RmWeek[]): Map<string, RmWeek> {
  const map = new Map<string, RmWeek>();
  for (const w of weeks) for (const c of w.children) map.set(c.key, w);
  return map;
}

function dateOfVersion(v: PackageFixVersion, projectVersions: PackageFixVersion[]): string | null {
  return v.releaseDate ?? projectVersions.find((p) => p.id === v.id)?.releaseDate ?? null;
}

function versionsInWeek(projectVersions: PackageFixVersion[], week: RmWeek): PackageFixVersion[] {
  return projectVersions.filter((v) => v.releaseDate && isDateInWeek(v.releaseDate, week));
}

function setFixVersionFix(projectVersions: PackageFixVersion[], week: RmWeek): PackageFix | null {
  const candidates = versionsInWeek(projectVersions, week);
  return candidates.length === 1
    ? { kind: 'set-fix-version', versionId: candidates[0].id, versionName: candidates[0].name }
    : null;
}

function setPackageFix(
  dated: Array<PackageFixVersion & { releaseDate: string }>,
  weeks: RmWeek[],
  projectName: string,
  projectKey?: string,
): { fix: PackageFix } | { reason: string; detail?: string } {
  if (dated.length > 1)
    return { reason: 'Several fix versions are set, so the deployment package is ambiguous.' };
  const v = dated[0];
  const w = findWeekForDate(weeks, v.releaseDate);
  if (!w) return { reason: `No Release Management week covers ${v.name} (${v.releaseDate}).` };
  const child = findChildForProject(w, projectName, projectKey);
  if (!child) {
    const names = w.children
      .slice(0, 6)
      .map((c) => c.summary)
      .join(', ');
    return {
      reason: `No task for "${projectName}" under ${formatWeekLabel(w.summary)}.`,
      detail: names
        ? `Tasks there: ${names}${w.children.length > 6 ? ', …' : ''}`
        : 'No tasks found under that week.',
    };
  }
  return { fix: { kind: 'set-package', childKey: child.key, childSummary: child.summary } };
}

export function evaluatePackageSync(input: {
  pkgKey: string | null;
  fixVersions: PackageFixVersion[];
  weeks: RmWeek[];
  projectName: string;
  projectKey?: string;
  projectVersions: PackageFixVersion[];
}): PackageSyncResult {
  const { pkgKey, fixVersions, weeks, projectName, projectKey, projectVersions } = input;
  const hasFv = fixVersions.length > 0;
  if (!pkgKey && !hasFv) return { state: 'none', hint: '', fixes: [] };

  const dated = fixVersions
    .map((v) => ({ ...v, releaseDate: dateOfVersion(v, projectVersions) }))
    .filter((v): v is PackageFixVersion & { releaseDate: string } => !!v.releaseDate);

  if (!pkgKey) {
    if (dated.length === 0) {
      return {
        state: 'unresolved',
        hint: 'Fix version has no release date, so the deployment package cannot be derived.',
        fixes: [],
      };
    }
    const r = setPackageFix(dated, weeks, projectName, projectKey);
    if ('fix' in r) {
      return {
        state: 'fv-only',
        hint: 'Fix version is set but no deployment package.',
        fixes: [r.fix],
      };
    }
    return {
      state: 'fv-only',
      hint: `No deployment package is set. ${r.reason}`,
      detail: r.detail,
      fixes: [],
    };
  }

  const pkgWeek = indexChildToWeek(weeks).get(pkgKey) ?? null;
  if (!pkgWeek) {
    return {
      state: 'unresolved',
      hint: `${pkgKey} was not found in a known release week.`,
      fixes: [],
    };
  }

  if (!hasFv) {
    const fix = setFixVersionFix(projectVersions, pkgWeek);
    return {
      state: 'pkg-only',
      hint: 'Deployment package is set but no fix version.',
      fixes: fix ? [fix] : [],
    };
  }

  if (dated.length === 0) {
    return {
      state: 'unresolved',
      hint: 'Fix version has no release date, so it cannot be compared with the package week.',
      fixes: [],
    };
  }
  if (dated.some((v) => isDateInWeek(v.releaseDate, pkgWeek))) {
    return { state: 'ok', hint: '', fixes: [] };
  }
  const fixes: PackageFix[] = [];
  const fvFix = setFixVersionFix(projectVersions, pkgWeek);
  if (fvFix) fixes.push(fvFix);
  const pkgFix = setPackageFix(dated, weeks, projectName, projectKey);
  if ('fix' in pkgFix) fixes.push(pkgFix.fix);
  return {
    state: 'mismatch',
    hint: `Fix version release date is outside the package week (${pkgWeek.start} to ${pkgWeek.end}).`,
    fixes,
  };
}

/**
 * New fixVersions payload for a "set fix version" fix.
 *
 * Merge rule: keep the current versions except any *dated* version whose
 * release date lies outside the package week (those are the stale ones), keep
 * undated versions untouched, and add the target version.
 */
export function computeFixVersionsForFix(
  current: PackageFixVersion[],
  targetId: string,
  week: RmWeek,
  projectVersions: PackageFixVersion[],
): { id: string }[] {
  const kept = current.filter((v) => {
    if (v.id === targetId) return false;
    const d = dateOfVersion(v, projectVersions);
    return !d || isDateInWeek(d, week);
  });
  return [...kept.map((v) => ({ id: v.id })), { id: targetId }];
}

/**
 * Bulk plan for the Releases tab. Direction is always fix version -> package:
 * the release's version is authoritative on the release screens. Only Stories
 * are touched; stories already in the version's week or without a resolvable
 * child are skipped.
 */
export function planBulkSync(
  stories: PackageStoryLike[],
  version: { releaseDate?: string },
  weeks: RmWeek[],
  shape: PackageEditShape,
): { key: string; fields: Record<string, unknown> }[] {
  if (shape === 'not-editable' || !version.releaseDate) return [];
  const week = findWeekForDate(weeks, version.releaseDate);
  if (!week) return [];
  const childToWeek = indexChildToWeek(weeks);
  const plan: { key: string; fields: Record<string, unknown> }[] = [];
  for (const s of stories) {
    if (s.fields.issuetype?.name !== 'Story') continue;
    const name = s.fields.project?.name ?? s.fields.project?.key ?? '';
    const child = findChildForProject(week, name, s.fields.project?.key);
    if (!child) continue;
    const current = extractDeploymentPackageKey(s.fields[DEPLOYMENT_PACKAGE_FIELD]);
    if (current && childToWeek.get(current)?.key === week.key) continue;
    plan.push({
      key: s.key,
      fields: { [DEPLOYMENT_PACKAGE_FIELD]: buildPackageFieldValue(child.key, shape) },
    });
  }
  return plan;
}
