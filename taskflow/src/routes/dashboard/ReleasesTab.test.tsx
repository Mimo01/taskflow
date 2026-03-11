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
  fetchGroupMilestones: vi.fn().mockResolvedValue([]),
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
    activeGitlabGroup: 'my-org/team',
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
    const { fetchGroupMilestones, fetchProjectTags } = await import('@/services/gitlab');
    vi.mocked(fetchGroupMilestones).mockResolvedValue([]);
    vi.mocked(fetchProjectTags).mockResolvedValue([]);
    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({ type: 'none', candidateName: '', candidateUrl: '' });
  });

  it('renders empty state when no fix versions exist', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([]);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText(/no fix versions configured/i);
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
    const { fetchGroupMilestones } = await import('@/services/gitlab');
    vi.mocked(fetchGroupMilestones).mockResolvedValue([
      { id: 1, iid: 1, title: 'sprint-15', due_date: '2026-03-15', state: 'active', web_url: 'https://gitlab.example.com/milestone/1' },
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'exact',
      candidateName: 'sprint-15',
      candidateUrl: 'https://gitlab.example.com/milestone/1',
    });

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v2.1.0');
    // Exact match shows as a link
    const link = document.querySelector('[data-testid="gitlab-link-exact"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe('sprint-15');
  });

  it('shows dashed border indicator for fuzzy date match', async () => {
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion('v1', 'v2.1.0', '2026-03-15'),
    ]);

    // Provide a milestone candidate so the matching function is invoked
    const { fetchGroupMilestones } = await import('@/services/gitlab');
    vi.mocked(fetchGroupMilestones).mockResolvedValue([
      { id: 1, iid: 1, title: 'sprint-15', due_date: '2026-03-14', state: 'active', web_url: 'https://gitlab.example.com/milestone/1' },
    ]);

    const { matchGitLabToFixVersion } = await import('@/services/releaseLinker');
    vi.mocked(matchGitLabToFixVersion).mockReturnValue({
      type: 'fuzzy',
      candidateName: 'sprint-15',
      candidateUrl: 'https://gitlab.example.com/milestone/1',
    });

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v2.1.0');
    // Fuzzy match shows with dashed underline
    const fuzzyLink = document.querySelector('[data-testid="gitlab-link-fuzzy"]');
    expect(fuzzyLink).not.toBeNull();
    expect(fuzzyLink?.textContent).toBe('sprint-15');
    expect(fuzzyLink?.className).toContain('border-dashed');
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

    // Mock the fetch call for version issue counts to return 3 fixed + 5 affected = 8 total
    const { fetch: mockFetch } = await import('@tauri-apps/plugin-http');
    vi.mocked(mockFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ issuesFixed: 3, issuesAffected: 5 }),
    } as Response);

    const { default: ReleasesTab } = await import('./ReleasesTab');
    renderWithQuery(<ReleasesTab />);

    await screen.findByText('v2.1.0');
    // Should show "3 / 8 done"
    await screen.findByText(/3\s*\/\s*8\s*done/i);
  });
});
