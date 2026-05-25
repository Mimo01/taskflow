/**
 * mrMatching — pure MR-to-story matching logic for the Today column.
 *
 * Matches reviewer MRs (GitLabMR) and participating MRs (ParticipatedMR) to
 * the sprint stories displayed in the In Progress / Up Next sections.
 *
 * Matching uses linkMRToTask's title-first-then-branch strategy:
 *   1. Scan MR title for Jira keys present in the displayed set.
 *   2. If no match, scan source_branch / sourceBranch.
 *   3. Map any matched sub-task key to its top-level story key.
 *
 * Deduplication: if the same iid appears in both reviewer and participating sets,
 * it is nested once with kind='review'.
 *
 * Pure function — no React, no side-effects, unit-testable.
 */

import type { GitLabMR, ParticipatedMR } from '@/services/gitlab';
import { extractTicketKeys, linkMRToTask } from '@/services/linkEngine';
import type { SprintRow } from './filterSprintItems';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single nested MR entry rendered under a sprint story row. */
export interface NestedMr {
  iid: number;
  title: string;
  kind: 'review' | 'participating';
  /** Unresolved thread count — present for participating MRs, undefined for reviewer MRs. */
  openThreadCount?: number;
}

export interface MrMatchingResult {
  /** Map from top-level story key → nested MRs that matched it. */
  mrsByStory: Map<string, NestedMr[]>;
  /** Reviewer MRs that did not match any displayed story. */
  unmatchedReviewerMrs: GitLabMR[];
  /** Participating MRs that did not match any displayed story (after dedup). */
  unmatchedParticipatingMrs: ParticipatedMR[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Build a mapping from every displayed Jira key → its top-level row key.
 *
 * For a parent row:  parent.key → parent.key, each subtask.key → parent.key.
 * For an orphan (standalone) row with no subtasks: row.issue.key → row.issue.key.
 */
function buildKeyToStoryKey(rows: SprintRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const storyKey = row.issue.key;
    map.set(storyKey, storyKey);
    for (const subtask of row.subtasks) {
      map.set(subtask.key, storyKey);
    }
  }
  return map;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Match reviewer + participating MRs to the sprint stories in `rows`.
 *
 * @param rows              - Combined inProgress + upNext sprint rows.
 * @param reviewerMrs       - GitLabMR[] from fetchReviewerMRs.
 * @param participatingMrs  - ParticipatedMR[] from fetchParticipatedMRs.
 */
export function matchMrsToStories(
  rows: SprintRow[],
  reviewerMrs: GitLabMR[],
  participatingMrs: ParticipatedMR[],
): MrMatchingResult {
  // Build lookup structures
  const keyToStoryKey = buildKeyToStoryKey(rows);
  const displayedKeys = new Set(keyToStoryKey.keys());

  const mrsByStory = new Map<string, NestedMr[]>();

  // Track which reviewer iids have been matched (for dedup against participating)
  const matchedReviewerIids = new Set<number>();

  // ── Reviewer MRs ────────────────────────────────────────────────────────────
  const unmatchedReviewerMrs: GitLabMR[] = [];

  for (const mr of reviewerMrs) {
    const matchedKey = linkMRToTask(mr, displayedKeys);
    if (matchedKey === null) {
      unmatchedReviewerMrs.push(mr);
      continue;
    }
    const storyKey = keyToStoryKey.get(matchedKey);
    if (storyKey === undefined) {
      unmatchedReviewerMrs.push(mr);
      continue;
    }
    matchedReviewerIids.add(mr.iid);
    const nested: NestedMr = { iid: mr.iid, title: mr.title, kind: 'review' };
    const existing = mrsByStory.get(storyKey);
    if (existing) {
      existing.push(nested);
    } else {
      mrsByStory.set(storyKey, [nested]);
    }
  }

  // ── Participating MRs ────────────────────────────────────────────────────────
  const unmatchedParticipatingMrs: ParticipatedMR[] = [];

  for (const mr of participatingMrs) {
    // Dedup: if already nested as a reviewer MR, skip entirely
    if (matchedReviewerIids.has(mr.mrIid)) {
      continue;
    }

    // Mirror linkMRToTask's title-first-then-branch order
    const titleKeys = extractTicketKeys(mr.title);
    const titleMatch = titleKeys.find((k) => displayedKeys.has(k));
    const matchedKey =
      titleMatch ??
      (extractTicketKeys(mr.sourceBranch ?? '').find((k) => displayedKeys.has(k)) ?? null);

    if (matchedKey === null) {
      unmatchedParticipatingMrs.push(mr);
      continue;
    }
    const storyKey = keyToStoryKey.get(matchedKey);
    if (storyKey === undefined) {
      unmatchedParticipatingMrs.push(mr);
      continue;
    }
    const nested: NestedMr = {
      iid: mr.mrIid,
      title: mr.title,
      kind: 'participating',
      openThreadCount: mr.openThreadCount,
    };
    const existing = mrsByStory.get(storyKey);
    if (existing) {
      existing.push(nested);
    } else {
      mrsByStory.set(storyKey, [nested]);
    }
  }

  return { mrsByStory, unmatchedReviewerMrs, unmatchedParticipatingMrs };
}
