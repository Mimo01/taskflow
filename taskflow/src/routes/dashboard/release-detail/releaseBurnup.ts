// Release burnup derivations (P94 D-03, D-04, D-16).
//
// Axis: starts at the previous fix version's release date (by date, released or
// not), falling back to the earliest valid issue `created` day; ends at the
// release date when released or still in the future, otherwise today.
// Series: scope counts issues by created day (clamped to the axis); done counts
// status-category-done issues by resolutiondate. A done issue without a
// resolutiondate counts on the last series day (D-16) so the final point always
// equals the header done count. Reopened issues (category not done) never count.
// Removals from the version are not tracked (no changelog). No forecast (D-04).
import { addCalendarDays, catOf, dateKeyMs } from '@/lib/epic-progress';
import type { JiraFixVersion, JiraIssue } from '@/services/jira';
import { issueStoryPoints } from './releaseSummaries';

export interface BurnupAxis {
  start: string;
  end: string;
  seriesEnd: string;
  previousName: string | null;
  releaseDate: string | null;
  showToday: boolean;
  showRelease: boolean;
}

export interface BurnupPoint {
  day: string;
  t: number;
  scope: number;
  done: number;
  doneSp: number;
}

function dayKey(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const k = v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : null;
}

function clamp(day: string, lo: string, hi: string): string {
  if (day < lo) return lo;
  if (day > hi) return hi;
  return day;
}

/** The dated fix version immediately before `version` (strictly earlier date). */
export function previousVersion(
  fixVersions: readonly JiraFixVersion[] | undefined,
  version: JiraFixVersion,
): JiraFixVersion | null {
  const own = dayKey(version.releaseDate);
  if (!own || !fixVersions) return null;
  let best: JiraFixVersion | null = null;
  let bestDay = '';
  for (const v of fixVersions) {
    if (v.id === version.id) continue;
    const d = dayKey(v.releaseDate);
    if (!d || d >= own) continue;
    if (d > bestDay) {
      best = v;
      bestDay = d;
    }
  }
  return best;
}

export function releaseBurnupAxis(args: {
  version: JiraFixVersion;
  previous: JiraFixVersion | null;
  issues: JiraIssue[];
  today: string;
}): BurnupAxis | null {
  const { version, previous, issues, today } = args;
  const releaseDate = dayKey(version.releaseDate);
  let start = dayKey(previous?.releaseDate);
  if (!start) {
    for (const i of issues) {
      const c = dayKey(i.fields.created);
      if (c && (!start || c < start)) start = c;
    }
  }
  if (!start) return null;
  const end = releaseDate && (version.released || releaseDate >= today) ? releaseDate : today;
  const seriesEnd = end < today ? end : today;
  return {
    start,
    end,
    seriesEnd,
    previousName: previous?.name ?? null,
    releaseDate,
    showToday: start <= today && today <= end,
    showRelease: releaseDate !== null && start <= releaseDate && releaseDate <= end,
  };
}

export function deriveReleaseBurnup(
  issues: JiraIssue[],
  axis: BurnupAxis,
  spKey: string,
): BurnupPoint[] {
  const { start, seriesEnd } = axis;
  if (seriesEnd < start) return [];
  const scopeAt = new Map<string, number>();
  const doneAt = new Map<string, number>();
  const doneSpAt = new Map<string, number>();
  for (const i of issues) {
    const cDay = clamp(dayKey(i.fields.created) ?? start, start, seriesEnd);
    scopeAt.set(cDay, (scopeAt.get(cDay) ?? 0) + 1);
    if (catOf(i) === 'done') {
      const rDay = clamp(dayKey(i.fields.resolutiondate) ?? seriesEnd, start, seriesEnd);
      doneAt.set(rDay, (doneAt.get(rDay) ?? 0) + 1);
      doneSpAt.set(rDay, (doneSpAt.get(rDay) ?? 0) + (issueStoryPoints(i, spKey) ?? 0));
    }
  }
  const points: BurnupPoint[] = [];
  let scope = 0;
  let done = 0;
  let doneSp = 0;
  for (let day = start; day <= seriesEnd; day = addCalendarDays(day, 1)) {
    scope += scopeAt.get(day) ?? 0;
    done += doneAt.get(day) ?? 0;
    doneSp += doneSpAt.get(day) ?? 0;
    points.push({ day, t: dateKeyMs(day), scope, done, doneSp });
  }
  return points;
}
