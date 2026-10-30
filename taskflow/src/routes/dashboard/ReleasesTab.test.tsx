// Phase 93: F5 fix-version-driven Releases page (D-01..D-12).

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

const rowKinds = () => screen.getAllByTestId('release-row').map((r) => r.dataset.kind);
const rowNameOf = (r: HTMLElement) => within(r).getAllByTitle(/./)[0].textContent;
const rowNames = () => screen.getAllByTestId('release-row').map(rowNameOf);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0));
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

const MIXED = [
  fv('10001', 'rel-old', '2026-09-01', true),
  fv('10002', 'planned-far-b', '2026-12-10'),
  fv('10003', 'undated', undefined),
  fv('10004', 'near', '2026-11-05'),
  fv('10005', 'overdue', '2026-10-20'),
  fv('10006', 'next', '2026-11-01'),
  fv('10007', 'planned-far-a', '2026-11-20'),
];

const releasedVersions = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    fv(
      String(10100 + i),
      `rel-${String(i).padStart(2, '0')}`,
      `2026-09-${String(28 - (i % 28)).padStart(2, '0')}`,
      true,
    ),
  );

describe('ReleasesTab (F5)', () => {
  it('shows the hero and the empty state when there are no fix versions', async () => {
    renderTab();
    await screen.findByText('No releases yet');
    expect(screen.getByRole('heading', { name: 'Releases' })).toBeInTheDocument();
    expect(screen.queryByTestId('release-row')).toBeNull();
    expect(screen.queryByTestId('released-row')).toBeNull();
  });

  it('makes no GitLab requests and renders no GitLab affordances (D-01, D-02)', async () => {
    vi.mocked(fetchFixVersions).mockResolvedValue([fv('10001', 'Rel A', '2026-11-15')]);
    renderTab();
    await screen.findAllByTestId('release-row');
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

  it('orders rail rows overdue, next, near, planned, undated; released leave the rail', async () => {
    vi.mocked(fetchFixVersions).mockResolvedValue(MIXED);
    renderTab();
    await screen.findAllByTestId('release-row');
    expect(rowKinds()).toEqual(['overdue', 'next', 'near', 'planned', 'planned', 'undated']);
    expect(rowNames()).not.toContain('rel-old');
    const released = screen.getAllByTestId('released-row');
    expect(released).toHaveLength(1);
    expect(released[0]).toHaveAttribute('title', 'rel-old');
  });

  it('puts pills on key rows and plain timing text on planned rows', async () => {
    vi.mocked(fetchFixVersions).mockResolvedValue(MIXED);
    renderTab();
    const rows = await screen.findAllByTestId('release-row');
    for (const r of rows) {
      if (r.dataset.kind === 'planned') {
        expect(within(r).queryByTestId('release-status-pill')).toBeNull();
        expect(within(r).getByTestId('release-timing-text')).toBeInTheDocument();
      } else {
        expect(within(r).getAllByTestId('release-status-pill').length).toBeGreaterThan(0);
      }
    }
  });

  it('summarises the fixture counts in the hero', async () => {
    vi.mocked(fetchFixVersions).mockResolvedValue(MIXED);
    renderTab();
    await screen.findAllByTestId('release-row');
    const summary = screen.getByTestId('releases-summary');
    expect(
      within(summary)
        .getAllByTestId('releases-stat')
        .map((el) => el.textContent),
    ).toEqual(['5 planned', '1 overdue', '1 without date', 'last shipped 8 weeks ago']);
    expect(summary.textContent).not.toContain('next');
  });

  it('shows 3 released rows, reveals 10 more and fetches only the revealed ids (D-08, D-11)', async () => {
    const versions = releasedVersions(20);
    vi.mocked(fetchFixVersions).mockResolvedValue(versions);
    renderTab();
    await screen.findAllByTestId('released-row');
    expect(screen.getAllByTestId('released-row')).toHaveLength(3);

    await waitFor(() => expect(fetchVersionsStatusBreakdown).toHaveBeenCalledTimes(1));
    const firstIds = vi.mocked(fetchVersionsStatusBreakdown).mock.calls[0][2] as string[];
    expect(firstIds).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /Show older releases/ }));
    await waitFor(() => expect(screen.getAllByTestId('released-row')).toHaveLength(13));
    await waitFor(() => expect(fetchVersionsStatusBreakdown).toHaveBeenCalledTimes(2));
    const secondIds = vi.mocked(fetchVersionsStatusBreakdown).mock.calls[1][2] as string[];
    expect(secondIds).toHaveLength(10);
    const seen = new Set([...firstIds, ...secondIds]);
    expect(seen.size).toBe(13);
    // Only revealed rows were ever requested: every requested id is a visible row.
    const shown = screen
      .getAllByTestId('released-row')
      .map((r) => versions.find((v) => v.name === r.getAttribute('title'))?.id);
    expect([...seen].sort()).toEqual([...(shown as string[])].sort());
  });

  it('expands only planned rows with issues when breakdowns arrive (D-09 relaxed at UAT)', async () => {
    let resolveBatch: (v: Record<string, unknown>) => void = () => {};
    vi.mocked(fetchVersionsStatusBreakdown).mockReturnValue(
      new Promise((res) => {
        resolveBatch = res as typeof resolveBatch;
      }),
    );
    vi.mocked(fetchFixVersions).mockResolvedValue(MIXED);
    renderTab();
    const rows = await screen.findAllByTestId('release-row');
    await waitFor(() => {
      for (const r of rows) {
        expect(within(r).getAllByTitle(/./).length).toBeGreaterThan(0);
      }
    });
    const quietBy = () =>
      Object.fromEntries(
        screen
          .getAllByTestId('release-row')
          .map((r) => [r.dataset.kind + rowNameOf(r), r.dataset.quiet]),
      );
    const before = quietBy();
    expect(before['plannedplanned-far-a']).toBe('true');
    expect(before['plannedplanned-far-b']).toBe('true');

    await act(async () => {
      // planned-far-a has issues and expands; planned-far-b is empty and stays quiet.
      resolveBatch({
        '10002': { new: 0, indeterminate: 0, done: 0, assignees: [] },
        '10007': { new: 2, indeterminate: 0, done: 0, assignees: [] },
        '10006': { new: 1, indeterminate: 1, done: 1, assignees: [] },
      });
    });
    await waitFor(() => expect(quietBy()['plannedplanned-far-a']).toBe('false'));
    expect(quietBy()).toEqual({ ...before, 'plannedplanned-far-a': 'false' });
  });

  it('renders cached fix versions immediately with no skeleton (D-10)', () => {
    vi.mocked(fetchFixVersions).mockReturnValue(new Promise(() => {}));
    const client = makeClient();
    client.setQueryData(['jira-fix-versions', 'PROJ'], [fv('10001', 'Cached', '2026-11-15')]);
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
    vi.mocked(fetchFixVersions).mockResolvedValue([fv('10001', 'Rel A', '2026-11-15')]);
    renderTab();
    await screen.findAllByTestId('release-row');
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

  it('opens a release from a rail row and a released row', async () => {
    vi.mocked(fetchFixVersions).mockResolvedValue([
      fv('10001', 'Rel A', '2026-11-15'),
      fv('10002', 'Rel Z', '2026-09-01', true),
    ]);
    renderTab();
    const rows = await screen.findAllByTestId('release-row');
    const seed = () => useBreadcrumbStore.setState({ trail: [{ path: '/x', label: 'X' }] });
    const expectBreadcrumb = () =>
      expect(useBreadcrumbStore.getState().trail).toEqual([
        { path: '/releases', label: 'Releases' },
      ]);

    seed();
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Open release Rel A' }));
    expectBreadcrumb();
    expect(navigateMock).toHaveBeenLastCalledWith('/release/10001');

    seed();
    fireEvent.click(screen.getByTestId('released-row'));
    expectBreadcrumb();
    expect(navigateMock).toHaveBeenLastCalledWith('/release/10002');
  });
});
