// PM-03: Fix version rows with date and GitLab release links
// PM-04: Completion status per fix version row

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

// Mock jira service
vi.mock('@/services/jira', () => ({
  fetchFixVersions: vi.fn().mockResolvedValue([]),
  fetchVersionIssueCounts: vi.fn().mockResolvedValue({ issuesFixed: 0, issuesTotal: 0 }),
}));

// Mock gitlab service
vi.mock('@/services/gitlab', () => ({
  fetchProjectMilestonesInRange: vi.fn().mockResolvedValue([]),
  fetchProjectTags: vi.fn().mockResolvedValue([]),
  fetchProjectBranches: vi.fn().mockResolvedValue([]),
}));

// Mock releaseLinker
vi.mock('@/services/releaseLinker', () => ({
  matchGitLabToFixVersion: vi
    .fn()
    .mockReturnValue({ type: 'none', candidateName: '', candidateUrl: '' }),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: 'https://gitlab.example.com',
    activeGitlabProject: 42,
  })),
}));

// Mock the internal fetch for group projects and version issue counts
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }),
}));

function makeFixVersion(id: string, name: string, releaseDate: string | undefined) {
  return { id, name, releaseDate, released: false };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ReleasesTab', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-establish mock implementations after clearAllMocks
    const stronghold = await import('@/services/stronghold');
    vi.mocked(stronghold.readSecret).mockResolvedValue('test-token');
    const { fetch: mockFetch } = await import('@tauri-apps/plugin-http');
    vi.mocked(mockFetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([]);
    const { fetchProjectMilestonesInRange, fetchProjectTags, fetchProjectBranches } = await import(
      '@/services/gitlab'
    );
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([]);
    vi.mocked(fetchProjectTags).mockResolvedValue([]);
    vi.mocked(fetchProjectBranches).mockResolvedValue([]);
    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'none',
      candidateName: '',
      candidateUrl: '',
    });
  });

  it('renders empty state when no fix versions exist', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([]);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText(/no releases found/i);
  });

  it('renders fix version rows with name and release date', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v2.1.0', '2026-03-15')]);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v2.1.0');
    expect(screen.getByText('2026-03-15')).toBeTruthy();
  });

  it('shows linked GitLab milestone name for exact date match', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v2.1.0', '2026-03-15')]);

    // Provide a milestone so the matching function is called with a candidate
    const { fetchProjectMilestonesInRange } = await import('@/services/gitlab');
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([
      {
        id: 1,
        iid: 1,
        title: 'sprint-15',
        description: null,
        start_date: null,
        due_date: '2026-03-15',
        state: 'active',
        web_url: 'https://gitlab.example.com/milestone/1',
      },
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'exact',
      candidateName: 'sprint-15',
      candidateUrl: 'https://gitlab.example.com/milestone/1',
    });

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    // Wait for milestone data to load (sequentially after fix versions)
    const link = await screen.findByTestId('gitlab-link-exact');
    expect(link).not.toBeNull();
    expect(link.textContent).toBe('sprint-15');
  });

  it('shows dashed border indicator for fuzzy date match', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v2.1.0', '2026-03-15')]);

    // Provide a milestone candidate so the matching function is invoked
    const { fetchProjectMilestonesInRange } = await import('@/services/gitlab');
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([
      {
        id: 1,
        iid: 1,
        title: 'sprint-15',
        description: null,
        start_date: null,
        due_date: '2026-03-14',
        state: 'active',
        web_url: 'https://gitlab.example.com/milestone/1',
      },
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'fuzzy',
      candidateName: 'sprint-15',
      candidateUrl: 'https://gitlab.example.com/milestone/1',
    });

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    // Wait for milestone data to load (sequentially after fix versions)
    const fuzzyLink = await screen.findByTestId('gitlab-link-fuzzy');
    expect(fuzzyLink).not.toBeNull();
    expect(fuzzyLink.textContent).toBe('sprint-15');
    expect(fuzzyLink.className).toContain('border-dashed');
  });

  it('shows No GitLab link label when no match within 1 day', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v2.1.0', '2026-03-15')]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'none',
      candidateName: '',
      candidateUrl: '',
    });

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v2.1.0');
    expect(screen.getByText('No GitLab milestone')).toBeTruthy();
  });

  it('shows No GitLab link when fix version has no releaseDate', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v2.0.0', undefined)]);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v2.0.0');
    expect(screen.getByText('No GitLab milestone')).toBeTruthy();
  });

  it('shows task count and completion status per fix version row', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v2.1.0', '2026-03-15')]);

    // Counts come from the shared `fetchVersionIssueCounts` in services/jira.ts — the same
    // producer `useReleaseDetail.ts` uses, so both writers of the `jira-version-counts` cache
    // key agree on shape (87-REVIEW WR-01). Mock the service, not the transport.
    const { fetchVersionIssueCounts } = await import('@/services/jira');
    vi.mocked(fetchVersionIssueCounts).mockResolvedValue({ issuesFixed: 3, issuesTotal: 8 });

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v2.1.0');
    // Should show "3 / 8 done" (issuesFixed / JQL total)
    await screen.findByText(/3\s*\/\s*8\s*done/i);
  });
});

