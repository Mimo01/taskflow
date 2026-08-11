import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  createBranch,
  createMilestone,
  fetchAllProjectMRs,
  fetchBranch,
  fetchBranchTargetedMRs,
  fetchMilestoneMRs,
  fetchProject,
  fetchProjectMilestones,
  fetchRecentProjectMRs,
  filterMilestonesToRange,
  searchProjectTags,
} from '@/services/gitlab';
import { fetchFixVersionIssues, fetchFixVersions, fetchVersionIssueCounts } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { buildDriftRows, countFlaggedMRs, selectChannelA } from './driftDetection';
import {
  deriveReleaseBranchName,
  extractVersionFromMilestoneTitle,
  findReleaseTag,
  resolveBranchState,
} from './releaseBranch';
import { ownProjectMilestones } from './releaseMilestone';
import {
  buildWrongMilestoneMap,
  computeHasStoryPoints,
  computeIssueStatusCounts,
  computeLabelCoverage,
  computeLabelSummary,
  computeMilestoneWindow,
  computeMrStateCounts,
  computeStoryPoints,
  matchIssuesToMRs,
  resolveGitLabMatch,
} from './releaseSummaries';

/**
 * useReleaseDetail — the single data-layer hook for the release detail page.
 *
 * Runs all 6 queries (Jira fix versions, Jira issue counts, GitLab milestones,
 * Jira fix-version issues, GitLab milestone MRs, GitLab recent project MRs),
 * owns the GitLab-token effect, and calls into `releaseSummaries.ts` for every
 * derived value. Query keys, staleTime and enabled guards are byte-identical
 * to their pre-refactor form to preserve cache sharing with `ReleasesTab` and
 * `UpcomingReleasesTimeline` (D-11).
 */
