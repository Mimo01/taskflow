/**
 * Release milestone helpers — pure title-format validation, due-date
 * formatting, ancestor filtering, and duplicate detection for the release
 * detail page's milestone-creation flow.
 *
 * React-free: every function here takes explicit parameters and returns
 * plain data — no closures over component state, no hooks, no store reads.
 * This module deliberately does NOT import the GitLab service's milestone
 * type — a local structural type (`MilestoneLike`) keeps it free of service
 * coupling and lets it compile independently of Plan 88-02's interface
 * change (D-07/D-12/D-21).
 *
 * D-01 (user correction, supersedes RELMS-03's stated format): `REQUIREMENTS.md`
 * documents milestone titles as `1.1.0` / `2.0.0`. This is a documentation
 * error. The team's real GitLab milestone titles are `X.Y.Z (DD.MM.YYYY)` —
 * e.g. `33.5.0 (21.07.2026)`. Every function here implements the real format;
 * do not "fix" this module back toward the `1.1.0` requirement text.
 */

/** Structural shape shared by every list-taking function in this module —
 *  deliberately NOT `GitLabMilestone` (no service import, per D-21). */
export interface MilestoneLike {
  title: string;
  project_id?: number | null;
  group_id?: number | null;
  /** ISO `YYYY-MM-DD`. Optional — only date-ordering helpers read it. */
  due_date?: string | null;
  /** ISO `YYYY-MM-DD`. Fallback when `due_date` is absent. */
  start_date?: string | null;
}

/**
 * Single source-of-truth regex for the real milestone title format
 * `X.Y.Z (DD.MM.YYYY)`, anchored so no leading/trailing text or whitespace
 * variant can slip through (RELMS-03/D-01/D-02). Both the create dialog's
 * live validation and any duplicate-check normalization should reference
 * this constant rather than re-declaring the pattern.
 */
export const MILESTONE_TITLE_FORMAT_RE = /^\d+\.\d+\.\d+ \(\d{2}\.\d{2}\.\d{4}\)$/;

/**
 * Validate a candidate milestone title against the real `X.Y.Z (DD.MM.YYYY)`
 * format (D-02: off-format titles cannot be submitted). The underlying regex
 * is not `/g`, so it carries no `lastIndex` state and is safe to reuse.
 *
 * @param title - a candidate milestone title
 * @returns whether the title matches the enforced format exactly
 */
export function isValidMilestoneTitle(title: string): boolean {
  return MILESTONE_TITLE_FORMAT_RE.test(title);
}

/**
 * Convert a Jira `YYYY-MM-DD` release date to the `DD.MM.YYYY` title
 * component (D-04). Built via string slicing, not `new Date()`, so no
 * timezone shift can occur.
 *
 * @param isoDate - a Jira fix-version release date, or null/undefined/malformed
 * @returns the `DD.MM.YYYY` formatted date, or `null` when the input isn't a valid `YYYY-MM-DD` string
 */
export function formatMilestoneDueDate(isoDate: string | null | undefined): string | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const year = isoDate.slice(0, 4);
  const month = isoDate.slice(5, 7);
  const day = isoDate.slice(8, 10);
  return `${day}.${month}.${year}`;
}

/**
 * Build a full milestone title from a version and a Jira ISO release date
 * (D-02 prefill). The due date is mandatory (D-04) — a dateless milestone
 * would be created and would still render as unmatched, so it must not be
 * buildable.
 *
 * @param version - the bare version string (e.g. `"33.5.0"`)
 * @param isoReleaseDate - a Jira fix-version release date, or null/undefined/malformed
 * @returns the built title, or `null` when the date cannot be formatted
 */
export function buildMilestoneTitle(
  version: string,
  isoReleaseDate: string | null | undefined,
): string | null {
  const formatted = formatMilestoneDueDate(isoReleaseDate);
  return formatted ? `${version} (${formatted})` : null;
}

