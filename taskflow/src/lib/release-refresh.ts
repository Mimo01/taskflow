import type { QueryClient } from '@tanstack/react-query';
import {
  MR_CHANNEL_QUERY_PREFIXES,
  mrChannelKeys,
} from '../routes/dashboard/release-detail/mrChannelKeys';

/**
 * Refresh the Releases list. Upstream-first (see aio-refresh.ts): the batch status
 * chunks are keyed by the version ids the fix-version list returns, and RM week
 * children by the week list, so invalidating dependents in parallel would refetch
 * against stale inputs. Stage 1 awaits the sources; stage 2 the dependents.
 */
export async function refreshReleaseList(
  queryClient: QueryClient,
  activeJiraProject: string | null | undefined,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['jira-fix-versions', activeJiraProject] }),
    queryClient.invalidateQueries({ queryKey: ['rm-week-list'] }),
    queryClient.invalidateQueries({ queryKey: ['jira-projects-rm'] }),
  ]);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['rm-week-children'] }),
    queryClient.invalidateQueries({ queryKey: ['jira-version-counts', 'batch'] }),
  ]);
}

const GITLAB_DEPENDENT_PREFIXES = [
  'gitlab-project',
  'gitlab-branch',
  'gitlab-release-tags',
  'gitlab-mr-source-branch',
  'gitlab-compare',
] as const;

/**
 * Refresh the Release detail page (D-11/D-13). Upstream-first: stage 1 awaits the
 * sources (fix versions, GitLab milestones, RM project and week list) the
 * dependents are derived from; stage 2 invalidates issues, MR channels, branch,
 * tags, compare and project queries, and the RM week children, packages and
 * no-fix-version stories behind the header package cell and
 * DeploymentPackageSection (94-REVIEW WR-04).
 */
export async function refreshReleaseDetail(
  queryClient: QueryClient,
  args: {
    activeJiraProject: string | null | undefined;
    activeGitlabProject: number | null | undefined;
    versionId: string;
  },
): Promise<void> {
  const { activeJiraProject, activeGitlabProject, versionId } = args;
  const stage1: Promise<void>[] = [
    // No project segment: DeploymentPackageSection also reads the fix-version
    // lists of other projects for cross-project stories.
    queryClient.invalidateQueries({ queryKey: ['jira-fix-versions'] }),
    queryClient.invalidateQueries({ queryKey: ['jira-projects-rm'] }),
    queryClient.invalidateQueries({ queryKey: ['rm-week-list'] }),
  ];
  if (activeGitlabProject != null) {
    stage1.push(
      queryClient.invalidateQueries({ queryKey: ['gitlab-milestones', activeGitlabProject] }),
    );
  }
  await Promise.all(stage1);

  const stage2: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: ['jira-fixversion-issues', versionId] }),
    queryClient.invalidateQueries({ queryKey: ['rm-week-children'] }),
    queryClient.invalidateQueries({ queryKey: ['rm-package'] }),
    queryClient.invalidateQueries({
      queryKey: ['jira-package-no-fixversion', activeJiraProject],
    }),
  ];
  if (activeGitlabProject != null) {
    for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
      stage2.push(
        queryClient.invalidateQueries({
          queryKey: mrChannelKeys.channelForProject(prefix, activeGitlabProject),
        }),
      );
    }
    for (const k of GITLAB_DEPENDENT_PREFIXES) {
      stage2.push(queryClient.invalidateQueries({ queryKey: [k, activeGitlabProject] }));
    }
  }
  await Promise.all(stage2);
}