export function useReleaseDetail(versionId: string | undefined) {
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl, activeGitlabProject } = useAuthStore();
  const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
  const queryClient = useQueryClient();

  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then((t) => setGitlabToken(t))
        .catch(() => setGitlabToken(null));
    }
  }, [gitlabBaseUrl]);

  // Fetch all fix versions (shared cache key with ReleasesTab)
  const { data: fixVersions, isLoading } = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !activeJiraProject) throw new Error('No credentials');
      return fetchFixVersions(jiraBaseUrl, token, activeJiraProject);
    },
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!activeJiraProject,
  });

  // Find the matching version
  const version = fixVersions?.find((v) => v.id === versionId) ?? null;

  // Fetch issue counts for this version
  const { data: issueCounts } = useQuery({
    queryKey: ['jira-version-counts', versionId],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !versionId) throw new Error('No credentials');
      return fetchVersionIssueCounts(jiraBaseUrl, token, versionId);
    },
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!versionId,
  });

  // Fetch GitLab milestones scoped around this version's release date
  const milestoneWindow = computeMilestoneWindow(version?.releaseDate);

  // One paginated fetch of the project's milestones serves both consumers:
  // the ±7-day match window below and the create-dialog reference list.
  // `fetchProjectMilestonesInRange` is itself this same fetch plus a client-side
  // filter, so querying both separately paginated the whole project twice per
  // mount and refetched twice on every prefix invalidation.
  const { data: allProjectMilestones } = useQuery({
    queryKey: ['gitlab-milestones', activeGitlabProject, 'all'],
    queryFn: () =>
      fetchProjectMilestones(gitlabBaseUrl ?? '', gitlabToken ?? '', activeGitlabProject ?? 0),
    enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken,
    staleTime: 5 * 60_000,
  });

  // Windowed subset driving resolveGitLabMatch — same predicate
  // `fetchProjectMilestonesInRange` applied server-side-fetched data to, so the
  // matching behaviour is unchanged. Stays `undefined` until the fetch resolves
  // (as the removed query did), which the match resolver treats as "not loaded".
  const milestones =
    allProjectMilestones && milestoneWindow
      ? filterMilestonesToRange(allProjectMilestones, milestoneWindow.from, milestoneWindow.to)
      : undefined;

  // Match GitLab milestone to this fix version by date.
  const { gitlabMatch, matchedMilestone } = resolveGitLabMatch(version?.releaseDate, milestones);

  // Derive the release branch name from the matched milestone's version component (D-09).
  const releaseBranchName = deriveReleaseBranchName(matchedMilestone?.title);

  // Fetch the project's default branch (D-14 — never a hardcoded fallback branch name).
  const { data: project } = useQuery({
    queryKey: ['gitlab-project', activeGitlabProject],
    queryFn: () => fetchProject(gitlabBaseUrl ?? '', gitlabToken ?? '', activeGitlabProject ?? 0),
    enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken,
    staleTime: 5 * 60_000,
  });
  const defaultBranch = project?.default_branch ?? null;

  // Check whether the derived release branch already exists.
  const {
    data: branchResult,
    isError: branchCheckFailed,
    refetch: refetchBranchQuery,
  } = useQuery({
    queryKey: ['gitlab-branch', activeGitlabProject, releaseBranchName],
    queryFn: () =>
      fetchBranch(
        gitlabBaseUrl ?? '',
        gitlabToken ?? '',
        activeGitlabProject ?? 0,
        releaseBranchName ?? '',
      ),
    enabled:
      !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && releaseBranchName !== null,
    staleTime: 5 * 60_000,
  });

  // CR-03: `fetchBranch` throws on 401/403/500/timeout, so without this signal a
  // failed check is indistinguishable from in-flight (`branchExists === undefined`
  // covers both) and pins the UI at 'Loading…' forever with no retry.
  // Release branches are deleted once merged, so a released version's branch is
  // legitimately gone. Look for the `v<version>` tag as the surviving artifact.
  // Only fetched for released versions whose branch check came back negative —
  // the tag adds nothing while a branch still exists.
  const releasedVersion = version?.released === true;
  const matchedVersionNumber = extractVersionFromMilestoneTitle(matchedMilestone?.title);
  const needsTagLookup =
    releasedVersion && branchResult?.exists === false && !!matchedVersionNumber;

  const { data: releaseTags } = useQuery({
    queryKey: ['gitlab-release-tags', activeGitlabProject, matchedVersionNumber],
    queryFn: () =>
      searchProjectTags(
        gitlabBaseUrl ?? '',
        gitlabToken ?? '',
        activeGitlabProject ?? 0,
        matchedVersionNumber ?? '',
      ),
    enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && needsTagLookup,
    staleTime: 5 * 60_000,
  });

  const branchState = resolveBranchState({
    hasMatchedMilestone: matchedMilestone !== null,
    milestoneTitle: matchedMilestone?.title ?? null,
    branchExists: branchResult?.exists,
    branchCheckFailed,
    versionReleased: releasedVersion,
    releaseTagName: findReleaseTag(
      (releaseTags ?? []).map((t) => t.name),
      matchedVersionNumber,
    ),
  });

  // CR-03: wrap `refetch` so callers (the sidebar's Retry button) need no arguments.
  const refetchBranchCheck = () => {
    void refetchBranchQuery();
  };

  // Create the release branch off the project's fetched default_branch (D-14, D-22).
  // No optimistic update, no success notification (D-15) — invalidate on success and let both the
  // detail-view branch query and the Releases-list indicator re-fetch from the server.
  const createBranchMutation = useMutation({
    mutationFn: () => {
      // WR-10: `?? 0` would POST to `/api/v4/projects/0/repository/branches` — an
      // unintended, possibly unauthorized project — instead of failing loudly.
      if (!activeGitlabProject || !gitlabBaseUrl || !gitlabToken) {
        throw new Error('GitLab project not configured');
      }
      if (!releaseBranchName || !defaultBranch) {
        throw new Error('Branch name or default branch unavailable');
      }
      return createBranch(
        gitlabBaseUrl,
        gitlabToken,
        activeGitlabProject,
        releaseBranchName,
        defaultBranch,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['gitlab-branch', activeGitlabProject, releaseBranchName],
      });
      queryClient.invalidateQueries({
        queryKey: ['gitlab-release-branches', activeGitlabProject],
      });
    },
  });

  // Ancestor-filtered, UNWINDOWED project milestones (D-06/D-07) — the create
  // dialog's input. It must stay uncapped: `findDuplicateMilestone` runs over
  // exactly this array, so slicing it here would shrink RELMS-04's duplicate
  // guard. The dialog caps only what it *renders*.
  const ownProjectMilestoneList = ownProjectMilestones(
    allProjectMilestones ?? [],
    activeGitlabProject ?? 0,
  );

  // Create the GitLab milestone carrying the Jira release date as due_date (D-04) —
  // resolveGitLabMatch matches by date, so a dateless milestone would be created
  // and would still render as unmatched. The milestone body carries only title
  // and due_date (D-04). No optimistic write, no rollback, no success notice
  // (D-15).
  //
  // CR-02: invalidate at PROJECT granularity, not the four-element windowed
  // key. TanStack Query invalidates by key prefix; `ReleasesTab` caches the
  // same 'gitlab-milestones' prefix under a DIFFERENT window (min..max of all
  // fix version dates ±7d) than this page's window (this version's date
  // ±7d), so a window-specific key here can never reach the list's cache
  // entry — the list keeps showing "No GitLab link" until its 5-minute
  // staleTime lapses. `['gitlab-milestones', activeGitlabProject]` covers
  // every window variant. D-05's "the windowed READ query key must stay
  // byte-identical" constraint applies only to the read query above (lines
  // 86-92) and is unaffected by this change.
  const createMilestoneMutation = useMutation({
    mutationFn: (title: string) => {
      // WR-10: `?? 0` would POST to `/api/v4/projects/0/milestones` and also
      // silently empties `ownProjectMilestones`, disabling duplicate detection
      // for every title.
      if (!activeGitlabProject || !gitlabBaseUrl || !gitlabToken) {
        throw new Error('GitLab project not configured');
      }
      if (!version?.releaseDate) throw new Error('Release date required');
      return createMilestone(gitlabBaseUrl, gitlabToken, activeGitlabProject, {
        title,
        due_date: version.releaseDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['gitlab-milestones', activeGitlabProject],
      });
      queryClient.invalidateQueries({
        queryKey: ['gitlab-branch', activeGitlabProject],
      });
    },
  });

  // Fetch Jira issues for this fix version
  const { data: fixVersionIssues, isLoading: isLoadingIssues } = useQuery({
    queryKey: ['jira-fixversion-issues', versionId, storyPointsFieldKey],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !versionId) throw new Error('No credentials');
      return fetchFixVersionIssues(jiraBaseUrl, token, versionId, storyPointsFieldKey);
    },
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!versionId,
  });

  // Channel A (DRIFT-01): the project's full MR universe, project-scoped only —
  // NO versionId in the key. The fetch itself doesn't depend on which release is
  // open, only the filter applied afterwards (below, via `selectChannelA`) does
  // (D-16, RESEARCH Pitfall 4). Deliberately a NEW key, never
  // `['gitlab-recent-project-mrs', activeGitlabProject]` — reusing the deleted
  // heuristic's key could serve a stale page-capped cache entry (Pitfall 5).
  const { data: allProjectMRs, isLoading: isLoadingChannelA } = useQuery({
    queryKey: ['gitlab-all-project-mrs', activeGitlabProject],
    queryFn: () =>
      fetchAllProjectMRs(gitlabBaseUrl ?? '', gitlabToken ?? '', activeGitlabProject ?? 0),
    staleTime: 5 * 60_000,
    enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken,
  });

  // Channel B (DRIFT-02): MRs for the matched GitLab milestone. Unchanged —
  // this key is a cross-component cache contract with ReleasesTab/UpcomingReleasesTimeline.
  const { data: milestoneMRs, isLoading: isLoadingChannelB } = useQuery({
    queryKey: ['gitlab-milestone-mrs', activeGitlabProject, gitlabMatch.candidateName],
    queryFn: () =>
      fetchMilestoneMRs(
        gitlabBaseUrl ?? '',
        gitlabToken ?? '',
        activeGitlabProject ?? 0,
        gitlabMatch.candidateName,
      ),
    staleTime: 5 * 60_000,
    enabled:
      !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && gitlabMatch.type !== 'none',
  });

  // Channel C (DRIFT-03): MRs targeting the derived release branch. Version-scoped
  // through `releaseBranchName`, matching the `gitlab-branch` query's key shape
  // (line above). D-18 degraded state: no matched milestone means no derivable
  // branch name means nothing to query — `releaseBranchName !== null` guards it.
  const { data: branchTargetedMRs, isLoading: isLoadingChannelC } = useQuery({
    queryKey: ['gitlab-branch-mrs', activeGitlabProject, releaseBranchName],
    queryFn: () =>
      fetchBranchTargetedMRs(
        gitlabBaseUrl ?? '',
        gitlabToken ?? '',
        activeGitlabProject ?? 0,
        releaseBranchName ?? '',
      ),
    staleTime: 5 * 60_000,
    enabled:
      !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && releaseBranchName !== null,
  });

  // Match MRs to Jira issues
  const releaseIssues = fixVersionIssues ?? [];
  const releaseMrs = milestoneMRs ?? [];
  const { matchedRows, unmatchedMRs } = matchIssuesToMRs(releaseIssues, releaseMrs);

  // GGX-WARN-01: Find tasks that have NO MR in the matched milestone ("Missing MR" case)
  // but DO have an MR elsewhere — i.e. on a different/absent milestone ("Wrong milestone").
  // Optimization: instead of one slow GitLab `search` request per missing task, fetch the
  // project's latest 100 MRs ONCE (fast list endpoint) and match every task locally. Only
  // runs when a milestone matched and there is at least one missing row. Trade-off: an MR
  // older than the latest 100 won't be found and the task stays "Missing MR".
  const missingRows = matchedRows.filter((r) => r.mr === null);
  const { data: recentProjectMRs } = useQuery({
    queryKey: ['gitlab-recent-project-mrs', activeGitlabProject],
    queryFn: () =>
      fetchRecentProjectMRs(gitlabBaseUrl ?? '', gitlabToken ?? '', activeGitlabProject ?? 0, 100),
    enabled:
      !!gitlabBaseUrl &&
      !!activeGitlabProject &&
      !!gitlabToken &&
      gitlabMatch.type !== 'none' &&
      missingRows.length > 0,
    staleTime: 5 * 60_000,
  });

  const wrongMilestoneByKey = buildWrongMilestoneMap(
    matchedMilestone,
    recentProjectMRs,
    missingRows,
  );

  // Three-channel drift detection (DRIFT-01/02/03/04): union the three channels,
  // filter Channel A's project-wide universe down to MRs linked to a fix-version
  // issue key, and build the deterministically-sorted drift row list.
  const fixVersionIssueKeys = new Set(releaseIssues.map((i) => i.key));
  const channelA = selectChannelA(allProjectMRs ?? [], fixVersionIssueKeys);
  const driftRows = buildDriftRows({
    channelA,
    channelB: milestoneMRs ?? [],
    channelC: branchTargetedMRs ?? [],
    releaseBranchName,
    matchedMilestoneId: matchedMilestone?.id ?? null,
    fixVersionIssueKeys,
  });
  const driftFlaggedCount = countFlaggedMRs(driftRows);
  const isLoadingDrift = isLoadingChannelA || isLoadingChannelB || isLoadingChannelC;
  const hasMatchedMilestone = matchedMilestone !== null;

  // Derived values from releaseSummaries.ts
  const labelSummary = computeLabelSummary(releaseMrs);
  const labelCoverage = computeLabelCoverage(releaseMrs);
  const mrStateCounts = computeMrStateCounts(releaseMrs);
  const issueStatusCounts = computeIssueStatusCounts(releaseIssues);
  const storyPoints = computeStoryPoints(releaseIssues, storyPointsFieldKey);
  const hasStoryPoints = computeHasStoryPoints(releaseIssues, storyPointsFieldKey);

  return {
    version,
    isLoading,
    issueCounts,
    milestones,
    milestoneWindow,
    gitlabMatch,
    matchedMilestone,
    branchState,
    refetchBranchCheck,
    releaseBranchName,
    defaultBranch,
    createBranchMutation,
    createMilestoneMutation,
    ownProjectMilestoneList,
    fixVersionIssues,
    isLoadingIssues,
    milestoneMRs,
    releaseIssues,
    releaseMrs,
    matchedRows,
    unmatchedMRs,
    missingRows,
    wrongMilestoneByKey,
    driftRows,
    driftFlaggedCount,
    isLoadingDrift,
    hasMatchedMilestone,
    labelSummary,
    labelCoverage,
    mrStateCounts,
    issueStatusCounts,
    storyPoints,
    hasStoryPoints,
    gitlabToken,
    jiraBaseUrl,
    activeJiraProject,
    gitlabBaseUrl,
    activeGitlabProject,
    storyPointsFieldKey,
  } as const;
}