describe('REL-01: sort order', () => {
  it('renders releases newest-to-oldest by releaseDate', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'Release A', '2026-01-01'),
      makeFixVersion('v2', 'Release B', '2026-03-15'),
      makeFixVersion('v3', 'Release C', '2025-12-01'),
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ReleasesTab />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const rows = await screen.findAllByTestId('release-row');
    const names = rows.map((r) => r.getAttribute('data-name') ?? r.textContent ?? '');
    // Expect newest first: B (2026-03-15), A (2026-01-01), C (2025-12-01)
    expect(names[0]).toContain('Release B');
    expect(names[1]).toContain('Release A');
    expect(names[2]).toContain('Release C');
  });

  it('undated releases appear at top of list with "No date set" warning', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'No Date Release', undefined),
      makeFixVersion('v2', 'Dated Release', '2026-03-15'),
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ReleasesTab />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const rows = await screen.findAllByTestId('release-row');
    expect(rows[0].textContent).toContain('No Date Release');
    expect(rows[0].textContent).toContain('No date set');
    expect(rows[1].textContent).toContain('Dated Release');
  });
});

describe('REL-02: status badges', () => {
  it('released version shows Released badge', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      { id: 'v1', name: 'v1.0.0', releaseDate: '2026-01-01', released: true },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ReleasesTab />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByText('v1.0.0');
    expect(screen.getByText('Released')).toBeTruthy();
  });

  it('unreleased version shows Unreleased badge', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v2.0.0', '2026-06-01')]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ReleasesTab />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByText('v2.0.0');
    expect(screen.getByText('Unreleased')).toBeTruthy();
  });
});

describe('REL-03: timing labels', () => {
  it('past-date unreleased shows Overdue label', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'Past Release', pastDate)]);
    void today; // used for reference

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ReleasesTab />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByText('Past Release');
    expect(screen.getByText(/overdue/i)).toBeTruthy();
  });

  it('same-day unreleased shows Due today label', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'Today Release', today)]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ReleasesTab />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByText('Today Release');
    expect(screen.getByText(/due today/i)).toBeTruthy();
  });

  it('future unreleased shows In X days label', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'Future Release', futureDate),
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ReleasesTab />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByText('Future Release');
    expect(screen.getByText(/in \d+ days/i)).toBeTruthy();
  });
});

