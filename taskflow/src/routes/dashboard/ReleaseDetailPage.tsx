/**
 * ReleaseDetailPage -- Full-page route-based release detail view at /release/:versionId.
 *
 * Full-width, single-scroll layout (D-07, D-13): fixed breadcrumb bar, then one
 * scroll wrapper holding header, done bar, graph grid (quad + side column) and
 * the unified task table.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { toLocalDateString } from '@/lib/local-date';
import { openExternal } from '@/lib/openExternal';
import { releaseHeaderPill } from '@/lib/release-agenda';
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
import { ReleaseTypeWaffle } from './release-detail/graphs/ReleaseTypeWaffle';
import { LabelSummarySection } from './release-detail/LabelSummarySection';
import { ReleaseDetailSkeleton } from './release-detail/ReleaseDetailSkeleton';
import { releaseFactItems } from './release-detail/ReleaseFacts';
import {
  ReleaseBreadcrumbHeader,
  ReleaseDetailHeader,
  ReleaseDoneBar,
} from './release-detail/ReleaseHeader';
import { UnifiedTaskTable } from './release-detail/UnifiedTaskTable';
import { useEditRelease } from './release-detail/useEditRelease';
import { useReleaseDetail } from './release-detail/useReleaseDetail';

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
  const lastRefreshed = issuesUpdatedAt
    ? `Refreshed: ${new Date(issuesUpdatedAt).toLocaleTimeString()}`
    : null;

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
          data-testid="release-detail-scroll"
          className="@container/page min-h-0 flex-1 overflow-auto [--release-sticky-top:0px]"
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
              milestoneMRsLoaded: !!milestoneMRs,
              labelCoverage,
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
          <ReleaseDoneBar
            breakdown={headerBreakdown}
            loading={headerBreakdownLoading}
            error={headerBreakdownError}
            statusNames={statusNameSummary}
          />

          {/* Graph grid: quad (burnup, MRs, assignees, types) + side column */}
          <div
            data-testid="release-graph-grid"
            className="grid grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-8 px-6 pt-6 @max-[980px]/page:grid-cols-1 has-[>aside:empty]:grid-cols-1"
          >
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-8 gap-y-7 @max-[640px]/page:grid-cols-2 @max-[640px]/page:gap-6 @max-[440px]/page:grid-cols-1">
              <ReleaseBurnup
                axis={burnupAxis}
                points={burnupPoints}
                state={issueGraphState}
                showStoryPoints={hasStoryPoints}
                className={gitlabConfigured ? '@max-[640px]/page:col-span-full' : 'col-span-full'}
              />
              {gitlabConfigured && <ReleaseMrDonut counts={mrDonutCounts} state={donutState} />}
              <ReleaseAssigneeRows
                rows={assigneeRows}
                state={issueGraphState}
                showStoryPoints={hasStoryPoints}
                className="@max-[640px]/page:col-span-full @max-[640px]/page:order-4"
              />
              <ReleaseTypeWaffle
                rows={typeRows}
                state={issueGraphState}
                showStoryPoints={hasStoryPoints}
              />
            </div>
            <aside className="flex flex-col gap-6 border-l pl-8 empty:hidden @max-[980px]/page:border-l-0 @max-[980px]/page:pl-0 @max-[980px]/page:border-t @max-[980px]/page:pt-6">
              <LabelSummarySection
                milestoneMRsLoaded={!!milestoneMRs}
                labelSummary={labelSummary}
              />
              {/* Stories whose fix version and Deployment package disagree (quick
                      261014-eym). Renders nothing without an RM project. */}
              <DeploymentPackageSection
                stories={releaseIssues}
                version={version}
                jiraBaseUrl={jiraBaseUrl}
                activeJiraProject={activeJiraProject}
                onOpenIssue={resolvedOnOpenIssue}
              />
            </aside>
          </div>

          {/* Unified task table (criterion 1): one Jira-task-keyed table with
                  every associated MR inline underneath, plus a conditional
                  secondary table for MRs no task covers. `key` remounts the
                  table when the release changes — navigating to an
                  already-cached release skips the skeleton branch above, so
                  nothing else would remount it, and the per-cell fix state
                  (`useMrFixMutation`'s local `status`/`errorMessage`) would
                  otherwise carry over from the previous release. */}
          <div className="px-6 pt-8 pb-6">
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
