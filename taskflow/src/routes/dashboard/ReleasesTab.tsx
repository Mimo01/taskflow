/**
 * ReleasesTab — PM-03 + PM-04: Fix version rows with GitLab date-matched links and task counts.
 *
 * Fetches:
 *   1. Jira fix versions for the active project
 *   2. GitLab group milestones
 *   3. GitLab project tags (requires resolving group path → project ID)
 *   4. Per-version issue counts from Jira relatedIssueCounts endpoint
 *
 * Date matching uses matchGitLabToFixVersion (exact / fuzzy / none).
 * Fuzzy matches show a dashed underline indicator with hover tooltip.
 */
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { fetchFixVersions } from '@/services/jira';
import type { JiraFixVersion } from '@/services/jira';
import { fetchGroupMilestones, fetchProjectTags } from '@/services/gitlab';
import type { GitLabMilestone, GitLabTag } from '@/services/gitlab';
import { matchGitLabToFixVersion } from '@/services/releaseLinker';
import type { ReleaseMatch } from '@/services/releaseLinker';
import { readSecret } from '@/services/stronghold';
import { fetch } from '@tauri-apps/plugin-http';

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
}

interface VersionIssueCounts {
  issuesFixed: number;
  issuesAffected: number;
}

async function fetchGroupProjects(
  baseUrl: string,
  token: string,
  groupPath: string,
): Promise<GitLabProject[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/groups/${encodeURIComponent(groupPath)}/projects?per_page=100`;
  try {
    const response = await fetch(url, {
      headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
    });
    if (!response.ok) return [];
    return (await response.json()) as GitLabProject[];
  } catch {
    return [];
  }
}

async function fetchVersionIssueCounts(
  baseUrl: string,
  token: string,
  versionId: string,
): Promise<VersionIssueCounts> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/version/${versionId}/relatedIssueCounts`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) return { issuesFixed: 0, issuesAffected: 0 };
    const data = await response.json();
    return { issuesFixed: data.issuesFixed ?? 0, issuesAffected: data.issuesAffected ?? 0 };
  } catch {
    return { issuesFixed: 0, issuesAffected: 0 };
  }
}

interface MatchedVersion {
  version: JiraFixVersion;
  match: ReleaseMatch;
  issuesFixed: number;
  issuesTotal: number;
}

export default function ReleasesTab() {
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl, activeGitlabGroup } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then((t) => setGitlabToken(t))
        .catch(() => setGitlabToken(null));
    }
  }, [gitlabBaseUrl]);

  // Fetch fix versions
  const {
    data: fixVersions,
    isLoading: loadingVersions,
    isError: errorVersions,
    error: versionError,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject],
    queryFn: () => fetchFixVersions(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
    staleTime: 5 * 60_000,
  });

  // Fetch GitLab group milestones
  const { data: milestones } = useQuery({
    queryKey: ['gitlab-milestones', activeGitlabGroup],
    queryFn: () => fetchGroupMilestones(gitlabBaseUrl!, gitlabToken!, activeGitlabGroup!),
    enabled: !!gitlabBaseUrl && !!activeGitlabGroup && !!gitlabToken,
    staleTime: 5 * 60_000,
  });

  // Resolve group → project ID for tags
  const { data: groupProjects } = useQuery({
    queryKey: ['gitlab-group-projects', activeGitlabGroup],
    queryFn: () => fetchGroupProjects(gitlabBaseUrl!, gitlabToken!, activeGitlabGroup!),
    enabled: !!gitlabBaseUrl && !!activeGitlabGroup && !!gitlabToken,
    staleTime: Infinity,
  });

  const firstProjectId = groupProjects?.[0]?.id ?? null;

  // Fetch GitLab project tags
  const { data: tags } = useQuery({
    queryKey: ['gitlab-tags', firstProjectId],
    queryFn: () => fetchProjectTags(gitlabBaseUrl!, gitlabToken!, firstProjectId!),
    enabled: !!gitlabBaseUrl && !!gitlabToken && firstProjectId !== null,
    staleTime: 5 * 60_000,
  });

  // Per-version issue counts (parallel queries)
  const versionCountQueries = useQueries({
    queries: (fixVersions ?? []).map((v) => ({
      queryKey: ['jira-version-counts', v.id],
      queryFn: () => fetchVersionIssueCounts(jiraBaseUrl!, jiraToken!, v.id),
      enabled: !!jiraBaseUrl && !!jiraToken,
      staleTime: 5 * 60_000,
    })),
  });

  // Build matched versions via useMemo
  const matchedVersions: MatchedVersion[] = useMemo(() => {
    const versions = fixVersions ?? [];
    const msList: GitLabMilestone[] = milestones ?? [];
    const tagList: GitLabTag[] = tags ?? [];

    const candidates = [
      ...msList.map((m) => ({ date: m.due_date, name: m.title, url: m.web_url })),
      ...tagList.map((t) => ({ date: t.commit.created_at, name: t.name, url: '' })),
    ];

    return versions.map((version, idx) => {
      let bestMatch: ReleaseMatch = { type: 'none', candidateName: '', candidateUrl: '' };

      for (const cand of candidates) {
        const match = matchGitLabToFixVersion(version.releaseDate, cand);
        if (match.type === 'exact') {
          bestMatch = match;
          break;
        }
        if (match.type === 'fuzzy' && bestMatch.type === 'none') {
          bestMatch = match;
        }
      }

      const counts = versionCountQueries[idx]?.data;
      const issuesFixed = counts?.issuesFixed ?? 0;
      const issuesTotal = (counts?.issuesFixed ?? 0) + (counts?.issuesAffected ?? 0);

      return { version, match: bestMatch, issuesFixed, issuesTotal };
    });
  }, [fixVersions, milestones, tags, versionCountQueries]);

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never';

  const isLoading = loadingVersions;
  const isError = errorVersions;

  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Header row */}
      <div className="flex items-center justify-end gap-2 pb-2">
        <span className="text-xs text-muted-foreground">{lastRefreshed}</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} data-testid="skeleton-row" className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(versionError as Error)?.message ?? 'Failed to load fix versions'}
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && (
        <>
          {matchedVersions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No fix versions configured for this project
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {matchedVersions.map(({ version, match, issuesFixed, issuesTotal }) => (
                <div
                  key={version.id}
                  data-testid="release-row"
                  className="flex items-center justify-between rounded px-3 py-2 hover:bg-muted/50 gap-3"
                >
                  {/* Version name + date */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium truncate">{version.name}</span>
                    {version.releaseDate && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {version.releaseDate}
                      </span>
                    )}
                  </div>

                  {/* GitLab match indicator */}
                  <div className="flex items-center gap-3 shrink-0">
                    {match.type === 'exact' && match.candidateUrl ? (
                      <a
                        href={match.candidateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate max-w-[150px]"
                        data-testid="gitlab-link-exact"
                      >
                        {match.candidateName}
                      </a>
                    ) : match.type === 'fuzzy' ? (
                      <span
                        className="text-xs border-b border-dashed border-muted-foreground cursor-default truncate max-w-[150px]"
                        title={`Fuzzy match: ${match.candidateName}`}
                        data-testid="gitlab-link-fuzzy"
                      >
                        {match.candidateName}
                      </span>
                    ) : (
                      <span
                        className="text-xs text-muted-foreground"
                        data-testid="gitlab-link-none"
                      >
                        No GitLab link
                      </span>
                    )}

                    {/* Task count */}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {issuesFixed} / {issuesTotal} done
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