describe('release-row drift indicators (D-17/D-18/D-19)', () => {
  it('fetches the release branch set exactly once, filtered by the release/ prefix', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'v33.5.0', '2026-07-21'),
      makeFixVersion('v2', 'v33.6.0', '2026-08-01'),
      makeFixVersion('v3', 'v33.7.0', '2026-08-15'),
    ]);

    const { fetchProjectBranches } = await import('@/services/gitlab');
    vi.mocked(fetchProjectBranches).mockResolvedValue([]);
    // Guard against cross-test bleed: earlier tests' components may still have
    // in-flight promises resolving on the shared module mock when this test's
    // render begins. Clear synchronously right before render (before any
    // await yields to the microtask queue) so only this render's real calls
    // are counted below.
    vi.mocked(fetchProjectBranches).mockClear();

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v33.5.0');

    expect(fetchProjectBranches).toHaveBeenCalledTimes(1);
    expect(fetchProjectBranches).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      'release/',
    );
  });

  it('shows the missing-branch indicator when the derived branch name is absent from the fetched set', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v33.5.0', '2026-07-21')]);

    // Provide a milestone candidate so matchGitLabToFixVersion (mocked below) is invoked
    const { fetchProjectMilestonesInRange, fetchProjectBranches } = await import(
      '@/services/gitlab'
    );
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([
      {
        id: 1,
        iid: 1,
        title: '33.5.0 (21.07.2026)',
        description: null,
        start_date: null,
        due_date: '2026-07-21',
        state: 'active',
        web_url: 'https://gitlab.example.com/milestone/1',
      },
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'exact',
      candidateName: '33.5.0 (21.07.2026)',
      candidateUrl: 'https://gitlab.example.com/milestone/1',
    });

    vi.mocked(fetchProjectBranches).mockResolvedValue([]);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    const icon = await screen.findByTestId('row-missing-branch');
    expect(icon.getAttribute('title')).toBe('No release branch');
  });

  it('shows a green branch icon when the release branch exists', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v33.5.0', '2026-07-21')]);

    const { fetchProjectMilestonesInRange, fetchProjectBranches } = await import(
      '@/services/gitlab'
    );
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([
      {
        id: 1,
        iid: 1,
        title: '33.5.0 (21.07.2026)',
        description: null,
        start_date: null,
        due_date: '2026-07-21',
        state: 'active',
        web_url: 'https://gitlab.example.com/milestone/1',
      },
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'exact',
      candidateName: '33.5.0 (21.07.2026)',
      candidateUrl: 'https://gitlab.example.com/milestone/1',
    });

    vi.mocked(fetchProjectBranches).mockResolvedValue([
      { name: 'release/33.5.0', merged: false, protected: false, default: false, web_url: '' },
    ] as unknown as Awaited<ReturnType<typeof fetchProjectBranches>>);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    const icon = await screen.findByTestId('row-branch-present');
    expect(icon.getAttribute('title')).toBe('Release branch release/33.5.0');
    expect(screen.queryByTestId('row-missing-branch')).not.toBeInTheDocument();
  });

  it('shows no branch indicator at all when no milestone matched', async () => {
    // The branch name is derived from the milestone title, so with no milestone
    // there is no branch to have an opinion about — neither present nor missing.
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v33.5.0', '2026-07-21')]);

    const { fetchProjectMilestonesInRange, fetchProjectBranches } = await import(
      '@/services/gitlab'
    );
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'none',
      candidateName: '',
      candidateUrl: '',
    });

    vi.mocked(fetchProjectBranches).mockResolvedValue([]);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    // The merged milestone warning carries the whole signal on its own.
    await screen.findByTestId('row-missing-milestone');
    expect(screen.queryByTestId('row-missing-branch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-branch-present')).not.toBeInTheDocument();
    // And the old duplicate muted label is gone.
    expect(screen.queryByTestId('gitlab-link-none')).not.toBeInTheDocument();
  });

  it('does not show the missing-branch indicator for a RELEASED version', async () => {
    // Release branches are deleted once merged, so every historical release
    // would otherwise report "No release branch" forever — noise that buries
    // the signal for the unreleased versions this indicator polices.
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      { id: 'v1', name: 'v33.5.0', releaseDate: '2026-07-21', released: true },
    ]);

    const { fetchProjectMilestonesInRange, fetchProjectBranches } = await import(
      '@/services/gitlab'
    );
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([
      {
        id: 1,
        iid: 1,
        title: '33.5.0 (21.07.2026)',
        description: null,
        start_date: null,
        due_date: '2026-07-21',
        state: 'closed',
        web_url: 'https://gitlab.example.com/milestone/1',
      },
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'exact',
      candidateName: '33.5.0 (21.07.2026)',
      candidateUrl: 'https://gitlab.example.com/milestone/1',
    });

    // Branch genuinely absent — the merged-and-deleted end state.
    vi.mocked(fetchProjectBranches).mockResolvedValue([]);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText(/33\.5\.0/);
    expect(screen.queryByTestId('row-missing-branch')).not.toBeInTheDocument();
  });

  it('does not show the missing-branch indicator while the branch query is still in flight', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v33.5.0', '2026-07-21')]);

    const { fetchProjectMilestonesInRange, fetchProjectBranches } = await import(
      '@/services/gitlab'
    );
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([
      {
        id: 1,
        iid: 1,
        title: '33.5.0 (21.07.2026)',
        description: null,
        start_date: null,
        due_date: '2026-07-21',
        state: 'active',
        web_url: 'https://gitlab.example.com/milestone/1',
      },
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'exact',
      candidateName: '33.5.0 (21.07.2026)',
      candidateUrl: 'https://gitlab.example.com/milestone/1',
    });

    // Never resolves — simulates an in-flight query.
    vi.mocked(fetchProjectBranches).mockReturnValue(new Promise(() => {}));

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v33.5.0');
    expect(screen.queryByTestId('row-missing-branch')).toBeNull();
  });

  it('shows a GitLab-unavailable chip and hides the missing-branch indicator when the branch query errors', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v33.5.0', '2026-07-21')]);

    const { fetchProjectMilestonesInRange, fetchProjectBranches } = await import(
      '@/services/gitlab'
    );
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([
      {
        id: 1,
        iid: 1,
        title: '33.5.0 (21.07.2026)',
        description: null,
        start_date: null,
        due_date: '2026-07-21',
        state: 'active',
        web_url: 'https://gitlab.example.com/milestone/1',
      },
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'exact',
      candidateName: '33.5.0 (21.07.2026)',
      candidateUrl: 'https://gitlab.example.com/milestone/1',
    });

    vi.mocked(fetchProjectBranches).mockRejectedValue(new Error('boom'));

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v33.5.0');
    expect(screen.queryByTestId('row-missing-branch')).toBeNull();
    await screen.findByTestId('branches-error-chip');
  });

  it('hides the missing-branch indicator when the derived branch name is present in the fetched set', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([makeFixVersion('v1', 'v33.5.0', '2026-07-21')]);

    // Provide a milestone candidate so matchGitLabToFixVersion (mocked below) is invoked
    const { fetchProjectMilestonesInRange, fetchProjectBranches } = await import(
      '@/services/gitlab'
    );
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([
      {
        id: 1,
        iid: 1,
        title: '33.5.0 (21.07.2026)',
        description: null,
        start_date: null,
        due_date: '2026-07-21',
        state: 'active',
        web_url: 'https://gitlab.example.com/milestone/1',
      },
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'exact',
      candidateName: '33.5.0 (21.07.2026)',
      candidateUrl: 'https://gitlab.example.com/milestone/1',
    });

    vi.mocked(fetchProjectBranches).mockResolvedValue([
      {
        name: 'release/33.5.0',
        web_url: 'https://gitlab.example.com/branch/release%2F33.5.0',
        merged: false,
        protected: false,
        commit: { id: 'abc123', short_id: 'abc123' },
      },
    ]);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v33.5.0');
    await waitFor(() => {
      expect(screen.queryByTestId('row-missing-branch')).toBeNull();
    });
  });
});
