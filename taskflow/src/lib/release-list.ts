import { PROGRESS_SEGMENT_CLASS, type TooltipRowData } from '@/lib/aio-cycle-list';
import { findChildForProject, findWeekForDate, type RmWeek } from '@/lib/deployment-package';
import type { JiraFixVersion } from '@/services/jira';

/** Issue counts per Jira status category (structurally identical to VersionStatusBreakdown). */
export type StatusBreakdown = { new: number; indeterminate: number; done: number };

export type ReleasePillTone = 'green' | 'red' | 'blue' | 'muted' | 'amber';
export type ReleasePill = { tone: ReleasePillTone; label: string };

/** Whole calendar days from fromKey to toKey (YYYY-MM-DD). UTC arithmetic, so DST-free. */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  const utc = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(toKey) - utc(fromKey)) / 86_400_000);
}

const dateDesc = (a: JiraFixVersion, b: JiraFixVersion) =>
  (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');

/** Upcoming = undated (source order) then dated unreleased, date descending; Released = date descending. */
export function groupReleases(versions: readonly JiraFixVersion[]): {
  upcoming: JiraFixVersion[];
  released: JiraFixVersion[];
} {
  const undated = versions.filter((v) => !v.released && !v.releaseDate);
  const unreleased = versions.filter((v) => !v.released && !!v.releaseDate).sort(dateDesc);
  const released = versions.filter((v) => v.released).sort(dateDesc);
  return { upcoming: [...undated, ...unreleased], released };
}

export function breakdownTotal(b: StatusBreakdown): number {
  return b.done + b.indeterminate + b.new;
}

export const RELEASE_SEGMENT_ORDER = ['done', 'indeterminate', 'new'] as const;

export const RELEASE_SEGMENT_CLASS: Record<keyof StatusBreakdown, string> = {
  done: PROGRESS_SEGMENT_CLASS.pass,
  indeterminate: PROGRESS_SEGMENT_CLASS.inProgress,
  new: PROGRESS_SEGMENT_CLASS.notRun,
};

const RELEASE_SEGMENT_LABEL: Record<keyof StatusBreakdown, string> = {
  done: 'Done',
  indeterminate: 'In Progress',
  new: 'To Do',
};

const RELEASE_SEGMENT_COLOR: Record<keyof StatusBreakdown, string> = {
  done: 'var(--color-green-500)',
  indeterminate: 'var(--color-blue-500)',
  new: 'var(--color-muted-foreground)',
};

export function releaseTooltipRows(b: StatusBreakdown): TooltipRowData[] {
  return RELEASE_SEGMENT_ORDER.map((k) => ({
    label: RELEASE_SEGMENT_LABEL[k],
    value: b[k],
    color: RELEASE_SEGMENT_COLOR[k],
  }));
}

export type DerivedPackage = { week: RmWeek; child: { key: string; summary: string } | null };

/** The RM child of the WEEK containing the release date (display only). */
export function derivePackage(
  weeks: readonly RmWeek[],
  releaseDate: string | undefined,
  activeProjectName: string | null,
  activeJiraProject: string | null,
): DerivedPackage | null {
  if (!releaseDate || weeks.length === 0) return null;
  const week = findWeekForDate([...weeks], releaseDate);
  if (!week) return null;
  const child = activeProjectName
    ? findChildForProject(week, activeProjectName, activeJiraProject ?? undefined)
    : null;
  return { week, child };
}
