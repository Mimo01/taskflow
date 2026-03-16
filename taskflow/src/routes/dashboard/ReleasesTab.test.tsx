// PM-03: Fix version rows with date and GitLab release links
// PM-04: Completion status per fix version row
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

// Mock jira service
vi.mock('@/services/jira', () => ({
  fetchFixVersions: vi.fn().mockResolvedValue([]),
}));

// Mock gitlab service
vi.mock('@/services/gitlab', () => ({
  fetchProjectMilestonesInRange: vi.fn().mockResolvedValue([]),
  fetchProjectTags: vi.fn().mockResolvedValue([]),
}));

// Mock releaseLinker
vi.mock('@/services/releaseLinker', () => ({
  matchGitLabToFixVersion: vi.fn().mockReturnValue({ type: 'none', candidateName: '', candidateUrl: '' }),
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

function makeFixVersion(
  id: string,
  name: string,
  releaseDate: string | undefined,
) {
  return { id, name, releaseDate, released: false };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
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
    const { fetchProjectMilestonesInRange, fetchProjectTags } = await import('@/services/gitlab');
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([]);
    vi.mocked(fetchProjectTags).mockResolvedValue([]);
    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({ type: 'none', candidateName: '', candidateUrl: '' });
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
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'v2.1.0', '2026-03-15'),
    ]);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v2.1.0');
    expect(screen.getByText('2026-03-15')).toBeTruthy();
  });

  it('shows linked GitLab milestone name for exact date match', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'v2.1.0', '2026-03-15'),
    ]);

    // Provide a milestone so the matching function is called with a candidate
    const { fetchProjectMilestonesInRange } = await import('@/services/gitlab');
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([
      { id: 1, iid: 1, title: 'sprint-15', start_date: null, due_date: '2026-03-15', state: 'active', web_url: 'https://gitlab.example.com/milestone/1' },
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
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'v2.1.0', '2026-03-15'),
    ]);

    // Provide a milestone candidate so the matching function is invoked
    const { fetchProjectMilestonesInRange } = await import('@/services/gitlab');
    vi.mocked(fetchProjectMilestonesInRange).mockResolvedValue([
      { id: 1, iid: 1, title: 'sprint-15', start_date: null, due_date: '2026-03-14', state: 'active', web_url: 'https://gitlab.example.com/milestone/1' },
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
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'v2.1.0', '2026-03-15'),
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({ type: 'none', candidateName: '', candidateUrl: '' });

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v2.1.0');
    expect(screen.getByText('No GitLab link')).toBeTruthy();
  });

  it('shows No GitLab link when fix version has no releaseDate', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'v2.0.0', undefined),
    ]);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v2.0.0');
    expect(screen.getByText('No GitLab link')).toBeTruthy();
  });

  it('shows task count and completion status per fix version row', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'v2.1.0', '2026-03-15'),
    ]);

    // fetchVersionIssueCounts makes two parallel JQL search calls:
    //   1. GET /rest/api/2/search?jql=fixVersion=...&maxResults=0 → { total: 8 } (all issues)
    //   2. GET /rest/api/2/search?jql=fixVersion=...+AND+statusCategory=Done&maxResults=0 → { total: 3 }
    // We distinguish by checking for statusCategory in the URL.
    const { fetch: mockFetch } = await import('@tauri-apps/plugin-http');
    vi.mocked(mockFetch).mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('statusCategory')) {
        // Done-only JQL endpoint → total=3 fixed
        return { ok: true, json: async () => ({ total: 3 }) } as Response;
      }
      // Total JQL endpoint → total=8 (all issues in fix version)
      return { ok: true, json: async () => ({ total: 8 }) } as Response;
    });

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

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(<QueryClientProvider client={queryClient}><ReleasesTab /></QueryClientProvider>);

    const rows = await screen.findAllByTestId('release-row');
    const names = rows.map(r => r.getAttribute('data-name') ?? r.textContent ?? '');
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

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(<QueryClientProvider client={queryClient}><ReleasesTab /></QueryClientProvider>);

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

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(<QueryClientProvider client={queryClient}><ReleasesTab /></QueryClientProvider>);

    await screen.findByText('v1.0.0');
    expect(screen.getByText('Released')).toBeTruthy();
  });

  it('unreleased version shows Unreleased badge', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'v2.0.0', '2026-06-01'),
    ]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(<QueryClientProvider client={queryClient}><ReleasesTab /></QueryClientProvider>);

    await screen.findByText('v2.0.0');
    expect(screen.getByText('Unreleased')).toBeTruthy();
  });
});

describe('REL-03: timing labels', () => {
  it('past-date unreleased shows Overdue label', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'Past Release', pastDate),
    ]);
    void today; // used for reference

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(<QueryClientProvider client={queryClient}><ReleasesTab /></QueryClientProvider>);

    await screen.findByText('Past Release');
    expect(screen.getByText(/overdue/i)).toBeTruthy();
  });

  it('same-day unreleased shows Due today label', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'Today Release', today),
    ]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(<QueryClientProvider client={queryClient}><ReleasesTab /></QueryClientProvider>);

    await screen.findByText('Today Release');
    expect(screen.getByText(/due today/i)).toBeTruthy();
  });

  it('future unreleased shows In X days label', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'Future Release', futureDate),
    ]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    const { default: ReleasesTab } = await import('./ReleasesTab');
    render(<QueryClientProvider client={queryClient}><ReleasesTab /></QueryClientProvider>);

    await screen.findByText('Future Release');
    expect(screen.getByText(/in \d+ days/i)).toBeTruthy();
  });
});
