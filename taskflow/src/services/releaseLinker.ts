/**
 * Release linker — pure date-matching utility between Jira fix versions and GitLab milestones/tags.
 *
 * Date normalization rules:
 * - "YYYY-MM-DD" strings (Jira fix versions, GitLab milestone due_date) are parsed as UTC midnight
 *   by appending 'T00:00:00Z' to avoid local timezone drift (critical for UTC+14 users).
 * - ISO 8601 strings with timezone (GitLab tag commit.created_at) are floored to UTC midnight
 *   by rounding down to the nearest day in milliseconds.
 *
 * Match thresholds:
 * - diff === 0 days → 'exact'
 * - diff <= 1 day  → 'fuzzy'
 * - diff > 1 day   → 'none'
 */

export type ReleaseMatchType = 'exact' | 'fuzzy' | 'none';

export interface ReleaseMatch {
  type: ReleaseMatchType;
  candidateName: string;
  candidateUrl: string;
}

/**
 * Determine whether a GitLab milestone or tag date matches a Jira fix version release date.
 *
 * @param fixVersionDate - Jira fix version releaseDate "YYYY-MM-DD" or undefined/null
 * @param candidate      - GitLab candidate with date ("YYYY-MM-DD" or ISO 8601), name, and url
 * @returns ReleaseMatch with type 'exact', 'fuzzy', or 'none'
 */
export function matchGitLabToFixVersion(
  fixVersionDate: string | undefined | null,
  candidate: { date: string | null; name: string; url: string },
): ReleaseMatch {
  const none: ReleaseMatch = {
    type: 'none',
    candidateName: candidate.name,
    candidateUrl: candidate.url,
  };

  if (!fixVersionDate || !candidate.date) {
    return none;
  }

  // Parse fixVersionDate as UTC midnight (always "YYYY-MM-DD" format from Jira)
  const fixMs = new Date(fixVersionDate + 'T00:00:00Z').getTime();

  // Parse candidate date — detect if it's a date-only string or a full ISO 8601 string
  let candMs: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate.date)) {
    // Date-only string: parse as UTC midnight to prevent timezone drift
    candMs = new Date(candidate.date + 'T00:00:00Z').getTime();
  } else {
    // Full ISO 8601 with timezone: floor to UTC midnight
    candMs = Math.floor(new Date(candidate.date).getTime() / 86400000) * 86400000;
  }

  if (isNaN(fixMs) || isNaN(candMs)) {
    return none;
  }

  const diffDays = Math.abs(fixMs - candMs) / 86400000;

  if (diffDays === 0) {
    return { type: 'exact', candidateName: candidate.name, candidateUrl: candidate.url };
  }

  if (diffDays <= 1) {
    return { type: 'fuzzy', candidateName: candidate.name, candidateUrl: candidate.url };
  }

  return none;
}
