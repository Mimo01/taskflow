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
vi.mock('@/services/gitlab', async (importOriginal) => ({
  // filterMilestonesToRange is a pure helper the hook applies to the fetched
  // list — use the real one so the windowing under test cannot drift from a
  // hand-rolled stub.
  filterMilestonesToRange: (await importOriginal<typeof import('@/services/gitlab')>())
    .filterMilestonesToRange,
  fetchProject: vi.fn(),
  fetchProjectMilestones: vi.fn(),
  fetchBranch: vi.fn(),
  createBranch: vi.fn(),
  createMilestone: vi.fn(),
  fetchMilestoneMRs: vi.fn(),
  fetchAllProjectMRs: vi.fn(),
  fetchBranchTargetedMRs: vi.fn(),
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
  vi.mocked(gitlab.fetchProjectMilestones).mockResolvedValue([makeMilestone()]);
  vi.mocked(gitlab.fetchProject).mockResolvedValue({
    default_branch: 'develop',
  } as Awaited<ReturnType<typeof gitlab.fetchProject>>);
  vi.mocked(gitlab.fetchBranch).mockImplementation(
    overrides.fetchBranchImpl ?? (() => Promise.resolve({ exists: false })),
  );
  vi.mocked(gitlab.fetchMilestoneMRs).mockResolvedValue([]);
  vi.mocked(gitlab.fetchAllProjectMRs).mockResolvedValue([]);
  vi.mocked(gitlab.fetchBranchTargetedMRs).mockResolvedValue([]);
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
  it('Test F: ownProjectMilestoneList stays uncapped and unwindowed so duplicate detection sees every title', async () => {
    // Regression guard: the create dialog runs findDuplicateMilestone over this
    // exact array. If the hook ever pre-slices it (e.g. to the 5 rendered rows)
    // or re-applies the +/-7-day match window, RELMS-04's duplicate guard
    // silently shrinks to whatever happens to be displayed.
    const far = Array.from({ length: 12 }, (_, i) =>
      makeMilestone({
        id: 100 + i,
        title: `30.${i}.0 (01.01.2020)`,
        due_date: `2020-01-${String(i + 1).padStart(2, '0')}`,
      }),
    );
    await setupMocks();
    const gitlab = await import('@/services/gitlab');
    vi.mocked(gitlab.fetchProjectMilestones).mockResolvedValue([makeMilestone(), ...far]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.ownProjectMilestoneList.length).toBe(13));

    // The far-past titles fall far outside the release-date window, yet must
    // still be present for the duplicate check.
    expect(result.current.ownProjectMilestoneList.map((m) => m.title)).toContain(
      '30.11.0 (01.01.2020)',
    );
    // The windowed match list, by contrast, excludes them.
    expect(result.current.gitlabMatch.candidateName).toBe('33.5.0 (21.07.2026)');
  });

  // Channel A is project-scoped but time-windowed: unbounded it is ~42 pages /
  // ~15MB on a mature project and the GitLab instance is throughput-limited, so
  // the window is the only lever that moves. The window is derived from
  // `fixVersions` — a project-level query — so the key stays release-independent.
  it('Test G: Channel A fetches the project-scoped MR universe with a derived window', async () => {
    await setupMocks();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    const gitlab = await import('@/services/gitlab');
    await waitFor(() => expect(vi.mocked(gitlab.fetchAllProjectMRs)).toHaveBeenCalled());

    const call = vi.mocked(gitlab.fetchAllProjectMRs).mock.calls[0];
    expect(call[0]).toBe('https://gitlab.example.com');
    expect(call[1]).toBe('test-token');
    expect(call[2]).toBe(42);
    // 4th arg is the derived ISO window, floored to a month boundary.
    expect(call[3]).toMatch(/^\d{4}-\d{2}-01T00:00:00\.000Z$/);

    // The window is part of the key — serving a narrower cached result for a
    // wider window would silently under-report drift.
    expect(queryClient.getQueryState(['gitlab-all-project-mrs', 42, call[3]])).toBeDefined();
  });

  it('Test G2: the Channel A window never exceeds the 24-month lookback cap', async () => {
    await setupMocks();
    const jira = await import('@/services/jira');
    // A stale never-released version dated years ago must not drag the window
    // back to "all history" and reintroduce the slow unbounded fetch.
    vi.mocked(jira.fetchFixVersions).mockResolvedValue([
      { id: VERSION_ID, name: '33.7.0', releaseDate: '2019-01-01', released: false },
    ]);

    renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });

    const gitlab = await import('@/services/gitlab');
    await waitFor(() => expect(vi.mocked(gitlab.fetchAllProjectMRs)).toHaveBeenCalled());

    const windowIso = vi.mocked(gitlab.fetchAllProjectMRs).mock.calls[0][3] as string;
    const monthsBack = (Date.now() - Date.parse(windowIso)) / (30 * 24 * 60 * 60 * 1000);
    expect(monthsBack).toBeLessThanOrEqual(25); // 24mo cap + month-floor slack
  });

  it('Test H: Channel C (fetchBranchTargetedMRs) is not called when no milestone matched (D-18)', async () => {
    await setupMocks();
    const gitlab = await import('@/services/gitlab');
    // No matching GitLab milestone for this release date — releaseBranchName derives to null.
    vi.mocked(gitlab.fetchProjectMilestones).mockResolvedValue([]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.releaseBranchName).toBeNull());

    expect(gitlab.fetchBranchTargetedMRs).not.toHaveBeenCalled();
  });

  // WR-01 regression: Channel A's window is derived from `fixVersions`, so if the
  // query fires before that resolves it runs once against the default window and
  // again under the resolved one — two ~42-page/~15MB fetches per mount. The
  // earlier Channel A tests only inspected `mock.calls[0]`, so they could not see
  // a second call. Assert the COUNT, with fixVersions deliberately slower than the
  // GitLab credential read (the realistic ordering: local Stronghold vs Jira RTT).
  it('Test G3: Channel A fetches exactly once per mount when fixVersions resolves late', async () => {
    await setupMocks();
    const jira = await import('@/services/jira');
    vi.mocked(jira.fetchFixVersions).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return [{ id: VERSION_ID, name: '33.5.0', releaseDate: RELEASE_DATE, released: false }];
    });

    const gitlab = await import('@/services/gitlab');
    vi.mocked(gitlab.fetchAllProjectMRs).mockClear();

    renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });

    await waitFor(() => expect(vi.mocked(gitlab.fetchAllProjectMRs)).toHaveBeenCalled());
    // Give any second (wrong-window) fetch a chance to fire before asserting.
    await new Promise((r) => setTimeout(r, 80));
    expect(vi.mocked(gitlab.fetchAllProjectMRs)).toHaveBeenCalledTimes(1);
  });
});
