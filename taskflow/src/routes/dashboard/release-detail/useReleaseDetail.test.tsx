// CR-02/CR-03/WR-10: regression coverage for milestone-invalidation granularity,
// branch-check error threading + retry exposure, and mutation project/token guards.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitLabMilestone } from '@/services/gitlab';
import { patchMrInChannelCaches } from './useMrFixMutation';
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
  fetchSourceBranchMRs: vi.fn(),
  compareRefs: vi.fn(),
  searchProjectTags: vi.fn(),
  updateMergeRequest: vi.fn(),
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
    released?: boolean;
    fetchProjectImpl?: () => Promise<{ default_branch: string }>;
    milestoneTitle?: string;
    fetchSourceBranchMRsImpl?: () => Promise<unknown[]>;
    compareRefsImpl?: () => Promise<{ diffCount: number; commitCount: number; timedOut: boolean }>;
    searchProjectTagsImpl?: () => Promise<unknown[]>;
    readSecretImpl?: (key: string) => Promise<string | null>;
  } = {},
) {
  // Re-established on every setup because `vi.clearAllMocks()` in beforeEach
  // does not restore an implementation a previous test installed — without
  // this, one token-rejection test would leak into every later test.
  const stronghold = await import('@/services/stronghold');
  vi.mocked(stronghold.readSecret).mockImplementation(
    (overrides.readSecretImpl ??
      (() => Promise.resolve('test-token'))) as typeof stronghold.readSecret,
  );

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
    {
      id: VERSION_ID,
      name: '33.5.0',
      releaseDate: RELEASE_DATE,
      released: overrides.released ?? false,
    },
  ]);
  vi.mocked(jira.fetchVersionIssueCounts).mockResolvedValue({
    issuesFixed: 0,
    issuesTotal: 0,
  });
  vi.mocked(jira.fetchFixVersionIssues).mockResolvedValue([]);

  const gitlab = await import('@/services/gitlab');
  vi.mocked(gitlab.fetchProjectMilestones).mockResolvedValue([
    makeMilestone(
      overrides.milestoneTitle !== undefined ? { title: overrides.milestoneTitle } : {},
    ),
  ]);
  vi.mocked(gitlab.fetchProject).mockImplementation(
    (overrides.fetchProjectImpl ??
      (() =>
        Promise.resolve({
          default_branch: 'develop',
        }))) as unknown as typeof gitlab.fetchProject,
  );
  vi.mocked(gitlab.fetchBranch).mockImplementation(
    overrides.fetchBranchImpl ?? (() => Promise.resolve({ exists: false })),
  );
  vi.mocked(gitlab.fetchMilestoneMRs).mockResolvedValue([]);
  vi.mocked(gitlab.fetchAllProjectMRs).mockResolvedValue([]);
  vi.mocked(gitlab.fetchBranchTargetedMRs).mockResolvedValue([]);
  vi.mocked(gitlab.fetchSourceBranchMRs).mockImplementation(
    (overrides.fetchSourceBranchMRsImpl ??
      (() => Promise.resolve([]))) as typeof gitlab.fetchSourceBranchMRs,
  );
  vi.mocked(gitlab.compareRefs).mockImplementation(
    (overrides.compareRefsImpl ??
      (() =>
        Promise.resolve({
          diffCount: 0,
          commitCount: 0,
          timedOut: false,
        }))) as typeof gitlab.compareRefs,
  );
  vi.mocked(gitlab.searchProjectTags).mockImplementation(
    (overrides.searchProjectTagsImpl ??
      (() => Promise.resolve([]))) as typeof gitlab.searchProjectTags,
  );
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

  // D-12: the header badge follows the optimistic cache patch alone — no
  // refetch needed. driftRows/driftFlaggedCount are recomputed every render
  // from query data (not memoized), so patchMrInChannelCaches's write is
  // enough to flip the flagged row to clean on the very next render.
  it('Test I: patching the cache clears a flagged count (D-12 badge decrement path)', async () => {
    await setupMocks();
    const jira = await import('@/services/jira');
    const gitlab = await import('@/services/gitlab');

    vi.mocked(jira.fetchFixVersionIssues).mockResolvedValue([
      {
        id: '1',
        key: 'PROJ-1',
        fields: {
          summary: 'Fix thing',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Task', subtask: false },
        },
      },
    ] as Awaited<ReturnType<typeof jira.fetchFixVersionIssues>>);

    const driftedMr = {
      id: 7,
      iid: 100,
      project_id: 42,
      title: 'PROJ-1 fix thing',
      source_branch: 'feature/proj-1',
      target_branch: 'develop',
      state: 'opened',
      draft: false,
      author: { id: 1, name: 'Author', username: 'author', avatar_url: '' },
      reviewers: [],
      updated_at: '2026-01-01T00:00:00.000Z',
      web_url: 'https://gitlab.example.com/mr/100',
      labels: [],
      milestone: null,
    } as Awaited<ReturnType<typeof gitlab.fetchMilestoneMRs>>[number];

    vi.mocked(gitlab.fetchMilestoneMRs).mockResolvedValue([driftedMr]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.driftFlaggedCount).toBe(1));

    const releaseBranchName = result.current.releaseBranchName;
    const matchedMilestone = result.current.matchedMilestone;
    expect(releaseBranchName).toBe('release/33.5.0');
    expect(matchedMilestone).not.toBeNull();

    act(() => {
      // The seeded key is the real three-element windowed form the hook
      // actually uses (['gitlab-milestone-mrs', 42, gitlabMatch.candidateName]),
      // not a hand-written two-element key.
      patchMrInChannelCaches(queryClient, 42, driftedMr.id, {
        target_branch: releaseBranchName ?? undefined,
        milestone: matchedMilestone
          ? { id: matchedMilestone.id, title: matchedMilestone.title }
          : null,
      });
    });

    await waitFor(() => expect(result.current.driftFlaggedCount).toBe(0));
  });
});

