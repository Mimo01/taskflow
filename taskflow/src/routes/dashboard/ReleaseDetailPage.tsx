/**
 * ReleaseDetailPage -- Full-page route-based release detail view at /release/:versionId.
 *
 * Two-column layout mirroring MergeRequestDetailPage: left column shows release
 * name, status, description, and issue counts; right sidebar shows metadata
 * with inline editing capabilities.
 */

import { Dialog } from '@base-ui/react/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Check, ExternalLink, Loader2, Pin, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useResizable } from '@/hooks/useResizable';
import { updateMilestone } from '@/services/gitlab';
import { updateFixVersion } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { useSettingsStore } from '@/stores/settings.store';
import { DescriptionsSection } from './release-detail/DescriptionsSection';
import { IssuesSection } from './release-detail/IssuesSection';
import { LabelSummarySection } from './release-detail/LabelSummarySection';
import { ReleaseDetailSidebar } from './release-detail/ReleaseDetailSidebar';
import { ReleaseDetailSkeleton } from './release-detail/ReleaseDetailSkeleton';
import { ReleaseBreadcrumbHeader, ReleaseTitleHeading } from './release-detail/ReleaseHeader';
import { useReleaseDetail } from './release-detail/useReleaseDetail';

// ---- Main Component ----

export default function ReleaseDetailPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { onOpenIssue } =
    useOutletContext<{ onOpenIssue?: (key: string) => void; [key: string]: unknown }>() ?? {};

  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop);

  const releaseDetailPanelWidth = useSettingsStore((s) => s.releaseDetailPanelWidth);
  const setReleaseDetailPanelWidth = useSettingsStore((s) => s.setReleaseDetailPanelWidth);

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
    issueCounts,
    gitlabMatch,
    matchedMilestone,
    milestoneMRs,
    isLoadingIssues,
    releaseIssues,
    releaseMrs,
    matchedRows,
    unmatchedMRs,
    wrongMilestoneByKey,
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
  } = useReleaseDetail(versionId);

  // Drag-to-resize for right panel
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, isDragging, handleMouseDown } = useResizable({
    initialWidth: releaseDetailPanelWidth,
    min: 240,
    max: () => (containerRef.current?.offsetWidth ?? 800) * 0.5,
    onCommit: setReleaseDetailPanelWidth,
    direction: 'left',
  });
  const [handleHovered, setHandleHovered] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReleased, setEditReleased] = useState(false);
  const [editMilestoneTitle, setEditMilestoneTitle] = useState('');
  const [editMilestoneDescription, setEditMilestoneDescription] = useState('');
  // Per-source save errors (partial-failure handling). Jira and GitLab fail independently.
  const [jiraError, setJiraError] = useState<string | null>(null);
  const [gitlabError, setGitlabError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Populate edit form when entering edit mode (seeds both Jira + GitLab fields)
  const startEditing = () => {
    if (!version) return;
    setEditName(version.name);
    setEditDate(version.releaseDate ?? '');
    setEditDescription(version.description ?? '');
    setEditReleased(version.released);
    setEditMilestoneTitle(matchedMilestone?.title ?? '');
    setEditMilestoneDescription(matchedMilestone?.description ?? '');
    setJiraError(null);
    setGitlabError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setJiraError(null);
    setGitlabError(null);
  };

  // Compute the changed Jira fields (only what differs from the current version).
  const buildJiraDiff = () => {
    const fields: {
      name?: string;
      releaseDate?: string | null;
      description?: string;
      released?: boolean;
    } = {};
    if (editName !== version?.name) fields.name = editName;
    if (editDate !== (version?.releaseDate ?? '')) {
      fields.releaseDate = editDate || null;
    }
    if (editDescription !== (version?.description ?? '')) fields.description = editDescription;
    if (editReleased !== version?.released) fields.released = editReleased;
    return fields;
  };

  // Compute the changed GitLab milestone fields (title/description only).
  const buildGitlabDiff = () => {
    const fields: { title?: string; description?: string } = {};
    if (!matchedMilestone) return fields;
    if (editMilestoneTitle !== matchedMilestone.title) fields.title = editMilestoneTitle;
    if (editMilestoneDescription !== (matchedMilestone.description ?? '')) {
      fields.description = editMilestoneDescription;
    }
    return fields;
  };

  // Save is enabled only when at least one field across either source changed.
  const isEditDirty =
    Object.keys(buildJiraDiff()).length > 0 || Object.keys(buildGitlabDiff()).length > 0;

  // GitLab rejects an empty milestone title (400). Block the save when a matched
  // milestone's title has been cleared, mirroring the required Jira name guard.
  const isMilestoneTitleInvalid = !!matchedMilestone && editMilestoneTitle.trim() === '';

  // Combined save: writes Jira + GitLab via Promise.allSettled, sending only
  // changed fields per source. Partial failure keeps the modal open with a
  // per-source error; the succeeded side is NOT rolled back.
  const handleSave = async () => {
    const jiraFields = buildJiraDiff();
    const gitlabFields = buildGitlabDiff();
    const hasJiraChanges = Object.keys(jiraFields).length > 0;
    const hasGitlabChanges = Object.keys(gitlabFields).length > 0;

    // Nothing changed — just close.
    if (!hasJiraChanges && !hasGitlabChanges) {
      setEditing(false);
      return;
    }

    setIsSaving(true);
    setJiraError(null);
    setGitlabError(null);

    const jiraPromise = hasJiraChanges
      ? (async () => {
          const token = await readSecret('jira-pat').catch(() => null);
          if (!token || !jiraBaseUrl || !versionId) throw new Error('No credentials');
          return updateFixVersion(jiraBaseUrl, token, versionId, jiraFields);
        })()
      : null;

    const gitlabPromise =
      hasGitlabChanges && matchedMilestone
        ? updateMilestone(
            gitlabBaseUrl ?? '',
            gitlabToken ?? '',
            activeGitlabProject ?? 0,
            matchedMilestone.id,
            gitlabFields,
          )
        : null;

    const [jiraResult, gitlabResult] = await Promise.allSettled([
      jiraPromise ?? Promise.resolve(null),
      gitlabPromise ?? Promise.resolve(null),
    ]);

    let anyFailed = false;

    if (jiraPromise && jiraResult.status === 'rejected') {
      anyFailed = true;
      setJiraError((jiraResult.reason as Error)?.message ?? 'Failed to update Jira');
    }
    if (gitlabPromise && gitlabResult.status === 'rejected') {
      anyFailed = true;
      setGitlabError(
        (gitlabResult.reason as Error)?.message ?? 'Failed to update GitLab milestone',
      );
    }

    // Invalidate caches for whichever side succeeded.
    if (jiraPromise && jiraResult.status === 'fulfilled') {
      queryClient.invalidateQueries({ queryKey: ['jira-fix-versions', activeJiraProject] });
      queryClient.invalidateQueries({ queryKey: ['jira-version-counts', versionId] });
    }
    if (gitlabPromise && gitlabResult.status === 'fulfilled') {
      queryClient.invalidateQueries({ queryKey: ['gitlab-milestones', activeGitlabProject] });
      // The milestone-MR query is keyed on the milestone title — invalidate it
      // too so a title rename doesn't leave the MR list/labels querying the old
      // title.
      queryClient.invalidateQueries({ queryKey: ['gitlab-milestone-mrs', activeGitlabProject] });
    }

    setIsSaving(false);

    // Full success closes the modal; any failure keeps it open with per-source error.
    if (!anyFailed) {
      setEditing(false);
    }
  };

  const handleBack = () => {
    if (trail.length > 0) {
      const target = trail[trail.length - 1];
      breadcrumbPop();
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
    if (version) {
      breadcrumbPush({ path: `/release/${versionId}`, label: version.name });
    }
    navigate(`/issue/${key}`);
  };

  const handleBreadcrumbClick = (index: number, path: string) => {
    useBreadcrumbStore.setState({ trail: trail.slice(0, index) });
    navigate(path, { replace: true });
  };

  const handleOpenInJira = () => {
    if (jiraBaseUrl && activeJiraProject && versionId) {
      const base = jiraBaseUrl.replace(/\/$/, '');
      openUrl(`${base}/projects/${activeJiraProject}/versions/${versionId}`);
    }
  };

  if (!versionId) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back + breadcrumb header */}
      <ReleaseBreadcrumbHeader
        trail={trail}
        versionName={version?.name}
        onBack={handleBack}
        onBreadcrumbClick={handleBreadcrumbClick}
      />

      {/* Detail body */}
      {isLoading || !version ? (
        <ReleaseDetailSkeleton />
      ) : (
        <div ref={containerRef} className="flex flex-1 overflow-hidden">
          {/* Left column */}
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <ReleaseTitleHeading versionId={version.id} versionName={version.name} />

              {/* Description(s) — when a GitLab milestone is matched but neither
                  side has text, collapse the two empty blocks into one. */}
              <DescriptionsSection
                gitlabMatchType={gitlabMatch.type}
                matchedMilestone={matchedMilestone}
                versionDescription={version.description}
              />

              {/* Label summary from milestone MRs */}
              <LabelSummarySection
                milestoneMRsLoaded={!!milestoneMRs}
                labelSummary={labelSummary}
              />

              {/* Issues with MR matching */}
              <IssuesSection
                issueCounts={issueCounts}
                gitlabMatchType={gitlabMatch.type}
                hasReleaseDate={!!version.releaseDate}
                isLoadingIssues={isLoadingIssues}
                matchedRows={matchedRows}
                wrongMilestoneByKey={wrongMilestoneByKey}
                unmatchedMRs={unmatchedMRs}
                onOpenIssue={resolvedOnOpenIssue}
                onOpenIssueFull={openIssueFull}
                onSeedBreadcrumb={seedReleaseBreadcrumb}
                onNavigateToIssueFromMR={handleNavigateToIssueFromMR}
              />

              {/* Action buttons */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  aria-label={pinned ? 'Unpin release' : 'Pin release'}
                  title={pinned ? 'Unpin release' : 'Pin release'}
                  onClick={() => {
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
                >
                  <Pin className={`size-3.5${pinned ? ' fill-current text-primary' : ''}`} />
                  {pinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleOpenInJira}
                >
                  <ExternalLink className="size-3.5" />
                  Open in Jira
                </Button>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <ReleaseDetailSidebar
            width={width}
            isDragging={isDragging}
            onResizeMouseDown={handleMouseDown}
            handleHovered={handleHovered}
            setHandleHovered={setHandleHovered}
            onStartEditing={startEditing}
            version={version}
            gitlabMatch={gitlabMatch}
            matchedMilestone={matchedMilestone}
            milestoneMRsLoaded={!!milestoneMRs}
            labelCoverage={labelCoverage}
            mrStateCounts={mrStateCounts}
            hasMrs={releaseMrs.length > 0}
            hasIssues={releaseIssues.length > 0}
            issueStatusCounts={issueStatusCounts}
            hasStoryPoints={hasStoryPoints}
            storyPoints={storyPoints}
          />

          {/* Edit modal — centered overlay; sidebar stays read-only */}
          <Dialog.Root
            open={editing}
            onOpenChange={(o) => {
              if (!o) cancelEditing();
            }}
          >
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
              <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[680px] max-h-[85vh] overflow-y-auto bg-background border rounded-lg shadow-xl flex flex-col">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <h2 className="text-lg font-semibold">Edit Release</h2>
                  <Dialog.Close
                    render={
                      <button
                        type="button"
                        className="rounded p-1 hover:bg-accent"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    }
                  />
                </div>

                <div className="flex flex-col gap-5 px-6 py-5">
                  {/* Jira fields */}
                  <div className="space-y-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label htmlFor="release-name" className="text-xs text-muted-foreground">
                        Name
                      </label>
                      <Input
                        id="release-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={isSaving}
                        required
                      />
                    </div>

                    {/* Release Date */}
                    <div className="space-y-1.5">
                      <label htmlFor="release-date" className="text-xs text-muted-foreground">
                        Release Date
                      </label>
                      <Input
                        id="release-date"
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="release-description"
                        className="text-xs text-muted-foreground"
                      >
                        Description
                      </label>
                      <Textarea
                        id="release-description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        disabled={isSaving}
                        rows={4}
                      />
                    </div>

                    {/* Released toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={editReleased}
                        onClick={() => setEditReleased(!editReleased)}
                        disabled={isSaving}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          editReleased ? 'bg-green-600' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block size-3.5 rounded-full bg-white transition-transform ${
                            editReleased ? 'translate-x-[18px]' : 'translate-x-[2px]'
                          }`}
                        />
                      </button>
                      <span className="text-sm">{editReleased ? 'Released' : 'Unreleased'}</span>
                    </div>
                  </div>

                  {/* GitLab Milestone section — only when a milestone is matched */}
                  {gitlabMatch.type !== 'none' && matchedMilestone && (
                    <div className="space-y-4 border-t pt-5">
                      <h3 className="text-sm font-medium">GitLab Milestone</h3>

                      {/* Milestone Title */}
                      <div className="space-y-1.5">
                        <label htmlFor="milestone-title" className="text-xs text-muted-foreground">
                          Title
                        </label>
                        <Input
                          id="milestone-title"
                          value={editMilestoneTitle}
                          onChange={(e) => setEditMilestoneTitle(e.target.value)}
                          disabled={isSaving}
                          required
                        />
                      </div>

                      {/* Milestone Description */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="milestone-description"
                          className="text-xs text-muted-foreground"
                        >
                          Description
                        </label>
                        <Textarea
                          id="milestone-description"
                          value={editMilestoneDescription}
                          onChange={(e) => setEditMilestoneDescription(e.target.value)}
                          disabled={isSaving}
                          rows={4}
                        />
                      </div>
                    </div>
                  )}

                  {/* Per-source errors (partial-failure handling) */}
                  {jiraError && (
                    <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      Jira: {jiraError}
                    </div>
                  )}
                  {gitlabError && (
                    <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      GitLab: {gitlabError}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 border-t px-6 py-4">
                  <Button variant="outline" size="sm" onClick={cancelEditing} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={
                      isSaving || !editName.trim() || !isEditDirty || isMilestoneTitleInvalid
                    }
                    className="gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      )}
    </div>
  );
}
