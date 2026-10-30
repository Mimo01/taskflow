/**
 * ReleaseDetailPage -- Full-page route-based release detail view at /release/:versionId.
 *
 * Full-width, single-scroll layout (D-07, D-13): fixed breadcrumb bar, then one
 * scroll wrapper holding header, done bar, graph grid (quad + side column) and
 * the unified task table.
 */

import { useQueryClient } from '@tanstack/react-query';
import { GitMerge, PackageOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { toLocalDateString } from '@/lib/local-date';
import { openExternal } from '@/lib/openExternal';
import { dateStamp, releaseHeaderPill } from '@/lib/release-agenda';
import { refreshReleaseDetail } from '@/lib/release-refresh';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { CreateBranchDialog } from './release-detail/CreateBranchDialog';
import { CreateMilestoneDialog } from './release-detail/CreateMilestoneDialog';
import { DeploymentPackageSection } from './release-detail/DeploymentPackageSection';
import { EditReleaseModal } from './release-detail/EditReleaseModal';
import { ReleaseAssigneeRows } from './release-detail/graphs/ReleaseAssigneeRows';
import { ReleaseBurnup } from './release-detail/graphs/ReleaseBurnup';
import { ReleaseMrDonut } from './release-detail/graphs/ReleaseMrDonut';
import { ReleaseStatusRows } from './release-detail/graphs/ReleaseStatusRows';
import { ReleaseTypeWaffle } from './release-detail/graphs/ReleaseTypeWaffle';
import { ReleaseDetailSkeleton } from './release-detail/ReleaseDetailSkeleton';
import { releaseFactItems } from './release-detail/ReleaseFacts';
import {
  ReleaseBreadcrumbHeader,
  ReleaseDetailHeader,
  ReleaseDoneBar,
} from './release-detail/ReleaseHeader';
import { deriveReleaseStatusRows } from './release-detail/releaseBuckets';
import { UnifiedTaskTable } from './release-detail/UnifiedTaskTable';
import { useEditRelease } from './release-detail/useEditRelease';
import { useReleaseDetail } from './release-detail/useReleaseDetail';

/** Container width from which the graphs form one band (like the AIO cycle stats block). */
const BAND_MIN_WIDTH = 1180;

// ---- Main Component ----

export default function ReleaseDetailPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();

  const { onOpenIssue } =
    useOutletContext<{ onOpenIssue?: (key: string) => void; [key: string]: unknown }>() ?? {};

  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);

  // `seedReleaseBreadcrumb` pushes this release's own entry before EITHER exit
  // path, including opening the peek panel — which never changes the pathname.
  // While we are still on this page that entry is self-referential, and the
  // header already renders the release name as its trailing static segment, so
  // leaving it in printed the name twice (and made Back navigate to the page
  // you were already on). Drop it here; it is always the tail entry, so the
  // indices of everything before it are unaffected.
  const displayTrail = trail.filter((e) => e.path !== `/release/${versionId}`);

  const queryClient = useQueryClient();

  // Pinned-release tab support (mirrors AioCycleDetailPage cycle pinning)
  const releaseKey = `REL-${versionId}`;
  const pinned = usePinnedTabsStore((s) => s.pinnedKeys.includes(releaseKey));
  const togglePin = usePinnedTabsStore((s) => s.togglePin);
  const removePin = usePinnedTabsStore((s) => s.removePin);
  const setPinnedReleaseMeta = usePinnedTabsStore((s) => s.setPinnedReleaseMeta);
  const clearReleaseMeta = usePinnedTabsStore((s) => s.clearReleaseMeta);

  // Single data-layer hook: 6 queries + gitlab token effect + derived values (D-07)
  const {
    version,
    isLoading,
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
    milestoneMRs,
    isLoadingIssues,
    releaseIssues,
    releaseMrs,
    primaryRows,
    secondaryRows,
    flaggedMrCount,
    brFlaggedCount,
    msFlaggedCount,
    isLoadingDrift,
    driftUnavailable,
    hasMatchedMilestone,
    milestonesFailed,
    labelSummary,
    labelCoverage,
    storyPoints,
    hasStoryPoints,
    gitlabToken,
    jiraBaseUrl,
    activeJiraProject,
    gitlabBaseUrl,
    activeGitlabProject,
    headerBreakdown,
    headerBreakdownLoading,
    headerBreakdownError,
    releasePackage,
    rmEnabled,
    rmLoading,
    rmError,
    fixVersionIssues,
    burnupAxis,
    burnupPoints,
    assigneeRows,
    typeRows,
    statusNameSummary,
    mrDonutCounts,
    issuesError,
    issuesUpdatedAt,
    gitlabConfigured,
  } = useReleaseDetail(versionId);

  // Edit-modal state, diff builders and combined save (D-07 style co-located hook)
  const {
    editing,
    editName,
    setEditName,
    editDate,
    setEditDate,
    editDescription,
    setEditDescription,
    editReleased,
    setEditReleased,
    editMilestoneTitle,
    setEditMilestoneTitle,
    editMilestoneDescription,
    setEditMilestoneDescription,
    jiraError,
    gitlabError,
    isSaving,
    isEditDirty,
    isMilestoneTitleInvalid,
    startEditing,
    cancelEditing,
    handleSave,
  } = useEditRelease({
    version,
    matchedMilestone,
    versionId,
    jiraBaseUrl,
    activeJiraProject,
    gitlabBaseUrl,
    activeGitlabProject,
    gitlabToken,
  });

  // Create-branch confirm dialog state (D-15/D-16 — dialog closes only on success)
  const [createBranchOpen, setCreateBranchOpen] = useState(false);

  // Create-milestone confirm dialog state (D-15/D-16 — dialog closes only on success)
  const [createMilestoneOpen, setCreateMilestoneOpen] = useState(false);

  const handleBack = () => {
    if (displayTrail.length > 0) {
      const target = displayTrail[displayTrail.length - 1];
      // Assign rather than pop(): a seeded self-entry may also be sitting on
      // the tail, and popping once would leave it behind.
      useBreadcrumbStore.setState({ trail: displayTrail.slice(0, -1) });
      navigate(target.path, { replace: true });
    } else {
      navigate('/releases');
    }
  };

  // Seed this release's own breadcrumb entry once, idempotently. Needed
  // before EITHER exit path — direct key click (openIssueFull below) or
  // opening the peek panel — because the peek's "Open full page" button
  // navigates via main.tsx's generic handleIssueClick, which appends onto
  // whatever the trail already contains rather than knowing the release
  // name itself. Without seeding here first, that generic handler falls
  // back to routeLabel()'s literal "Release" instead of the real name.
  const seedReleaseBreadcrumb = () => {
    if (!version) return;
    const currentTrail = useBreadcrumbStore.getState().trail;
    const last = currentTrail[currentTrail.length - 1];
    if (last?.path !== `/release/${versionId}`) {
      breadcrumbPush({ path: `/release/${versionId}`, label: version.name });
    }
  };

  // Full-page navigation to an issue, preserving the release-name breadcrumb.
  const openIssueFull = (issueKey: string) => {
    seedReleaseBreadcrumb();
    navigate(`/issue/${issueKey}`);
  };

  // Row-body click target: prefers the outlet-provided peek opener, falling
  // back to full-page navigation when none is wired (PEEK-05 pattern).
  const resolvedOnOpenIssue = onOpenIssue ?? openIssueFull;

  // Ticket-key click inside an Unmatched MR title: always forces full-page
  // navigation while preserving the release breadcrumb entry.
  const handleNavigateToIssueFromMR = (key: string) => {
    seedReleaseBreadcrumb();
    navigate(`/issue/${key}`);
  };

  const handleBreadcrumbClick = (index: number, path: string) => {
    useBreadcrumbStore.setState({ trail: displayTrail.slice(0, index) });
    navigate(path, { replace: true });
  };

  const jiraVersionUrl =
    jiraBaseUrl && activeJiraProject && versionId
      ? `${jiraBaseUrl.replace(/\/$/, '')}/projects/${activeJiraProject}/versions/${versionId}`
      : null;

  const handleOpenInJira = () => {
    if (jiraVersionUrl) {
      openExternal(jiraVersionUrl);
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (!versionId) return;
    setRefreshing(true);
    try {
      await refreshReleaseDetail(queryClient, {
        activeJiraProject,
        activeGitlabProject,
        versionId,
      });
    } finally {
      setRefreshing(false);
    }
  };
  const lastRefreshed = issuesUpdatedAt ? new Date(issuesUpdatedAt).toLocaleTimeString() : null;

  // Graph slot states: branch on data presence, not isPending (disabled v5
  // queries stay pending forever).
  const issueGraphState: 'loading' | 'error' | 'empty' | 'ready' =
    isLoadingIssues && !fixVersionIssues
      ? 'loading'
      : issuesError
        ? 'error'
        : releaseIssues.length === 0
          ? 'empty'
          : 'ready';
  const donutState: 'loading' | 'empty' | 'ready' =
    gitlabMatch.type === 'none' || (milestoneMRs && releaseMrs.length === 0)
      ? 'empty'
      : !milestoneMRs
        ? 'loading'
        : 'ready';

  // Band layout needs the page content width (not the window): measure the scroll
  // wrapper with a callback ref so it works whenever the wrapper mounts.
  const [pageEl, setPageEl] = useState<HTMLDivElement | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  useEffect(() => {
    if (!pageEl) return;
    setPageWidth(pageEl.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setPageWidth(w);
    });
    ro.observe(pageEl);
    return () => ro.disconnect();
  }, [pageEl]);
  const band = pageWidth >= BAND_MIN_WIDTH;

  const hasMilestone = gitlabConfigured && gitlabMatch.type !== 'none';
  // The MR donut needs a milestone with MRs; otherwise the slot shows issues by
  // status so it always carries information.
  const showDonut = hasMilestone && donutState !== 'empty';
  const statusRows = deriveReleaseStatusRows(releaseIssues);
  const today = toLocalDateString(new Date());
  const timelineSummary = {
    done: headerBreakdown?.done ?? 0,
    total: releaseIssues.length,
    today,
    releaseDate: version?.releaseDate ?? null,
    released: !!version?.released,
  };
  const noIssues = issueGraphState === 'empty';

  // Graph slots, built once and placed by the band or the 2x2 layout. `compact`
  // (band mode) shrinks rows, donut and squares and lets the burnup plot fill the
  // row height.
  const burnupEl = (
    <ReleaseBurnup
      axis={burnupAxis}
      points={burnupPoints}
      state={issueGraphState}
      showStoryPoints={hasStoryPoints}
      summary={timelineSummary}
      compact={band}
      className={band ? undefined : '@max-[640px]/page:col-span-full'}
    />
  );
  const mrSlotEl = showDonut ? (
    <ReleaseMrDonut
      counts={mrDonutCounts}
      state={donutState}
      labelCoverage={labelCoverage}
      labelSummary={labelSummary}
      compact={band}
    />
  ) : (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <ReleaseStatusRows
        rows={statusRows}
        state={issueGraphState}
        compact={band}
        className="flex-1"
      />
      {hasMilestone ? (
        <p
          data-testid="release-mrs-none"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <GitMerge className="size-3.5" aria-hidden="true" />
          No merge requests in this milestone yet
        </p>
      ) : null}
    </div>
  );
  const assigneeEl = (
    <ReleaseAssigneeRows
      rows={assigneeRows}
      state={issueGraphState}
      showStoryPoints={hasStoryPoints}
      compact={band}
      className={band ? undefined : '@max-[640px]/page:col-span-full @max-[640px]/page:order-4'}
    />
  );
  const typeEl = (
    <ReleaseTypeWaffle
      rows={typeRows}
      state={issueGraphState}
      showStoryPoints={hasStoryPoints}
      compact={band}
      className={undefined}
    />
  );

  if (!versionId) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Back + breadcrumb header */}
      <ReleaseBreadcrumbHeader
        trail={displayTrail}
        versionName={version?.name}
        onBack={handleBack}
        onBreadcrumbClick={handleBreadcrumbClick}
      />

      {/* Detail body */}
      {isLoading || !version ? (
        <ReleaseDetailSkeleton />
      ) : (
        <div
          ref={setPageEl}
          data-testid="release-detail-scroll"
          className="@container/page min-h-0 flex-1 overflow-auto [--release-sticky-top:0px] [&_[role=button]]:cursor-pointer [&_a[href]]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer"
        >
          {/* Header: owns the done figure (D-14) and the page actions */}
          <ReleaseDetailHeader
            name={version.name}
            pill={releaseHeaderPill(version, toLocalDateString(new Date()))}
            releaseDate={version.releaseDate}
            showPackage={rmEnabled}
            pkg={releasePackage}
            pkgLoading={rmLoading}
            pkgError={rmError}
            factItems={releaseFactItems({
              version,
              gitlabConfigured,
              gitlabMatch,
              matchedMilestone,
              branchState,
              mergeBackVerdict,
              defaultBranch,
              onCreateBranch: () => {
                createBranchMutation.reset();
                setCreateBranchOpen(true);
              },
              onRetryBranchCheck: refetchBranchCheck,
              onCreateMilestone: () => {
                createMilestoneMutation.reset();
                setCreateMilestoneOpen(true);
              },
              // CR-06: with the milestone list unfetched, CreateMilestoneDialog's
              // duplicate guard runs over an empty array and passes for every
              // title — offer the action only once we know what exists.
              canCreateMilestone: !!version.releaseDate && !milestonesFailed,
              hasStoryPoints,
              storyPoints,
            })}
            jiraDescription={version.description}
            milestoneDescription={
              gitlabMatch.type !== 'none' ? (matchedMilestone?.description ?? null) : null
            }
            lastRefreshed={lastRefreshed}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            pinned={pinned}
            onTogglePin={() => {
              if (pinned) {
                removePin(releaseKey);
                clearReleaseMeta(releaseKey);
              } else {
                togglePin(releaseKey);
                setPinnedReleaseMeta(releaseKey, {
                  name: version.name,
                  versionId: versionId ?? '',
                  projectKey: activeJiraProject ?? '',
                });
              }
            }}
            onEdit={startEditing}
            jiraVersionUrl={jiraVersionUrl}
            onOpenInJira={handleOpenInJira}
          />
          {noIssues ? null : (
            <ReleaseDoneBar
              breakdown={headerBreakdown}
              loading={headerBreakdownLoading}
              error={headerBreakdownError}
              statusNames={statusNameSummary}
            />
          )}

          {noIssues ? (
            <div
              data-testid="release-no-issues"
              className="flex flex-col items-center gap-2 px-6 py-16 text-center"
            >
              <PackageOpen className="size-8 text-muted-foreground/60" aria-hidden="true" />
              <p className="text-sm font-semibold">No issues in this fix version yet</p>
              <p className="max-w-[48ch] text-xs text-muted-foreground">
                {version.releaseDate && !version.released
                  ? `Planned for ${dateStamp(version.releaseDate).inline}. Graphs and the task list appear once issues are added to the fix version in Jira.`
                  : 'Graphs and the task list appear once issues are added to the fix version in Jira.'}
              </p>
            </div>
          ) : (
            <>
              {/* Graph section. Wide containers: ONE band like the AIO cycle stats block
                  (burnup fills the row height set by the lists, then MRs/status, type,
                  assignee). Narrower: 2x2, then single column. Labels and package
                  mismatches fold under it. */}
              {band ? (
                <div
                  data-testid="release-graph-grid"
                  className="grid grid-cols-[minmax(260px,1.5fr)_auto_minmax(210px,1.1fr)_minmax(230px,1fr)] items-stretch gap-x-6 px-6 pt-5"
                >
                  {burnupEl}
                  <div className="flex min-w-0 flex-col">{mrSlotEl}</div>
                  <div className="flex min-w-0 flex-col">{typeEl}</div>
                  <div className="flex min-w-0 flex-col">{assigneeEl}</div>
                </div>
              ) : (
                <div
                  data-testid="release-graph-grid"
                  className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-8 gap-y-7 px-6 pt-5 @max-[640px]/page:grid-cols-2 @max-[640px]/page:gap-6 @max-[440px]/page:grid-cols-1"
                >
                  {burnupEl}
                  {mrSlotEl}
                  {assigneeEl}
                  {typeEl}
                </div>
              )}
              {/* Package mismatches as a full-width action list (renders nothing
                  when empty). */}
              {/* Stories whose fix version and Deployment package disagree (quick
                  261014-eym). Renders nothing without an RM project. */}
              <DeploymentPackageSection
                stories={releaseIssues}
                version={version}
                jiraBaseUrl={jiraBaseUrl}
                activeJiraProject={activeJiraProject}
                onOpenIssue={resolvedOnOpenIssue}
              />

              {/* Unified task table (criterion 1): one Jira-task-keyed table with
                  every associated MR inline underneath, plus a conditional
                  secondary table for MRs no task covers. `key` remounts the
                  table when the release changes — navigating to an
                  already-cached release skips the skeleton branch above, so
                  nothing else would remount it, and the per-cell fix state
                  (`useMrFixMutation`'s local `status`/`errorMessage`) would
                  otherwise carry over from the previous release. */}
              <div className="px-6 pt-6 pb-6">
                <UnifiedTaskTable
                  key={versionId}
                  versionName={version.name}
                  hasReleaseDate={!!version.releaseDate}
                  isLoadingIssues={isLoadingIssues}
                  isLoadingDrift={isLoadingDrift}
                  driftUnavailable={driftUnavailable}
                  hasMatchedMilestone={hasMatchedMilestone}
                  milestoneLookupFailed={milestonesFailed}
                  primaryRows={primaryRows}
                  secondaryRows={secondaryRows}
                  flaggedMrCount={flaggedMrCount}
                  brFlaggedCount={brFlaggedCount}
                  msFlaggedCount={msFlaggedCount}
                  onOpenIssue={resolvedOnOpenIssue}
                  onOpenIssueFull={openIssueFull}
                  onSeedBreadcrumb={seedReleaseBreadcrumb}
                  onNavigateToIssueFromMR={handleNavigateToIssueFromMR}
                  fix={{
                    projectId: activeGitlabProject ?? null,
                    baseUrl: gitlabBaseUrl ?? null,
                    token: gitlabToken,
                    releaseBranchName,
                    releaseBranchExists: branchState.kind === 'exists',
                    matchedMilestone: matchedMilestone
                      ? { id: matchedMilestone.id, title: matchedMilestone.title }
                      : null,
                  }}
                />
              </div>
            </>
          )}

          {/* Edit modal */}
          <EditReleaseModal
            open={editing}
            onOpenChange={(o) => {
              if (!o) cancelEditing();
            }}
            editName={editName}
            setEditName={setEditName}
            editDate={editDate}
            setEditDate={setEditDate}
            editDescription={editDescription}
            setEditDescription={setEditDescription}
            editReleased={editReleased}
            setEditReleased={setEditReleased}
            editMilestoneTitle={editMilestoneTitle}
            setEditMilestoneTitle={setEditMilestoneTitle}
            editMilestoneDescription={editMilestoneDescription}
            setEditMilestoneDescription={setEditMilestoneDescription}
            isSaving={isSaving}
            jiraError={jiraError}
            gitlabError={gitlabError}
            showMilestoneSection={gitlabMatch.type !== 'none' && !!matchedMilestone}
            isSaveDisabled={isSaving || !editName.trim() || !isEditDirty || isMilestoneTitleInvalid}
            onCancel={cancelEditing}
            onSave={handleSave}
          />

          {/* Create-branch confirm dialog — closes only on success (D-15/D-16) */}
          <CreateBranchDialog
            open={createBranchOpen}
            onOpenChange={setCreateBranchOpen}
            branchName={releaseBranchName ?? ''}
            defaultBranch={defaultBranch ?? ''}
            isPending={createBranchMutation.isPending}
            errorMessage={
              createBranchMutation.error instanceof Error
                ? createBranchMutation.error.message
                : null
            }
            onConfirm={() =>
              createBranchMutation.mutate(undefined, {
                onSuccess: () => setCreateBranchOpen(false),
              })
            }
          />

          {/* Create-milestone confirm dialog — closes only on success (D-15/D-16) */}
          <CreateMilestoneDialog
            open={createMilestoneOpen}
            onOpenChange={setCreateMilestoneOpen}
            releaseDate={version.releaseDate ?? null}
            recentMilestones={ownProjectMilestoneList}
            versionName={version.name}
            activeGitlabProject={activeGitlabProject}
            isPending={createMilestoneMutation.isPending}
            errorMessage={
              createMilestoneMutation.error instanceof Error
                ? createMilestoneMutation.error.message
                : null
            }
            onConfirm={(title) =>
              createMilestoneMutation.mutate(title, {
                onSuccess: () => setCreateMilestoneOpen(false),
              })
            }
          />
        </div>
      )}
    </div>
  );
}
