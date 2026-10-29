// Phase 93: fix-version-driven Releases list (D-01..D-12).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('@/services/jira', () => ({
  fetchFixVersions: vi.fn().mockResolvedValue([]),
  fetchVersionsStatusBreakdown: vi.fn().mockResolvedValue({}),
  listJiraProjects: vi.fn().mockResolvedValue([]),
}));

// Kept ONLY to assert the list never calls GitLab (D-02).
vi.mock('@/services/gitlab', () => ({
  fetchProjectMilestonesInRange: vi.fn().mockResolvedValue([]),
  fetchProjectBranches: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/release-refresh', () => ({
  refreshReleaseList: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/useRmWeekIndex', () => ({
  useRmWeekIndex: () => ({
    weeks: [],
    childToWeek: new Map(),
    enabled: false,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: 'https://gitlab.example.com',
    activeGitlabProject: 42,
  })),
}));

import { refreshReleaseList } from '@/lib/release-refresh';
import { fetchProjectBranches, fetchProjectMilestonesInRange } from '@/services/gitlab';
import { fetchFixVersions, fetchVersionsStatusBreakdown } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import ReleasesTab from './ReleasesTab';

type FV = { id: string; name: string; releaseDate: string | undefined; released: boolean };
const fv = (id: string, name: string, releaseDate: string | undefined, released = false): FV => ({
  id,
  name,
  releaseDate,
  released,
});

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
}

