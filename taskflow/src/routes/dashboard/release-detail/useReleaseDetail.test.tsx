// CR-02/CR-03/WR-10: regression coverage for milestone-invalidation granularity,
// branch-check error threading + retry exposure, and mutation project/token guards.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitLabMilestone } from '@/services/gitlab';
import { useReleaseDetail } from './useReleaseDetail';

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

// Mock jira service
vi.mock('@/services/jira', () => ({
  fetchFixVersions: vi.fn(),
  fetchVersionIssueCounts: vi.fn(),
  fetchFixVersionIssues: vi.fn(),
}));

// Mock gitlab service
vi.mock('@/services/gitlab', () => ({
  fetchProject: vi.fn(),
  fetchProjectMilestonesInRange: vi.fn(),
  fetchBranch: vi.fn(),
  createBranch: vi.fn(),
  createMilestone: vi.fn(),
  fetchMilestoneMRs: vi.fn(),
  fetchRecentProjectMRs: vi.fn(),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

// Mock settings store (selector-agnostic mock — component reads storyPointsFieldKey directly)
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn((selector: (s: { storyPointsFieldKey: string }) => unknown) =>
    selector({ storyPointsFieldKey: 'customfield_10016' }),
  ),
}));

const VERSION_ID = '10000';
const RELEASE_DATE = '2026-07-21';

function makeMilestone(overrides: Partial<GitLabMilestone> = {}): GitLabMilestone {
  return {
    id: 1,
    iid: 1,
    title: '33.5.0 (21.07.2026)',
    description: null,
    start_date: null,
    due_date: RELEASE_DATE,
    state: 'active',
    web_url: 'https://gitlab.example.com/milestones/1',
    ...overrides,
  };
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

async function setupMocks(
  overrides: {
    activeGitlabProject?: number | null;
    gitlabBaseUrl?: string | null;
    fetchBranchImpl?: () => Promise<{ exists: boolean }>;
  } = {},
) {
  const auth = await import('@/stores/auth.store');
  vi.mocked(auth.useAuthStore).mockReturnValue({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl:
      overrides.gitlabBaseUrl === undefined
        ? 'https://gitlab.example.com'
        : overrides.gitlabBaseUrl,
    activeGitlabProject:
      overrides.activeGitlabProject === undefined ? 42 : overrides.activeGitlabProject,
  } as ReturnType<typeof auth.useAuthStore>);

  const jira = await import('@/services/jira');
  vi.mocked(jira.fetchFixVersions).mockResolvedValue([
    { id: VERSION_ID, name: '33.5.0', releaseDate: RELEASE_DATE, released: false },
  ]);
  vi.mocked(jira.fetchVersionIssueCounts).mockResolvedValue({
    issuesFixed: 0,
    issuesTotal: 0,
  });
  vi.mocked(jira.fetchFixVersionIssues).mockResolvedValue([]);

  const gitlab = await import('@/services/gitlab');
  vi.mocked(gitlab.fetchProjectMilestonesInRange).mockResolvedValue([makeMilestone()]);
  vi.mocked(gitlab.fetchProject).mockResolvedValue({
    default_branch: 'develop',
  } as Awaited<ReturnType<typeof gitlab.fetchProject>>);
  vi.mocked(gitlab.fetchBranch).mockImplementation(
    overrides.fetchBranchImpl ?? (() => Promise.resolve({ exists: false })),
  );
  vi.mocked(gitlab.fetchMilestoneMRs).mockResolvedValue([]);
  vi.mocked(gitlab.fetchRecentProjectMRs).mockResolvedValue([]);
  vi.mocked(gitlab.createMilestone).mockResolvedValue(makeMilestone());
  vi.mocked(gitlab.createBranch).mockResolvedValue({
    name: 'release/33.5.0',
    web_url: 'https://gitlab.example.com/-/branches/release/33.5.0',
  });
}

describe('useReleaseDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test A: milestone create invalidates the project-granular key, not the four-element windowed key', async () => {
    await setupMocks();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.matchedMilestone).not.toBeNull());

    await result.current.createMilestoneMutation.mutateAsync('33.5.0 (21.07.2026)');

    const milestoneInvalidations = invalidateSpy.mock.calls
      .map((call) => call[0]?.queryKey as unknown[] | undefined)
      .filter((key): key is unknown[] => Array.isArray(key) && key[0] === 'gitlab-milestones');

    expect(milestoneInvalidations).toContainEqual(['gitlab-milestones', 42]);
    for (const key of milestoneInvalidations) {
      expect(key.length).toBeLessThanOrEqual(2);
    }
  });

  it('Test B: a list-shaped window key becomes invalidated by the project-granular invalidation', async () => {
    await setupMocks();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const listShapedKey = ['gitlab-milestones', 42, '2026-01-01', '2026-12-31'];
    queryClient.setQueryData(listShapedKey, []);

    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.matchedMilestone).not.toBeNull());

    await result.current.createMilestoneMutation.mutateAsync('33.5.0 (21.07.2026)');

    expect(queryClient.getQueryState(listShapedKey)?.isInvalidated).toBe(true);
  });

  it('Test C: a failed branch-existence check resolves to check-failed, not stuck loading', async () => {
    await setupMocks({ fetchBranchImpl: () => Promise.reject(new Error('network error')) });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.branchState.kind).toBe('check-failed'));
  });

  it('Test D: refetchBranchCheck is exposed and triggers another fetchBranch call', async () => {
    await setupMocks({ fetchBranchImpl: () => Promise.reject(new Error('network error')) });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.branchState.kind).toBe('check-failed'));

    expect(typeof result.current.refetchBranchCheck).toBe('function');

    const gitlab = await import('@/services/gitlab');
    const callCountBefore = vi.mocked(gitlab.fetchBranch).mock.calls.length;

    result.current.refetchBranchCheck();

    await waitFor(() =>
      expect(vi.mocked(gitlab.fetchBranch).mock.calls.length).toBeGreaterThan(callCountBefore),
    );
  });

  it('Test E: neither mutation calls the service when the GitLab project is unset', async () => {
    await setupMocks({ activeGitlabProject: null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.createMilestoneMutation.mutateAsync('33.5.0 (21.07.2026)'),
    ).rejects.toThrow('GitLab project not configured');

    await expect(result.current.createBranchMutation.mutateAsync()).rejects.toThrow(
      'GitLab project not configured',
    );

    const gitlab = await import('@/services/gitlab');
    expect(gitlab.createMilestone).not.toHaveBeenCalled();
    expect(gitlab.createBranch).not.toHaveBeenCalled();
  });
});
