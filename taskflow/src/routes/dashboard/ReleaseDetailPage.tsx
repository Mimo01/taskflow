/**
 * ReleaseDetailPage -- Full-page route-based release detail view at /release/:versionId.
 *
 * Two-column layout mirroring MergeRequestDetailPage: left column shows release
 * name, status, description, and issue counts; right sidebar shows metadata
 * with inline editing capabilities.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  ArrowLeft,
  Calendar,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Package,
  Pencil,
  X,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { fetchFixVersions, updateFixVersion } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { fetch } from '@tauri-apps/plugin-http';

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

// ---- Main Component ----

export default function ReleaseDetailPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop);

  const { jiraBaseUrl, activeJiraProject } = useAuthStore();

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
  const version = useMemo(
    () => fixVersions?.find((v) => v.id === versionId) ?? null,
    [fixVersions, versionId],
  );

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

  // Populate edit form when entering edit mode
  const startEditing = useCallback(() => {
    if (!version) return;
    setEditName(version.name);
    setEditDate(version.releaseDate ?? '');
    setEditDescription(version.description ?? '');
    setEditReleased(version.released);
    setMutationError(null);
    setEditing(true);
  }, [version]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setMutationError(null);
  }, []);

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

  const handleSave = useCallback(() => {
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
  }, [editName, editDate, editDescription, editReleased, version, mutation]);

  const handleBack = () => {
    if (trail.length > 0) {
      const target = trail[trail.length - 1];
      breadcrumbPop();
      navigate(target.path, { replace: true });
    } else {
      navigate('/releases');
    }
  };

  const handleOpenInJira = useCallback(() => {
    if (jiraBaseUrl && activeJiraProject && versionId) {
      const base = jiraBaseUrl.replace(/\/$/, '');
      openUrl(`${base}/projects/${activeJiraProject}/versions/${versionId}`);
    }
  }, [jiraBaseUrl, activeJiraProject, versionId]);

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
        <div className="flex flex-1 overflow-hidden">
          {/* Left column */}
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Package className="size-4 text-muted-foreground" />
                  <p className="text-xs font-mono text-muted-foreground">v{version.id}</p>
                </div>
                <h2 className="text-xl font-semibold leading-snug">{version.name}</h2>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                {version.released ? (
                  <Badge variant="default" className="bg-green-600 text-white">
                    Released
                  </Badge>
                ) : (
                  <Badge variant="default" className="bg-amber-500 text-white">
                    Unreleased
                  </Badge>
                )}
                {version.releaseDate && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="size-3.5" />
                    {version.releaseDate}
                  </span>
                )}
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

              {/* Issue counts */}
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Issues</h3>
                {issueCounts ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      {issueCounts.issuesFixed} / {issueCounts.issuesTotal} issues done
                    </p>
                    {issueCounts.issuesTotal > 0 && (
                      <div className="h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{
                            width: `${Math.round((issueCounts.issuesFixed / issueCounts.issuesTotal) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading issue counts...</p>
                )}
              </section>

              {/* Action buttons */}
              <div className="flex justify-end gap-2">
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
          <div className="w-[42%] border-l overflow-auto p-4 shrink-0">
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
                  <span className="text-sm">
                    {editReleased ? 'Released' : 'Unreleased'}
                  </span>
                </div>

                {/* Error message */}
                {mutationError && (
                  <p className="text-xs text-destructive">{mutationError}</p>
                )}

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
                    <Badge variant="default" className="bg-green-600 text-white">
                      Released
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-amber-500 text-white">
                      Unreleased
                    </Badge>
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

                <MetaRow label="Description">
                  {version.description ? (
                    <span className="line-clamp-3">{version.description}</span>
                  ) : (
                    <span className="text-muted-foreground italic">No description</span>
                  )}
                </MetaRow>

                <MetaRow label="Issues">
                  {issueCounts ? (
                    <span className="tabular-nums">
                      {issueCounts.issuesFixed} / {issueCounts.issuesTotal} done
                    </span>
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
      <div className="w-[42%] space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-full" />
      </div>
    </div>
  );
}