function renderTab(client: QueryClient = makeClient()) {
  const ui: React.ReactElement = (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ReleasesTab />
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { client, ...render(ui) };
}

const rowNames = () =>
  screen.getAllByTestId('release-row').map((r) => within(r).getByTitle(/./).textContent);

beforeEach(() => {
  vi.mocked(readSecret).mockResolvedValue('test-token');
  vi.mocked(fetchFixVersions).mockReset().mockResolvedValue([]);
  vi.mocked(fetchVersionsStatusBreakdown).mockReset().mockResolvedValue({});
  vi.mocked(refreshReleaseList).mockReset().mockResolvedValue(undefined);
  vi.mocked(fetchProjectMilestonesInRange).mockClear();
  vi.mocked(fetchProjectBranches).mockClear();
  navigateMock.mockClear();
  useBreadcrumbStore.setState({ trail: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ReleasesTab', () => {
  it('shows the empty state when there are no fix versions', async () => {
    renderTab();
    await screen.findByText('No releases yet');
    expect(
      screen.getByText(
        'Fix versions from your Jira projects will appear here once they are created.',
      ),
    ).toBeInTheDocument();
  });

  it('makes no GitLab requests and renders no GitLab affordances (D-01, D-02)', async () => {
    vi.mocked(fetchFixVersions).mockResolvedValue([fv('10001', 'Rel A', '2026-03-15')]);
    renderTab();
    await screen.findByText('Rel A');
    expect(fetchProjectMilestonesInRange).not.toHaveBeenCalled();
    expect(fetchProjectBranches).not.toHaveBeenCalled();
    expect(vi.mocked(readSecret).mock.calls.some((c) => c[0] === 'gitlab-pat')).toBe(false);
    for (const id of [
      'gitlab-link-exact',
      'gitlab-link-fuzzy',
      'gitlab-link-none',
      'row-missing-branch',
      'row-missing-milestone',
      'row-branch-present',
      'branches-error-chip',
    ]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(screen.queryByText('GitLab unavailable')).toBeNull();
  });

  it('renders the header strip and Upcoming / Released group labels (D-03)', async () => {
    vi.mocked(fetchFixVersions).mockResolvedValue([
      fv('10001', 'Up', '2099-01-01'),
      fv('10002', 'Done', '2026-01-01', true),
    ]);
    renderTab();
    await screen.findByText('Up');
    for (const t of ['Version', 'Date', 'Status', 'Issues', 'Upcoming', 'Released']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
  });

  it('omits the Upcoming label with only released versions', async () => {
    vi.mocked(fetchFixVersions).mockResolvedValue([fv('10002', 'Done', '2026-01-01', true)]);
    renderTab();
    await screen.findByText('Done');
    expect(screen.queryByText('Upcoming')).toBeNull();
  });

  it('orders rows undated, dated desc, then released desc (D-04)', async () => {
    vi.mocked(fetchFixVersions).mockResolvedValue([
      fv('10001', 'rel-2026-01', '2026-01-01', true),
      fv('10002', 'up-2026-11', '2026-11-01'),
      fv('10003', 'undated', undefined),
      fv('10004', 'rel-2026-06', '2026-06-01', true),
      fv('10005', 'up-2026-12', '2026-12-01'),
    ]);
    renderTab();
    await screen.findByText('undated');
    expect(rowNames()).toEqual([
      'undated',
      'up-2026-12',
      'up-2026-11',
      'rel-2026-06',
      'rel-2026-01',
    ]);
  });

  it('shows exactly one pill per row with the right label (D-05)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0));
    vi.mocked(fetchFixVersions).mockResolvedValue([
      fv('10001', 'undated', undefined),
      fv('10002', 'soon', '2026-11-01'),
      fv('10003', 'today', '2026-10-29'),
      fv('10004', 'late', '2026-10-01'),
      fv('10005', 'shipped', '2026-09-01', true),
    ]);
    renderTab();
    await screen.findByText('shipped');
    const pillsByName = Object.fromEntries(
      screen.getAllByTestId('release-row').map((r) => {
        const pills = within(r).getAllByTestId('release-status-pill');
        expect(pills).toHaveLength(1);
        return [within(r).getByTitle(/./).textContent, pills[0].textContent];
      }),
    );
    expect(pillsByName).toEqual({
      undated: 'No date',
      soon: 'In 3 days',
      today: 'Due today',
      late: 'Overdue',
      shipped: 'Released',
    });
  });

  it('pages released rows and fetches only revealed ids (D-08, D-11)', async () => {
    const versions = Array.from({ length: 18 }, (_, i) =>
      fv(
        String(10100 + i),
        `rel-${String(i).padStart(2, '0')}`,
        `2026-01-${String(28 - i).padStart(2, '0')}`,
        true,
      ),
    );
    vi.mocked(fetchFixVersions).mockResolvedValue(versions);
    renderTab();
    await screen.findByText('rel-00');
    expect(screen.getAllByTestId('release-row')).toHaveLength(5);
    const more = screen.getByRole('button', { name: 'Show 10 more' });

    await waitFor(() => expect(fetchVersionsStatusBreakdown).toHaveBeenCalledTimes(1));
    const firstIds = vi.mocked(fetchVersionsStatusBreakdown).mock.calls[0][2] as string[];
    expect([...firstIds].sort()).toEqual(versions.slice(0, 5).map((v) => v.id));

    fireEvent.click(more);
    await waitFor(() => expect(screen.getAllByTestId('release-row')).toHaveLength(15));
    expect(screen.getByRole('button', { name: 'Show 3 more' })).toBeInTheDocument();
    await waitFor(() => expect(fetchVersionsStatusBreakdown).toHaveBeenCalledTimes(2));
    const secondIds = vi.mocked(fetchVersionsStatusBreakdown).mock.calls[1][2] as string[];
    expect([...secondIds].sort()).toEqual(versions.slice(5, 15).map((v) => v.id));
    const hidden = versions.slice(15).map((v) => v.id);
    for (const call of vi.mocked(fetchVersionsStatusBreakdown).mock.calls) {
      for (const id of hidden) expect(call[2]).not.toContain(id);
    }
  });

  it('renders names and pills while graphs are still loading (D-09)', async () => {
    vi.mocked(fetchVersionsStatusBreakdown).mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchFixVersions).mockResolvedValue([
      fv('10001', 'Rel A', '2099-01-01'),
      fv('10002', 'Rel B', '2099-02-01'),
    ]);
    renderTab();
    await screen.findByText('Rel A');
    const rows = screen.getAllByTestId('release-row');
    expect(rows).toHaveLength(2);
    await waitFor(() => {
      for (const r of rows) {
        expect(within(r).getByTestId('release-status-pill')).toBeInTheDocument();
        expect(within(r).getByTestId('release-graph-skeleton')).toBeInTheDocument();
      }
    });
  });

  it('renders cached fix versions immediately with no skeleton (D-10)', () => {
    vi.mocked(fetchFixVersions).mockReturnValue(new Promise(() => {}));
    const client = makeClient();
    client.setQueryData(['jira-fix-versions', 'PROJ'], [fv('10001', 'Cached', '2099-01-01')]);
    renderTab(client);
    expect(screen.getAllByTestId('release-row')).toHaveLength(1);
    expect(screen.queryAllByTestId('skeleton-row')).toHaveLength(0);
  });

  it('Refresh spins, disables, calls refreshReleaseList and keeps rows (D-10)', async () => {
    let resolveRefresh: () => void = () => {};
    vi.mocked(refreshReleaseList).mockReturnValue(
      new Promise<void>((res) => {
        resolveRefresh = res;
      }),
    );
    vi.mocked(fetchFixVersions).mockResolvedValue([fv('10001', 'Rel A', '2099-01-01')]);
    renderTab();
    await screen.findByText('Rel A');
    const btn = screen.getByRole('button', { name: 'Refresh releases' });
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn.querySelector('svg')).toHaveClass('animate-spin');
    expect(refreshReleaseList).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('release-row')).toHaveLength(1);
    await act(async () => {
      resolveRefresh();
    });
    await waitFor(() => expect(btn).not.toBeDisabled());
    expect(btn.querySelector('svg')).not.toHaveClass('animate-spin');
    expect(screen.getAllByTestId('release-row')).toHaveLength(1);
  });

  it('opens a release: resets breadcrumb, pushes Releases, navigates', async () => {
    vi.mocked(fetchFixVersions).mockResolvedValue([fv('10001', 'Rel A', '2099-01-01')]);
    useBreadcrumbStore.setState({ trail: [{ path: '/x', label: 'X' }] });
    renderTab();
    await screen.findByText('Rel A');
    fireEvent.click(screen.getByRole('button', { name: 'Open release Rel A' }));
    expect(useBreadcrumbStore.getState().trail).toEqual([{ path: '/releases', label: 'Releases' }]);
    expect(navigateMock).toHaveBeenCalledWith('/release/10001');
  });
});
