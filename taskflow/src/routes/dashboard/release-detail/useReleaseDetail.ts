import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  compareRefs,
  createBranch,
  createMilestone,
  fetchAllProjectMRs,
  fetchBranch,
  fetchBranchTargetedMRs,
  fetchMilestoneMRs,
  fetchProject,
  fetchProjectMilestones,
  fetchSourceBranchMRs,
  filterMilestonesToRange,
  searchProjectTags,
} from '@/services/gitlab';
import { fetchFixVersionIssues, fetchFixVersions, fetchVersionIssueCounts } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import {
  buildDriftRows,
  buildIssueMrIndex,
  countFlaggedMRs,
  selectChannelA,
  unionMRs,
} from './driftDetection';
import type { MergeBackVerdict } from './mergeBackVerification';
import { resolveMergeBackVerdict } from './mergeBackVerification';
// WR-06: the three channel query keys are declared once, in mrChannelKeys.ts,
// because useMrFixMutation patches and invalidates them by prefix — inline
// literals here would let a rename silently disable every optimistic patch.
import { mrChannelKeys } from './mrChannelKeys';
import type { TagChannelHealth } from './releaseBranch';
import {
  deriveReleaseBranchName,
  extractVersionFromMilestoneTitle,
  findReleaseTag,
  resolveBranchState,
} from './releaseBranch';
import { ownProjectMilestones } from './releaseMilestone';
import {
  computeHasStoryPoints,
  computeIssueStatusCounts,
  computeLabelCoverage,
  computeLabelSummary,
  computeMilestoneWindow,
  computeMrStateCounts,
  computeStoryPoints,
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
  const fixVersionsEnabled = !!jiraBaseUrl && !!activeJiraProject;
  const {
    data: fixVersions,
    isLoading,
    isFetched: fixVersionsFetched,
  } = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !activeJiraProject) throw new Error('No credentials');
      return fetchFixVersions(jiraBaseUrl, token, activeJiraProject);
    },
    staleTime: 5 * 60_000,
    enabled: fixVersionsEnabled,
  });

  // Channel A's window is DERIVED from `fixVersions`, so firing Channel A before
  // that query settles runs the expensive fetch twice: once against the 12-month
  // default while `fixVersions` is undefined, then again under a different window
  // (= a different query key) once it resolves. Each run is the ~42-page/~15MB
  // fetch the windowing exists to avoid. `isFetched` covers success AND error, so
  // a Jira failure still falls through to the default window and fetches once.
  // When the versions query is disabled outright (no Jira configured) there is
  // nothing to wait for — otherwise Channel A would never run at all.
  const fixVersionsSettled = !fixVersionsEnabled || fixVersionsFetched;

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
  const { data: project, isError: defaultBranchCheckFailed } = useQuery({
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
  // D-01 (91-RESEARCH Pitfall 4): the tag is now needed whenever a version is
  // released, independent of branch state, because D-01's content-comparison
  // fallback (used by the merge-back verdict below) triggers whenever no
  // merged tracking MR is found — determined independently of (and often
  // before) the branch-existence check. A released version whose branch
  // still exists therefore also fires this query; that redundant fetch is
  // accepted because it is a single search-scoped call. `searchProjectTags`
  // now rejects on failure (91-07) so the tag channel surfaces `isError`
  // like the other three channels; the branch row now receives `tagChannel`
  // so it can distinguish pending/failed from a resolved absence, and a tag
  // outage still does not change the row's `kind` — only the tooltip's
  // wording (91-VERIFICATION truth 6).
  const needsTagLookup = releasedVersion && !!matchedVersionNumber;

  const { data: releaseTags, isError: tagCheckFailed } = useQuery({
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

  // 91-VERIFICATION truth 5: derived from `needsTagLookup` rather than React
  // Query's `isPending`/`isLoading`, both of which are also true for a
  // DISABLED query — that would pin the row at Loading forever for the case
  // where `matchedVersionNumber` is null and `needsTagLookup` is false (the
  // exact CR-03 defect class this phase already fixed twice). A tag query
  // that will never run is therefore explicitly NOT pending.
  const tagLookupPending = needsTagLookup && releaseTags === undefined && !tagCheckFailed;

  // Both the branch row (below) and the merge-back verdict (further below)
  // read the same resolved tag — resolve `findReleaseTag` once here rather
  // than calling it twice.
  const mergeBackTagName = findReleaseTag(
    (releaseTags ?? []).map((t) => t.name),
    matchedVersionNumber,
  );

  // 91-VERIFICATION truth 6 / 91-REVIEW CR-01: `tagLookupPending` and
  // `tagCheckFailed` already existed in scope and were already threaded into
  // the sibling `resolveMergeBackVerdict` call below, but not into this one,
  // so a `null` `mergeBackTagName` was indistinguishable across three
  // structurally different situations and the branch row asserted an
  // unverified negative. Failed is tested before pending, matching
  // `mergeBackVerification.ts` step 4.5's precedence.
  const tagChannel: TagChannelHealth = tagCheckFailed
    ? 'failed'
    : tagLookupPending
      ? 'pending'
      : 'resolved';

  const branchState = resolveBranchState({
    hasMatchedMilestone: matchedMilestone !== null,
    milestoneTitle: matchedMilestone?.title ?? null,
    branchExists: branchResult?.exists,
    branchCheckFailed,
    versionReleased: releasedVersion,
    releaseTagName: mergeBackTagName,
    tagChannel,
  });

  // Merge-back verdict (MERGE-01/02) — tracking-MR lookup, gated on
  // `releasedVersion` (D-05: an unreleased version must fire ZERO extra
  // GitLab calls). The `?? ''`/`?? 0` fallbacks are only safe because
  // `enabled` independently gates on
  // `!!activeGitlabProject && !!gitlabToken && !!gitlabBaseUrl` (WR-10).
  const { data: trackingMRs, isError: trackingMRsCheckFailed } = useQuery({
    queryKey: ['gitlab-mr-source-branch', activeGitlabProject, releaseBranchName],
    queryFn: () =>
      fetchSourceBranchMRs(
        gitlabBaseUrl ?? '',
        gitlabToken ?? '',
        activeGitlabProject ?? 0,
        releaseBranchName ?? '',
      ),
    enabled:
      !!gitlabBaseUrl &&
      !!activeGitlabProject &&
      !!gitlabToken &&
      releasedVersion &&
      releaseBranchName !== null,
    staleTime: 5 * 60_000,
  });

  // Content-comparison fallback. Per 91-RESEARCH Pitfall 3, the `enabled`
  // gate depends on the tag query's RESOLVED result (`mergeBackTagName !==
  // null`), not merely on `needsTagLookup` — otherwise this query fires with
  // an empty `to` ref or never fires at all.
  const { data: compareResult, isError: compareCheckFailed } = useQuery({
    queryKey: ['gitlab-compare', activeGitlabProject, defaultBranch, mergeBackTagName],
    queryFn: () =>
      compareRefs(
        gitlabBaseUrl ?? '',
        gitlabToken ?? '',
        activeGitlabProject ?? 0,
        defaultBranch ?? '',
        mergeBackTagName ?? '',
      ),
    enabled:
      !!gitlabBaseUrl &&
      !!activeGitlabProject &&
      !!gitlabToken &&
      releasedVersion &&
      defaultBranch !== null &&
      mergeBackTagName !== null,
    staleTime: 5 * 60_000,
  });

  // CR-03: the tracking-MR query's `enabled` gate above includes
  // `releaseBranchName !== null`, so an unparseable milestone title (which
  // makes `deriveReleaseBranchName` return `null`) leaves `trackingMRs`
  // permanently `undefined` with `isError` permanently `false` — the query
  // never runs and never will. That state is indistinguishable from
  // in-flight without this signal, the same defect class `releaseBranch.ts`'s
  // `unresolvable` kind already models for the branch row.
  const trackingMRsUnavailable = releasedVersion && releaseBranchName === null;

  const mergeBackVerdict: MergeBackVerdict = resolveMergeBackVerdict({
    releasedVersion,
    hasMatchedMilestone: matchedMilestone !== null,
    defaultBranch,
    defaultBranchCheckFailed,
    trackingMRs,
    trackingMRsCheckFailed,
    trackingMRsUnavailable,
    tagName: mergeBackTagName,
    tagLookupPending,
    tagCheckFailed,
    expectedTagName: matchedVersionNumber ? `v${matchedVersionNumber}` : null,
    compareResult,
    compareCheckFailed,
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

  // Channel A's lookback window, derived from the releases the app actually
  // shows rather than a hardcoded constant. Unbounded, this fetch is ~4200 MRs /
  // 42 pages / ~15MB on a mature project, and the GitLab instance is
  // throughput-limited (measured: 5-, 12- and 20-way parallelism all land at
  // ~8s), so the only lever that moves is fetching less.
  //
  // Derived from `fixVersions` — a PROJECT-level query whose value is identical
  // for every release in the project, so the Channel A key stays release-
  // independent and the D-16 cache contract holds.
  const channelAUpdatedAfter = useMemo(() => {
    const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    // Buffer: MR work starts well before the release date it lands in.
    const BUFFER_MONTHS = 6;
    // Cap: one stale never-released version must not drag the window back to
    // "all history" and reintroduce the 8s fetch.
    const MAX_LOOKBACK_MONTHS = 24;
    const DEFAULT_LOOKBACK_MONTHS = 12;

    const openReleaseDates = (fixVersions ?? [])
      .filter((v) => !v.released && v.releaseDate)
      .map((v) => Date.parse(`${v.releaseDate}T00:00:00Z`))
      .filter((t) => Number.isFinite(t));

    const earliest =
      openReleaseDates.length > 0
        ? Math.min(...openReleaseDates) - BUFFER_MONTHS * MONTH_MS
        : now - DEFAULT_LOOKBACK_MONTHS * MONTH_MS;

    const floorTs = now - MAX_LOOKBACK_MONTHS * MONTH_MS;
    const windowStart = new Date(Math.max(earliest, floorTs));
    // Floor to the start of the month so the value — and therefore the query
    // key — is stable across renders and across the day.
    return new Date(
      Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), 1),
    ).toISOString();
  }, [fixVersions]);

  // Channel A (DRIFT-01): the project's MR universe within `channelAUpdatedAfter`,
  // project-scoped only — NO versionId in the key. The fetch itself doesn't
  // depend on which release is open, only the filter applied afterwards (below,
  // via `selectChannelA`) does (D-16, RESEARCH Pitfall 4). Deliberately a NEW
  // key, never `['gitlab-recent-project-mrs', activeGitlabProject]` — reusing
  // the deleted heuristic's key could serve a stale page-capped cache entry
  // (Pitfall 5). The window IS in the key: a different window is different data,
  // and serving a narrower cached result for a wider window would under-report
  // drift.
  const { data: allProjectMRs, isLoading: isLoadingChannelA } = useQuery({
    queryKey: mrChannelKeys.allProject(activeGitlabProject, channelAUpdatedAfter),
    queryFn: () =>
      fetchAllProjectMRs(
        gitlabBaseUrl ?? '',
        gitlabToken ?? '',
        activeGitlabProject ?? 0,
        channelAUpdatedAfter,
      ),
    staleTime: 5 * 60_000,
    enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && fixVersionsSettled,
  });

  // Channel B (DRIFT-02): MRs for the matched GitLab milestone. Unchanged —
  // this key is a cross-component cache contract with ReleasesTab/UpcomingReleasesTimeline.
  const { data: milestoneMRs, isLoading: isLoadingChannelB } = useQuery({
    queryKey: mrChannelKeys.milestone(activeGitlabProject, gitlabMatch.candidateName),
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
    queryKey: mrChannelKeys.branch(activeGitlabProject, releaseBranchName),
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

  const releaseIssues = fixVersionIssues ?? [];
  const releaseMrs = milestoneMRs ?? [];

  // Three-channel drift detection (DRIFT-01/02/03/04): union the three channels,
  // filter Channel A's project-wide universe down to MRs linked to a fix-version
  // issue key, and build the deterministically-sorted drift row list.
  const fixVersionIssueKeys = new Set(releaseIssues.map((i) => i.key));
  const channelA = selectChannelA(allProjectMRs ?? [], fixVersionIssueKeys);

  // D-05: the three-channel union supersedes the old capped recent-MR
  // "wrong milestone" heuristic — an MR older than the latest 100 is no
  // longer silently missed. This is the same union `buildDriftRows` below re-derives
  // internally; the second, cheap union avoids threading a prebuilt map
  // through `buildDriftRows`'s three-array signature.
  const union = unionMRs(channelA, releaseMrs, branchTargetedMRs ?? []);

  const { matchedRows, wrongMilestoneByKey } = buildIssueMrIndex(
    union,
    releaseIssues,
    matchedMilestone?.id ?? null,
  );

  const driftRows = buildDriftRows({
    channelA,
    channelB: releaseMrs,
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
    mergeBackVerdict,
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