/**
 * Filter a milestone list down to project-owned entries, excluding inherited
 * group (ancestor) milestones (D-06/D-07). Defensive against RESEARCH
 * assumption A3: if no element in the input carries a numeric `project_id`
 * (the field may be entirely absent on this GitLab instance), the list is
 * returned UNFILTERED rather than emptied — a missing field degrades to
 * "no ancestor filtering" instead of silently hiding every milestone.
 *
 * @param milestones - candidate milestones (windowed query result)
 * @param projectId - the active GitLab project id
 * @returns milestones owned by `projectId`, or the unfiltered input when `project_id` is absent from every element
 */
export function ownProjectMilestones<T extends MilestoneLike>(
  milestones: readonly T[],
  projectId: number,
): T[] {
  const anyHasNumericProjectId = milestones.some((m) => typeof m.project_id === 'number');
  if (!anyHasNumericProjectId) {
    return [...milestones];
  }
  return milestones.filter((m) => m.project_id === projectId);
}

/** How many milestones the create-dialog reference list shows (D-03). */
export const RECENT_MILESTONE_LIMIT = 5;

/**
 * Pick the most recent milestones by date, newest first, for the create-dialog
 * reference list (D-03).
 *
 * The reference list deliberately does NOT reuse the ±7-day match window: that
 * window exists to resolve a milestone for THIS release, and around a weekly
 * cadence it often contains a single entry — too little context to judge a new
 * title against. Widening it here would change `resolveGitLabMatch`, so this
 * takes a separate, unwindowed input instead.
 *
 * Milestones with neither `due_date` nor `start_date` sort last, since an
 * undated milestone carries no position in the release sequence.
 *
 * @param milestones - candidate milestones (already ancestor-filtered)
 * @param limit - maximum entries to return
 * @returns up to `limit` milestones, newest first
 */
export function recentMilestonesByDate<T extends MilestoneLike>(
  milestones: readonly T[],
  limit: number = RECENT_MILESTONE_LIMIT,
): T[] {
  if (limit <= 0) return [];
  const dateOf = (m: T) => m.due_date ?? m.start_date ?? '';
  return [...milestones]
    .sort((a, b) => {
      const da = dateOf(a);
      const db = dateOf(b);
      if (da === db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    })
    .slice(0, limit);
}

/**
 * Normalize a milestone title for comparison-only purposes (RELMS-04):
 * trimmed, internal whitespace runs collapsed to a single space, lowercased.
 * Callers must still send the user's exact unmodified input to GitLab on
 * write — this normalization never touches the write payload.
 *
 * @param title - a milestone title
 * @returns the normalized comparison string
 */
export function normalizeMilestoneTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Find an existing project-owned milestone whose normalized title collides
 * with a candidate title (RELMS-04). Runs `ownProjectMilestones` first so an
 * inherited group milestone with a colliding title is never reported as a
 * conflict (D-06).
 *
 * This check is best-effort (D-08): the source list is the ±7-day windowed
 * milestone query, so a milestone dated outside that window is invisible
 * here and GitLab's server-side validation remains the authority.
 *
 * Known open item: `.planning/phases/88-release-branch-milestone-creation/probe.sh`
 * has not been run against the live instance, so exact-vs-fuzzy matching is
 * unconfirmed; the normalized-comparison / exact-write split implemented
 * here is the defensive default.
 *
 * @param milestones - candidate milestones (windowed query result)
 * @param candidateTitle - the title the user is about to submit
 * @param projectId - the active GitLab project id
 * @returns the colliding milestone, or `null` when no project-owned milestone collides
 */
export function findDuplicateMilestone<T extends MilestoneLike>(
  milestones: readonly T[],
  candidateTitle: string,
  projectId: number,
): T | null {
  const ownMilestones = ownProjectMilestones(milestones, projectId);
  const normalizedCandidate = normalizeMilestoneTitle(candidateTitle);
  const found = ownMilestones.find((m) => normalizeMilestoneTitle(m.title) === normalizedCandidate);
  return found ?? null;
}
