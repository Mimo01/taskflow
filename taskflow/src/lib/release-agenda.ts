import { daysBetweenKeys, groupReleases, type ReleasePillTone } from '@/lib/release-list';
import type { JiraFixVersion } from '@/services/jira';

export type ReleaseCountdown = { tone: ReleasePillTone; label: string };
export type AgendaKind = 'overdue' | 'next' | 'near' | 'planned' | 'undated';
export type AgendaRelease = {
  type: 'release';
  version: JiraFixVersion;
  kind: AgendaKind;
  quiet: boolean;
  pill: boolean;
  countdown: ReleaseCountdown;
};
export type AgendaEntry =
  | AgendaRelease
  | { type: 'today'; date: string }
  | { type: 'month'; label: string }
  | { type: 'section'; label: 'No date'; count: number };

/** F5 countdown wording: late / Today / Tomorrow / In N days (<14) / In N weeks. */
export function releaseCountdown(releaseDate: string | undefined, today: string): ReleaseCountdown {
  if (!releaseDate) return { tone: 'amber', label: 'No date' };
  const n = daysBetweenKeys(today, releaseDate);
  if (n < 0) return { tone: 'red', label: `${-n} ${n === -1 ? 'day' : 'days'} late` };
  if (n === 0) return { tone: 'blue', label: 'Today' };
  if (n === 1) return { tone: 'muted', label: 'Tomorrow' };
  if (n < 14) return { tone: 'muted', label: `In ${n} days` };
  return { tone: 'muted', label: `In ${Math.round(n / 7)} weeks` };
}

/** Detail header pill: the list's countdown wording, with Released winning (green). */
export function releaseHeaderPill(
  v: { released: boolean; releaseDate?: string },
  today: string,
): ReleaseCountdown {
  if (v.released) return { tone: 'green', label: 'Released' };
  return releaseCountdown(v.releaseDate, today);
}

function utcDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date stamp parts, formatted in UTC so the result never depends on local timezone. */
export function dateStamp(key: string): { day: string; weekday: string; inline: string } {
  const date = utcDate(key);
  const day = date
    .toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' })
    .replace('Sept', 'Sep');
  const weekday = date.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short' });
  return { day, weekday, inline: `${weekday} ${day}` };
}

function monthLabel(key: string, todayKey: string): string {
  const name = utcDate(key).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  const year = key.slice(0, 4);
  return year === todayKey.slice(0, 4) ? name : `${name} ${year}`;
}

function release(version: JiraFixVersion, kind: AgendaKind, today: string): AgendaRelease {
  return {
    type: 'release',
    version,
    kind,
    quiet: kind === 'planned',
    pill: kind !== 'planned',
    countdown: releaseCountdown(version.releaseDate, today),
  };
}

/**
 * F5 agenda order. Takes no breakdowns: the base row weight comes from version data
 * alone. ReleaseAgenda promotes a quiet planned row to a full row once it has issues.
 */
export function buildAgenda(
  versions: readonly JiraFixVersion[],
  today: string,
): {
  entries: AgendaEntry[];
  nextId: string | null;
  nearId: string | null;
  released: JiraFixVersion[];
} {
  const { released } = groupReleases(versions);
  const undated = versions.filter((v) => !v.released && !v.releaseDate);
  const dated = versions
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => !v.released && !!v.releaseDate)
    .sort((a, b) => (a.v.releaseDate ?? '').localeCompare(b.v.releaseDate ?? '') || a.i - b.i)
    .map(({ v }) => v);

  const upcoming = dated.filter((v) => (v.releaseDate ?? '') >= today);
  const nextId = upcoming[0]?.id ?? null;
  const nearId = upcoming[1]?.id ?? null;

  const entries: AgendaEntry[] = [];
  let todayEmitted = false;
  let lastMonth = today.slice(0, 7);
  for (const v of dated) {
    const date = v.releaseDate ?? '';
    if (date < today) {
      entries.push(release(v, 'overdue', today));
      continue;
    }
    if (!todayEmitted) {
      entries.push({ type: 'today', date: today });
      todayEmitted = true;
    }
    if (date.slice(0, 7) !== lastMonth) {
      entries.push({ type: 'month', label: monthLabel(date, today) });
      lastMonth = date.slice(0, 7);
    }
    const kind: AgendaKind = v.id === nextId ? 'next' : v.id === nearId ? 'near' : 'planned';
    entries.push(release(v, kind, today));
  }
  if (!todayEmitted) entries.push({ type: 'today', date: today });

  if (undated.length > 0) {
    entries.push({ type: 'section', label: 'No date', count: undated.length });
    for (const v of undated) entries.push(release(v, 'undated', today));
  }
  return { entries, nextId, nearId, released };
}

export type ReleaseSummary = {
  planned: number;
  overdue: number;
  undated: number;
  /** Median days between the most recent ship dates; null with fewer than 2. */
  cadenceDays: number | null;
  /** Days since the latest ship date up to today; null when nothing has shipped. */
  lastShippedDays: number | null;
};

const CADENCE_SAMPLE = 9;

/** "1 day" / "N days" under two weeks, "N weeks" from 14 days. */
export function spanLabel(days: number): string {
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'}`;
  return `${Math.round(days / 7)} weeks`;
}

export function releaseSummary(versions: readonly JiraFixVersion[], today: string): ReleaseSummary {
  let planned = 0;
  let overdue = 0;
  let undated = 0;
  const shipped = new Set<string>();
  for (const v of versions) {
    if (v.released) {
      if (v.releaseDate && v.releaseDate <= today) shipped.add(v.releaseDate);
      continue;
    }
    if (!v.releaseDate) undated += 1;
    else {
      planned += 1;
      if (v.releaseDate < today) overdue += 1;
    }
  }
  const dates = [...shipped].sort().reverse().slice(0, CADENCE_SAMPLE);
  const gaps = dates.slice(1).map((d, i) => daysBetweenKeys(d, dates[i]));
  gaps.sort((a, b) => a - b);
  const mid = gaps.length >> 1;
  const cadenceDays =
    gaps.length === 0
      ? null
      : gaps.length % 2
        ? gaps[mid]
        : Math.round((gaps[mid - 1] + gaps[mid]) / 2);
  const lastShippedDays = dates.length ? daysBetweenKeys(dates[0], today) : null;
  return { planned, overdue, undated, cadenceDays, lastShippedDays };
}
