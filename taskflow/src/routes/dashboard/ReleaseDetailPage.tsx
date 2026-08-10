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
import {
  AlertTriangle,
  Calendar,
  Check,
  ExternalLink,
  FileText,
  GitMerge,
  Info,
  Loader2,
  Pencil,
  Pin,
  Tag,
  X,
} from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useResizable } from '@/hooks/useResizable';
import { statusPillClass } from '@/lib/statusStyles';
import { updateMilestone } from '@/services/gitlab';
import { updateFixVersion } from '@/services/jira';
import { extractTicketKeys } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { useSettingsStore } from '@/stores/settings.store';
import { MetaRow } from './release-detail/MetaRow';
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
              {gitlabMatch.type !== 'none' &&
              matchedMilestone &&
              !version.description &&
              !matchedMilestone.description ? (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    Description
                  </h3>
                  <p className="text-sm text-muted-foreground italic">No description</p>
                </section>
              ) : (
                <>
                  {/* Jira Description */}
                  <section>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <FileText className="size-3.5" />
                      {gitlabMatch.type !== 'none' && matchedMilestone
                        ? 'Jira Description'
                        : 'Description'}
                    </h3>
                    {version.description ? (
                      <p className="text-sm whitespace-pre-wrap">{version.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No description</p>
                    )}
                  </section>

                  {/* GitLab Description */}
                  {gitlabMatch.type !== 'none' && matchedMilestone && (
                    <section>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <FileText className="size-3.5" />
                        GitLab Description
                      </h3>
                      {matchedMilestone.description ? (
                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {matchedMilestone.description}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No description</p>
                      )}
                    </section>
                  )}
                </>
              )}

              {/* Label summary from milestone MRs */}
              {milestoneMRs && labelSummary.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Tag className="size-3.5" />
                    Labels
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {labelSummary.map((l) => (
                      <span
                        key={l.label.name}
                        className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: l.label.color,
                          color: l.label.text_color,
                          borderColor: `${l.label.color}80`,
                        }}
                      >
                        {l.label.name} ({l.count})
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Issues with MR matching */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Issues</h3>
                  {issueCounts && (
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      {issueCounts.issuesFixed} / {issueCounts.issuesTotal} done
                    </Badge>
                  )}
                </div>

                {/* Progress bar (Jira-driven) */}
                {issueCounts && issueCounts.issuesTotal > 0 && (
                  <Progress
                    value={Math.round((issueCounts.issuesFixed / issueCounts.issuesTotal) * 100)}
                    className="max-w-xs mb-4"
                    indicatorClassName="bg-green-500"
                  />
                )}

                {/* Milestone warning */}
                {gitlabMatch.type === 'none' && (
                  <div className="flex items-center gap-2 rounded-md border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 mb-4">
                    <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400 shrink-0" />
                    <p className="text-xs text-orange-700 dark:text-orange-300">
                      No GitLab milestone matched — MR linking is unavailable.
                      {!version.releaseDate && ' Set a release date to enable milestone matching.'}
                    </p>
                  </div>
                )}

                {/* Issues table */}
                {isLoadingIssues ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading issues...
                  </div>
                ) : matchedRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No issues in this fix version
                  </p>
                ) : (
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                      <tr className="text-xs text-muted-foreground font-medium bg-muted/30">
                        <th className="text-left py-1.5 px-2 border-b border-border/50">Key</th>
                        <th className="text-left py-1.5 px-2 border-b border-border/50">Summary</th>
                        <th className="text-left py-1.5 px-2 border-b border-border/50">
                          Assignee
                        </th>
                        <th className="text-left py-1.5 px-2 border-b border-border/50">Status</th>
                        <th className="text-left py-1.5 px-2 border-b border-border/50">MR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchedRows.map((row) => (
                        <tr
                          key={row.issue.id}
                          className="border-b border-border/50 hover:bg-muted/40 cursor-pointer"
                          onClick={() => {
                            seedReleaseBreadcrumb();
                            (onOpenIssue ?? openIssueFull)(row.issue.key);
                          }}
                        >
                          <td className="py-1.5 px-2 font-mono text-xs whitespace-nowrap border-b border-border/50 text-primary">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openIssueFull(row.issue.key);
                              }}
                              className="font-mono text-xs text-primary hover:underline cursor-pointer"
                            >
                              {row.issue.key}
                            </button>
                          </td>
                          <td className="py-1.5 px-2 border-b border-border/50">
                            <span className="line-clamp-1">{row.issue.fields.summary}</span>
                          </td>
                          <td className="py-1.5 px-2 border-b border-border/50 whitespace-nowrap">
                            {row.issue.fields.assignee ? (
                              <span className="inline-flex items-center gap-1.5 text-xs">
                                <CachedAvatar
                                  url={row.issue.fields.assignee.avatarUrls['48x48']}
                                  name={row.issue.fields.assignee.displayName}
                                  size={20}
                                />
                                <span className="line-clamp-1">
                                  {row.issue.fields.assignee.displayName}
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CachedAvatar url={null} name="Unassigned" size={20} />
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 border-b border-border/50 whitespace-nowrap">
                            <span
                              className={statusPillClass(
                                row.issue.fields.status.statusCategory?.key,
                              )}
                            >
                              {row.issue.fields.status.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 border-b border-border/50 whitespace-nowrap">
                            {row.mr ? (
                              <span className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openUrl(row.mr?.web_url ?? '');
                                  }}
                                  className={`inline-flex items-center gap-1 text-xs hover:underline ${
                                    row.mr.state === 'merged'
                                      ? 'text-green-600 dark:text-green-400'
                                      : row.mr.state === 'opened'
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-gray-500'
                                  }`}
                                >
                                  <GitMerge className="size-3.5" />!{row.mr.iid}
                                </button>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    row.mr.state === 'merged'
                                      ? 'border-green-500 text-green-600'
                                      : row.mr.state === 'opened'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-gray-400 text-gray-500'
                                  }`}
                                >
                                  {row.mr.state}
                                </Badge>
                              </span>
                            ) : gitlabMatch.type === 'none' ? (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                title="No milestone matched — cannot check for MRs"
                              >
                                —
                              </span>
                            ) : wrongMilestoneByKey.has(row.issue.key) ? (
                              (() => {
                                const offending = wrongMilestoneByKey.get(row.issue.key);
                                if (!offending) return null;
                                const offendingMilestone =
                                  offending.milestone?.title ?? 'no milestone';
                                return (
                                  <span className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openUrl(offending.web_url);
                                      }}
                                      className={`inline-flex items-center gap-1 text-xs hover:underline ${
                                        offending.state === 'merged'
                                          ? 'text-green-600 dark:text-green-400'
                                          : offending.state === 'opened'
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-gray-500'
                                      }`}
                                    >
                                      <GitMerge className="size-3.5" />!{offending.iid}
                                    </button>
                                    <span
                                      className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400"
                                      title={`MR !${offending.iid} is on milestone ${offendingMilestone}, not this release`}
                                    >
                                      <AlertTriangle className="size-3.5" />
                                      Wrong milestone
                                    </span>
                                  </span>
                                );
                              })()
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400"
                                title="No merge request found in milestone"
                              >
                                <AlertTriangle className="size-3.5" />
                                Missing MR
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Unmatched MRs section */}
                {unmatchedMRs.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Info className="size-3.5 text-blue-500" />
                      <h4 className="text-sm font-medium">
                        Unmatched MRs
                        <Badge variant="secondary" className="ml-1.5 text-xs">
                          {unmatchedMRs.length}
                        </Badge>
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      MRs in milestone not linked to any Jira task
                    </p>
                    <div className="space-y-1">
                      {unmatchedMRs.map((mr) => (
                        <div key={mr.id} className="flex items-center gap-2 text-sm py-1">
                          <GitMerge
                            className={`size-3.5 shrink-0 ${
                              mr.state === 'merged'
                                ? 'text-green-600 dark:text-green-400'
                                : mr.state === 'opened'
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-gray-500'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => openUrl(mr.web_url)}
                            className="text-xs font-mono hover:underline shrink-0"
                          >
                            !{mr.iid}
                          </button>
                          <span className="line-clamp-1 text-xs text-muted-foreground">
                            {(() => {
                              const keys = extractTicketKeys(mr.title);
                              if (keys.length === 0) return mr.title;
                              const parts: React.ReactNode[] = [];
                              let remaining = mr.title;
                              for (const key of keys) {
                                const idx = remaining.indexOf(key);
                                if (idx > 0) parts.push(remaining.slice(0, idx));
                                parts.push(
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      breadcrumbPush({
                                        path: `/release/${versionId}`,
                                        label: version.name,
                                      });
                                      navigate(`/issue/${key}`);
                                    }}
                                    className="text-primary hover:underline font-mono"
                                  >
                                    {key}
                                  </button>,
                                );
                                remaining = remaining.slice(idx + key.length);
                              }
                              if (remaining) parts.push(remaining);
                              return parts;
                            })()}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground ml-auto shrink-0">
                            <CachedAvatar
                              url={mr.author.avatar_url}
                              name={mr.author.name}
                              size={20}
                            />
                            {mr.author.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${
                              mr.state === 'merged'
                                ? 'border-green-500 text-green-600'
                                : mr.state === 'opened'
                                  ? 'border-orange-500 text-orange-600'
                                  : 'border-gray-400 text-gray-500'
                            }`}
                          >
                            {mr.state}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

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
          <div
            className={`relative border-l overflow-auto p-4 shrink-0${isDragging ? '' : ' transition-all duration-200'}`}
            style={{ width }}
          >
            <div
              aria-hidden="true"
              onMouseDown={handleMouseDown}
              onMouseEnter={() => setHandleHovered(true)}
              onMouseLeave={() => setHandleHovered(false)}
              style={{ borderColor: isDragging || handleHovered ? 'var(--ring)' : undefined }}
              className="absolute left-0 top-0 h-full w-3 cursor-ew-resize z-20 border-l border-border transition-colors duration-100"
            />
            {/* Read-only metadata (editing now happens in the modal below) */}
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={startEditing}
                >
                  <Pencil className="size-3" />
                  Edit
                </Button>
              </div>

              <MetaRow label="Status">
                {version.released ? (
                  <Badge tone="green">Released</Badge>
                ) : (
                  <Badge tone="amber">Unreleased</Badge>
                )}
              </MetaRow>

              <MetaRow label="Release Date">
                {version.releaseDate ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3 text-muted-foreground shrink-0" />
                    {version.releaseDate}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </MetaRow>

              <MetaRow label="GitLab Milestone">
                {gitlabMatch.type === 'exact' ? (
                  gitlabMatch.candidateUrl ? (
                    <button
                      type="button"
                      onClick={() => openUrl(gitlabMatch.candidateUrl)}
                      className="text-primary hover:underline flex items-center gap-1"
                      data-testid="gitlab-link-exact"
                    >
                      {gitlabMatch.candidateName}
                      <ExternalLink className="size-3 shrink-0" />
                    </button>
                  ) : (
                    <span data-testid="gitlab-link-exact">{gitlabMatch.candidateName}</span>
                  )
                ) : gitlabMatch.type === 'fuzzy' ? (
                  gitlabMatch.candidateUrl ? (
                    <button
                      type="button"
                      onClick={() => openUrl(gitlabMatch.candidateUrl)}
                      className="border-b border-dashed border-muted-foreground hover:text-foreground flex items-center gap-1"
                      title={`Fuzzy match: ${gitlabMatch.candidateName}`}
                      data-testid="gitlab-link-fuzzy"
                    >
                      {gitlabMatch.candidateName}
                      <ExternalLink className="size-3 shrink-0" />
                    </button>
                  ) : (
                    <span
                      className="border-b border-dashed border-muted-foreground"
                      title={`Fuzzy match: ${gitlabMatch.candidateName}`}
                      data-testid="gitlab-link-fuzzy"
                    >
                      {gitlabMatch.candidateName}
                    </span>
                  )
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400"
                    data-testid="gitlab-link-none"
                  >
                    <AlertTriangle className="size-3" />
                    No milestone matched
                  </span>
                )}
              </MetaRow>

              <MetaRow label="MR Labels">
                {gitlabMatch.type === 'none' ? (
                  <span className="text-muted-foreground">—</span>
                ) : milestoneMRs && labelCoverage ? (
                  labelCoverage.allLabeled ? (
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Check className="size-3" />
                      All {labelCoverage.total} MRs labeled
                    </span>
                  ) : (
                    <div>
                      <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
                        <AlertTriangle className="size-3" />
                        {labelCoverage.unlabeled.length}/{labelCoverage.total} missing
                      </span>
                      <div className="mt-1.5 space-y-0.5">
                        {labelCoverage.unlabeled.map((mr) => (
                          <div key={mr.id} className="flex items-center gap-1.5">
                            <GitMerge
                              className={`size-3 shrink-0 ${
                                mr.state === 'merged'
                                  ? 'text-green-600 dark:text-green-400'
                                  : mr.state === 'opened'
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-gray-500'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => openUrl(mr.web_url)}
                              className="text-xs font-mono hover:underline shrink-0"
                            >
                              !{mr.iid}
                            </button>
                            <span className="line-clamp-1 text-xs text-muted-foreground">
                              {mr.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <span className="text-muted-foreground">Loading...</span>
                )}
              </MetaRow>

              {/* MR state distribution — only when a milestone matched and has MRs.
                  Hides entirely (no "—") when its data is absent. */}
              {gitlabMatch.type !== 'none' && milestoneMRs && releaseMrs.length > 0 && (
                <MetaRow label="MRs">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {mrStateCounts.merged > 0 && (
                      <Badge tone="green" className="text-xs tabular-nums">
                        {mrStateCounts.merged} merged
                      </Badge>
                    )}
                    {mrStateCounts.opened > 0 && (
                      <Badge tone="blue" className="text-xs tabular-nums">
                        {mrStateCounts.opened} open
                      </Badge>
                    )}
                    {mrStateCounts.closed > 0 && (
                      <Badge tone="muted" className="text-xs tabular-nums">
                        {mrStateCounts.closed} closed
                      </Badge>
                    )}
                  </span>
                </MetaRow>
              )}

              {/* Issue status distribution — hides entirely (no "—") when no
                  issues are loaded. */}
              {releaseIssues.length > 0 && (
                <MetaRow label="Issues">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {issueStatusCounts.new > 0 && (
                      <Badge tone="muted" className="text-xs tabular-nums">
                        {issueStatusCounts.new} new
                      </Badge>
                    )}
                    {issueStatusCounts.indeterminate > 0 && (
                      <Badge tone="blue" className="text-xs tabular-nums">
                        {issueStatusCounts.indeterminate} in progress
                      </Badge>
                    )}
                    {issueStatusCounts.done > 0 && (
                      <Badge tone="green" className="text-xs tabular-nums">
                        {issueStatusCounts.done} done
                      </Badge>
                    )}
                  </span>
                </MetaRow>
              )}

              {/* Story-point effort — only when at least one issue carries a
                  positive story-point value. */}
              {hasStoryPoints && (
                <MetaRow label="Story points">
                  <span className="text-sm tabular-nums">
                    {storyPoints.completed} / {storyPoints.total}
                  </span>
                </MetaRow>
              )}
            </div>
          </div>

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