describe('useReleaseDetail — merge-back queries (D-05 gating)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('an unreleased version fires zero extra GitLab calls', async () => {
    await setupMocks({ released: false });
    const gitlab = await import('@/services/gitlab');

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    // Let the existing branch-existence query settle before asserting the
    // negative — otherwise "zero calls" could just mean "not finished yet".
    await waitFor(() => expect(result.current.branchState.kind).not.toBe('loading'));

    expect(gitlab.fetchSourceBranchMRs).toHaveBeenCalledTimes(0);
    expect(gitlab.compareRefs).toHaveBeenCalledTimes(0);
  });

  it('a released version fires the tracking-MR query with the derived release branch name', async () => {
    await setupMocks({ released: true });
    const gitlab = await import('@/services/gitlab');

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.releaseBranchName).toBe('release/33.5.0'));
    await waitFor(() => expect(gitlab.fetchSourceBranchMRs).toHaveBeenCalled());

    expect(vi.mocked(gitlab.fetchSourceBranchMRs).mock.calls[0][3]).toBe('release/33.5.0');
  });

  it('a released version with a resolved tag fires the compare query with default branch and tag', async () => {
    await setupMocks({ released: true });
    const gitlab = await import('@/services/gitlab');
    vi.mocked(gitlab.searchProjectTags).mockResolvedValue([
      { name: 'v33.5.0' } as Awaited<ReturnType<typeof gitlab.searchProjectTags>>[number],
    ]);
    vi.mocked(gitlab.fetchProject).mockResolvedValue({
      default_branch: 'develop',
    } as Awaited<ReturnType<typeof gitlab.fetchProject>>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(gitlab.compareRefs).toHaveBeenCalled());
    const call = vi.mocked(gitlab.compareRefs).mock.calls[0];
    expect(call[3]).toBe('develop');
    expect(call[4]).toBe('v33.5.0');
    expect(result.current.mergeBackVerdict.kind).not.toBe('loading');
  });

  it('tag lookup fires for a released version even when the branch still exists (D-01 widened gate)', async () => {
    await setupMocks({
      released: true,
      fetchBranchImpl: () => Promise.resolve({ exists: true }),
    });
    const gitlab = await import('@/services/gitlab');

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.branchState.kind).toBe('exists'));
    await waitFor(() => expect(gitlab.searchProjectTags).toHaveBeenCalled());
  });

  // CR-04: a failed gitlab-project fetch must terminate the verdict at
  // couldnt-verify, not pin it at loading forever.
  it('CR-04: a failed default-branch fetch resolves to couldnt-verify, not loading', async () => {
    await setupMocks({
      released: true,
      fetchProjectImpl: () => Promise.reject(new Error('project fetch failed')),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.mergeBackVerdict.kind).toBe('couldnt-verify'));
    expect(result.current.mergeBackVerdict.kind).not.toBe('loading');
  });

  // CR-03: an unparseable milestone title derives releaseBranchName === null,
  // which permanently disables the tracking-MR query — the resolver must
  // still terminate rather than reading that disabled state as in-flight.
  it('CR-03: an unparseable milestone title resolves to couldnt-verify, not loading', async () => {
    await setupMocks({
      released: true,
      milestoneTitle: 'Sprint planning (21.07.2026)',
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.matchedMilestone).not.toBeNull());
    await waitFor(() => expect(result.current.mergeBackVerdict.kind).toBe('couldnt-verify'));
    expect(result.current.mergeBackVerdict.kind).not.toBe('loading');
  });

  // CR-01 end to end: a tracking MR merged into a branch OTHER than the
  // fetched default branch must never be read as merge-back evidence.
  it('CR-01: a tracking MR merged into a non-default branch resolves to likely-not-merged, not merged', async () => {
    await setupMocks({
      released: true,
      fetchProjectImpl: () => Promise.resolve({ default_branch: 'develop' }),
      fetchSourceBranchMRsImpl: () =>
        Promise.resolve([
          {
            iid: 5,
            state: 'merged',
            target_branch: 'master',
            web_url: 'https://gitlab.example.com/mr/5',
            merged_at: '2026-07-20T00:00:00.000Z',
          },
        ]),
      compareRefsImpl: () => Promise.resolve({ diffCount: 3, commitCount: 12, timedOut: false }),
    });
    const gitlab = await import('@/services/gitlab');
    vi.mocked(gitlab.searchProjectTags).mockResolvedValue([
      { name: 'v33.5.0' } as Awaited<ReturnType<typeof gitlab.searchProjectTags>>[number],
    ]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.mergeBackVerdict.kind).toBe('likely-not-merged'));
    expect(result.current.mergeBackVerdict.kind).not.toBe('merged');
  });

  // Happy path preserved: the same MR targeting the actual default branch
  // must still resolve to merged via the tracking-MR channel.
  it('a tracking MR merged into the default branch resolves to merged via tracking-mr', async () => {
    await setupMocks({
      released: true,
      fetchProjectImpl: () => Promise.resolve({ default_branch: 'develop' }),
      fetchSourceBranchMRsImpl: () =>
        Promise.resolve([
          {
            iid: 5,
            state: 'merged',
            target_branch: 'develop',
            web_url: 'https://gitlab.example.com/mr/5',
            merged_at: '2026-07-20T00:00:00.000Z',
          },
        ]),
      compareRefsImpl: () => Promise.resolve({ diffCount: 3, commitCount: 12, timedOut: false }),
    });
    const gitlab = await import('@/services/gitlab');
    vi.mocked(gitlab.searchProjectTags).mockResolvedValue([
      { name: 'v33.5.0' } as Awaited<ReturnType<typeof gitlab.searchProjectTags>>[number],
    ]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.mergeBackVerdict.kind).toBe('merged'));
    const verdict = result.current.mergeBackVerdict;
    expect(verdict.kind).toBe('merged');
    if (verdict.kind === 'merged') {
      expect(verdict.via).toBe('tracking-mr');
    }
  });

  // 91-VERIFICATION truth 5 / 91-08 Task 1: the reported failure sequence —
  // the tracking-MR query resolves to [] while the tag query is still in
  // flight must render 'loading', never a terminal 'couldnt-verify' claim,
  // until the tag query itself settles.
  it('a slow-resolving searchProjectTags keeps the verdict at loading, not a terminal couldnt-verify claim', async () => {
    let resolveTags: ((tags: unknown[]) => void) | undefined;
    const tagPromise = new Promise<unknown[]>((resolve) => {
      resolveTags = resolve;
    });

    await setupMocks({
      released: true,
      fetchSourceBranchMRsImpl: () => Promise.resolve([]),
      searchProjectTagsImpl: () => tagPromise,
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.releaseBranchName).toBe('release/33.5.0'));
    await waitFor(() => expect(result.current.mergeBackVerdict.kind).toBe('loading'));
    expect(result.current.mergeBackVerdict.kind).not.toBe('couldnt-verify');

    // WR-02: the pre-fix defect was an OMITTED ARGUMENT in this hook's
    // `resolveBranchState` call, and the 91-09 tests only covered the
    // resolver forwarding a value it was handed and the sidebar rendering a
    // state it was handed. Assert the hook's own derivation here — without
    // this, deleting `tagChannel` from the call leaves the suite green.
    await waitFor(() => expect(result.current.branchState.kind).toBe('released'));
    expect(result.current.branchState).toMatchObject({ tagChannel: 'pending', tagName: null });

    // Settle the tag promise now — the row should only make the terminal
    // claim after the channel actually settles.
    act(() => {
      resolveTags?.([]);
    });

    await waitFor(() => expect(result.current.mergeBackVerdict.kind).toBe('couldnt-verify'));
    const verdict = result.current.mergeBackVerdict;
    if (verdict.kind === 'couldnt-verify') {
      expect(verdict.reason).toBe('no-mr-no-tag');
    }

    // WR-02: and the third derivation state — only NOW, after the channel
    // actually settled, may the row claim a resolved absence.
    expect(result.current.branchState).toMatchObject({ tagChannel: 'resolved', tagName: null });
  });

  it('a rejecting searchProjectTags resolves to couldnt-verify/check-failed, never no-mr-no-tag', async () => {
    await setupMocks({
      released: true,
      fetchSourceBranchMRsImpl: () => Promise.resolve([]),
      searchProjectTagsImpl: () =>
        Promise.reject(new Error('Failed to load release tags: status 500')),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.mergeBackVerdict.kind).toBe('couldnt-verify'));
    const verdict = result.current.mergeBackVerdict;
    expect(verdict.kind).not.toBe('loading');
    if (verdict.kind === 'couldnt-verify') {
      expect(verdict.reason).toBe('check-failed');
      expect(verdict.reason).not.toBe('no-mr-no-tag');
    }

    // WR-02: same gap on the failure half of the derivation — the branch row
    // must report `failed`, never a resolved absence, when the tag query
    // errored.
    await waitFor(() => expect(result.current.branchState.kind).toBe('released'));
    expect(result.current.branchState).toMatchObject({ tagChannel: 'failed', tagName: null });
  });

  it('a merged default-branch tracking MR still resolves to merged even when the tag channel fails (D-02)', async () => {
    await setupMocks({
      released: true,
      fetchProjectImpl: () => Promise.resolve({ default_branch: 'develop' }),
      fetchSourceBranchMRsImpl: () =>
        Promise.resolve([
          {
            iid: 5,
            state: 'merged',
            target_branch: 'develop',
            web_url: 'https://gitlab.example.com/mr/5',
            merged_at: '2026-07-20T00:00:00.000Z',
          },
        ]),
      searchProjectTagsImpl: () =>
        Promise.reject(new Error('Failed to load release tags: status 500')),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.mergeBackVerdict.kind).toBe('merged'));
    const verdict = result.current.mergeBackVerdict;
    if (verdict.kind === 'merged') {
      expect(verdict.via).toBe('tracking-mr');
    }
  });

  // CR-03 regression lock for the new tagLookupPending derivation: an
  // unparseable milestone title means the tag query never fires (no
  // derivable version number), so it must not be misreported as pending.
  it('an unparseable milestone title never fires searchProjectTags and still terminates', async () => {
    await setupMocks({
      released: true,
      milestoneTitle: 'Sprint planning (21.07.2026)',
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.matchedMilestone).not.toBeNull());
    await waitFor(() => expect(result.current.mergeBackVerdict.kind).not.toBe('loading'));

    const gitlab = await import('@/services/gitlab');
    expect(gitlab.searchProjectTags).not.toHaveBeenCalled();
  });

  // WR-04: every GitLab `enabled` gate also requires a token. With milestone
  // data already in cache but `readSecret('gitlab-pat')` rejecting, the tag,
  // project and tracking-MR queries are all permanently disabled — they never
  // run, so they never error either. Before this fix `tagLookupPending` and
  // step 2 both modelled only "undefined && !isError" and pinned the row at
  // Loading forever.
  it('WR-04: a rejected gitlab-pat terminates the verdict instead of pinning it at loading', async () => {
    await setupMocks({
      released: true,
      readSecretImpl: (key: string) =>
        key === 'gitlab-pat'
          ? Promise.reject(new Error('keychain locked'))
          : Promise.resolve('test-token'),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Milestone data present in cache is what makes this reachable: the match
    // resolves, so the merge-back check is attempted, while every credentialed
    // query stays disabled.
    queryClient.setQueryData(['gitlab-milestones', 42, 'all'], [makeMilestone()]);

    const { result } = renderHook(() => useReleaseDetail(VERSION_ID), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.matchedMilestone).not.toBeNull());
    await waitFor(() => expect(result.current.mergeBackVerdict.kind).not.toBe('loading'));

    const verdict = result.current.mergeBackVerdict;
    expect(verdict.kind).toBe('couldnt-verify');
    if (verdict.kind === 'couldnt-verify') {
      expect(verdict.reason).toBe('check-failed');
      expect(verdict.reason).not.toBe('no-mr-no-tag');
    }

    const gitlab = await import('@/services/gitlab');
    expect(gitlab.searchProjectTags).not.toHaveBeenCalled();
  });
});
