/**
 * ReleaseDetailPage -- Full-page route-based release detail view at /release/:versionId.
 *
 * Two-column layout mirroring MergeRequestDetailPage: left column shows release
 * name, status, description, and issue counts; right sidebar shows metadata
 * with inline editing capabilities.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetch } from '@tauri-apps/plugin-http';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  ExternalLink,
  FileText,
  GitMerge,
  Info,
  Loader2,
  Pencil,
  Pin,
  Rocket,
  Tag,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useResizable } from '@/hooks/useResizable';
import { statusPillClass } from '@/lib/statusStyles';
import type { GitLabMilestone, GitLabMR } from '@/services/gitlab';
import { fetchMilestoneMRs, fetchProjectMilestonesInRange } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { fetchFixVersions, updateFixVersion } from '@/services/jira';
import { extractTicketKeys, linkMRToTask } from '@/services/linkEngine';
import type { ReleaseMatch } from '@/services/releaseLinker';
import { matchGitLabToFixVersion } from '@/services/releaseLinker';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { useSettingsStore } from '@/stores/settings.store';

// ---- Issue count fetching (duplicated from ReleasesTab to keep self-contained) ----

interface VersionIssueCounts {
  issuesFixed: number;
  issuesTotal: number;
}

async function fetchVersionIssueCounts(
  baseUrl: string,
  token: string,
  versionId: string,
): Promise<VersionIssueCounts> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  if (!/^\d+$/.test(versionId)) throw new Error(`Invalid versionId: ${versionId}`);
  const baseJql = `fixVersion = ${versionId} AND issuetype not in subtaskIssueTypes()`;
  const totalJql = encodeURIComponent(baseJql);
  const doneJql = encodeURIComponent(`${baseJql} AND statusCategory = Done`);
  const totalUrl = `${base}/rest/api/2/search?jql=${totalJql}&maxResults=0&fields=`;
  const doneUrl = `${base}/rest/api/2/search?jql=${doneJql}&maxResults=0&fields=`;

  const [totalResult, doneResult] = await Promise.allSettled([
    fetch(totalUrl, { headers }).then((r) =>
      r.ok ? (r.json() as Promise<{ total?: number }>) : { total: 0 },
    ),
    fetch(doneUrl, { headers }).then((r) =>
      r.ok ? (r.json() as Promise<{ total?: number }>) : { total: 0 },
    ),
  ]);

  const issuesTotal = totalResult.status === 'fulfilled' ? (totalResult.value.total ?? 0) : 0;
  const issuesFixed = doneResult.status === 'fulfilled' ? (doneResult.value.total ?? 0) : 0;

  return { issuesFixed, issuesTotal };
}

// ---- Fetch Jira issues for a fix version ----

async function fetchFixVersionIssues(
  baseUrl: string,
  token: string,
  versionId: string,
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (!/^\d+$/.test(versionId)) throw new Error(`Invalid versionId: ${versionId}`);
  const jql = `fixVersion = ${versionId} AND issuetype not in subtaskIssueTypes() ORDER BY rank ASC`;
  const fields = 'summary,status,assignee,issuetype';
  const maxResults = 200;
  let startAt = 0;
  const allIssues: JiraIssue[] = [];

  while (true) {
    const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=${maxResults}&startAt=${startAt}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`Failed to fetch issues: status ${resp.status}`);

    const data = (await resp.json()) as { issues: JiraIssue[]; total: number };
    const before = allIssues.length;
    allIssues.push(...data.issues);

    if (allIssues.length >= data.total || allIssues.length === before) break;
    startAt = allIssues.length;
  }

  return allIssues;
}

// ---- Main Component ----

export default function ReleaseDetailPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop);

  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl, activeGitlabProject } = useAuthStore();
  const releaseDetailPanelWidth = useSettingsStore((s) => s.releaseDetailPanelWidth);
  const setReleaseDetailPanelWidth = useSettingsStore((s) => s.setReleaseDetailPanelWidth);

  // Pinned-release tab support (mirrors AioCycleDetailPage cycle pinning)
  const releaseKey = `REL-${versionId}`;
  const pinned = usePinnedTabsStore((s) => s.pinnedKeys.includes(releaseKey));
  const togglePin = usePinnedTabsStore((s) => s.togglePin);
  const removePin = usePinnedTabsStore((s) => s.removePin);
  const setPinnedReleaseMeta = usePinnedTabsStore((s) => s.setPinnedReleaseMeta);
  const clearReleaseMeta = usePinnedTabsStore((s) => s.clearReleaseMeta);

  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

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

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then((t) => setGitlabToken(t))
        .catch(() => setGitlabToken(null));
    }
  }, [gitlabBaseUrl]);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReleased, setEditReleased] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

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
  const MILESTONE_LEEWAY_DAYS = 7;
  const milestoneWindow = (() => {
    if (!version?.releaseDate) return null;
    const addDays = (d: string, n: number) => {
      const dt = new Date(d);
      dt.setDate(dt.getDate() + n);
      return dt.toISOString().slice(0, 10);
    };
    return {
      from: addDays(version.releaseDate, -MILESTONE_LEEWAY_DAYS),
      to: addDays(version.releaseDate, MILESTONE_LEEWAY_DAYS),
    };
  })();

  const { data: milestones } = useQuery({
    queryKey: [
      'gitlab-milestones',
      activeGitlabProject,
      milestoneWindow?.from,
      milestoneWindow?.to,
    ],
    queryFn: () =>
      fetchProjectMilestonesInRange(
        gitlabBaseUrl ?? '',
        gitlabToken ?? '',
        activeGitlabProject ?? 0,
        milestoneWindow?.from ?? '',
        milestoneWindow?.to ?? '',
      ),
    enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && milestoneWindow !== null,
    staleTime: 5 * 60_000,
  });

  // Match GitLab milestone to this fix version by date
  const gitlabMatch: ReleaseMatch = (() => {
    const noMatch: ReleaseMatch = { type: 'none', candidateName: '', candidateUrl: '' };
    if (!version?.releaseDate || !milestones) return noMatch;

    const candidates = (milestones as GitLabMilestone[]).map((m) => ({
      date: m.due_date,
      name: m.title,
      url: m.web_url,
    }));

    let bestMatch: ReleaseMatch = noMatch;
    for (const cand of candidates) {
      const match = matchGitLabToFixVersion(version.releaseDate, cand);
      if (match.type === 'exact') return match;
      if (match.type === 'fuzzy' && bestMatch.type === 'none') bestMatch = match;
    }
    return bestMatch;
  })();

  const matchedMilestone: GitLabMilestone | null =
    gitlabMatch.type !== 'none' && milestones
      ? ((milestones as GitLabMilestone[]).find((m) => m.title === gitlabMatch.candidateName) ??
        null)
      : null;

  // Fetch Jira issues for this fix version
  const { data: fixVersionIssues, isLoading: isLoadingIssues } = useQuery({
    queryKey: ['jira-fixversion-issues', versionId],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !versionId) throw new Error('No credentials');
      return fetchFixVersionIssues(jiraBaseUrl, token, versionId);
    },
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!versionId,
  });

  // Fetch MRs for matched GitLab milestone
  const { data: milestoneMRs } = useQuery({
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

  // Match MRs to Jira issues
  const releaseIssues = fixVersionIssues ?? [];
  const releaseMrs = milestoneMRs ?? [];
  const releaseIssueKeySet = new Set(releaseIssues.map((i) => i.key));
  const releaseMrByIssue = new Map<string, GitLabMR>();
  const releaseUnmatched: GitLabMR[] = [];
  for (const mr of releaseMrs) {
    const matchedKey = linkMRToTask(mr, releaseIssueKeySet);
    if (matchedKey) {
      releaseMrByIssue.set(matchedKey, mr);
    } else {
      releaseUnmatched.push(mr);
    }
  }
  const matchedRows = releaseIssues.map((issue) => ({
    issue,
    mr: releaseMrByIssue.get(issue.key) ?? null,
  }));
  const unmatchedMRs = releaseUnmatched;

  // Aggregate unique labels across all milestone MRs with counts
  const labelMap = new Map<
    string,
    { label: { name: string; color: string; text_color: string }; count: number }
  >();
  for (const mr of releaseMrs) {
    for (const label of mr.labels) {
      const existing = labelMap.get(label.name);
      if (existing) {
        existing.count += 1;
      } else {
        labelMap.set(label.name, { label, count: 1 });
      }
    }
  }
  const labelSummary = Array.from(labelMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.name.localeCompare(b.label.name);
  });

  // Compute label coverage stats: how many MRs have at least one label
  const labelCoverage = (() => {
    if (releaseMrs.length === 0) return null;
    const unlabeled = releaseMrs.filter((mr) => mr.labels.length === 0);
    return {
      total: releaseMrs.length,
      labeled: releaseMrs.length - unlabeled.length,
      unlabeled,
      allLabeled: unlabeled.length === 0,
    };
  })();

  // Populate edit form when entering edit mode
  const startEditing = () => {
    if (!version) return;
    setEditName(version.name);
    setEditDate(version.releaseDate ?? '');
    setEditDescription(version.description ?? '');
    setEditReleased(version.released);
    setMutationError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setMutationError(null);
  };

  // Update mutation
  const mutation = useMutation({
    mutationFn: async (fields: {
      name?: string;
      releaseDate?: string | null;
      description?: string;
      released?: boolean;
    }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !versionId) throw new Error('No credentials');
      return updateFixVersion(jiraBaseUrl, token, versionId, fields);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-fix-versions', activeJiraProject] });
      queryClient.invalidateQueries({ queryKey: ['jira-version-counts', versionId] });
      setEditing(false);
      setMutationError(null);
    },
    onError: (err: Error) => {
      setMutationError(err.message);
    },
  });

  const handleSave = () => {
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

    // Only send if something changed
    if (Object.keys(fields).length === 0) {
      setEditing(false);
      return;
    }

    mutation.mutate(fields);
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
      {trail.length > 0 && (
        <div className="px-6 py-3 border-b flex items-center gap-2 text-sm flex-shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" />
          </button>
          {trail.map((entry, i) => (
            <span key={entry.path} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              <button
                type="button"
                onClick={() => {
                  useBreadcrumbStore.setState({ trail: trail.slice(0, i) });
                  navigate(entry.path, { replace: true });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                {entry.label}
              </button>
            </span>
          ))}
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{version?.name ?? 'Release'}</span>
        </div>
      )}

      {/* Detail body */}
      {isLoading || !version ? (
        <ReleaseDetailSkeleton />
      ) : (
        <div ref={containerRef} className="flex flex-1 overflow-hidden">
          {/* Left column */}
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Rocket className="size-4 text-muted-foreground" />
                  <p className="text-xs font-mono text-muted-foreground">v{version.id}</p>
                </div>
                <h2 className="text-xl font-semibold leading-snug">{version.name}</h2>
              </div>

              {/* Description */}
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="size-3.5" />
                  Description
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
                            breadcrumbPush({ path: `/release/${versionId}`, label: version.name });
                            navigate(`/issue/${row.issue.key}`);
                          }}
                        >
                          <td className="py-1.5 px-2 font-mono text-xs whitespace-nowrap border-b border-border/50 text-primary">
                            {row.issue.key}
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
            {editing ? (
              /* Edit form */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Edit Release</h3>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted"
                    aria-label="Cancel editing"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor="release-name" className="text-xs text-muted-foreground">
                    Name
                  </label>
                  <Input
                    id="release-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label htmlFor="release-description" className="text-xs text-muted-foreground">
                    Description
                  </label>
                  <Textarea
                    id="release-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
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

                {/* Error message */}
                {mutationError && <p className="text-xs text-destructive">{mutationError}</p>}

                {/* Save / Cancel buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={mutation.isPending || !editName.trim()}
                    className="gap-1.5"
                  >
                    {mutation.isPending ? (
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEditing}
                    disabled={mutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* Read-only metadata */
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
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Shared layout components (matching MergeRequestDetailPage) ----

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}

// ---- Skeleton ----

function ReleaseDetailSkeleton() {
  return (
    <div data-testid="release-detail-skeleton" className="flex h-full p-6 gap-6">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="shrink-0 space-y-3" style={{ width: 288 }}>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-full" />
      </div>
    </div>
  );
}
