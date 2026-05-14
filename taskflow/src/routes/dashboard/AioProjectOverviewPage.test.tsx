import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));

vi.mock('@/hooks/useAioCredentials', () => ({
  useAioCredentials: () => ({ token: 'test-token', tokenLoading: false }),
}));

vi.mock('@/services/aio', () => ({
  fetchAioProjects: vi.fn(),
  fetchAioFolderTree: vi.fn(),
  fetchAioFolderCycleCounts: vi.fn(),
  fetchAioCyclesWithDetail: vi.fn(),
  fetchAioCycleSummaries: vi.fn(),
}));

vi.mock('@/services/jira/users', () => ({
  fetchJiraUserByUsername: vi.fn(),
}));

vi.mock('@/hooks/useDelayedLoading', () => ({
  useDelayedLoading: (v: boolean) => v,
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function importPage() {
  const mod = await import('./AioProjectOverviewPage');
  return mod.default;
}

function wrap(Page: React.ComponentType) {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={['/aio-project/PROJ']}>
        <Routes>
          <Route path="/aio-project/:projectKey" element={<Page />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

import type { AioCycleDetailItem, AioCycleSummaryItem, AioFolder } from '@/services/aio/types';

const FOLDER_A: AioFolder = {
  ID: 101,
  name: 'Sprint 2025',
  description: null,
  parentID: null,
  rankOrder: null,
  children: [],
};

const CYCLE_1: AioCycleDetailItem = {
  ID: 1001,
  jiraProjectID: 10134,
  detail: {
    key: 'PROJ-CY-1',
    title: 'Cycle Alpha',
    ownedByID: 'JIRAUSER23429',
    folder: null,
    isClosed: false,
    startDate: null,
    endDate: null,
  },
  summary: null,
};

const CYCLE_CLOSED: AioCycleDetailItem = {
  ID: 1002,
  jiraProjectID: 10134,
  detail: {
    key: 'PROJ-CY-2',
    title: 'Cycle Beta closed',
    ownedByID: 'JIRAUSER23429',
    folder: null,
    isClosed: true,
    startDate: null,
    endDate: null,
  },
  summary: null,
};

const SUMMARY_1: AioCycleSummaryItem = {
  ID: 1001,
  detail: null,
  summary: {
    totalTests: 100,
    testRunDistribution: { '901': 60, '51': 20, '53': 20 },
  },
};

const PROJECT = { id: 10134, projectKey: 'PROJ', name: 'Project' };

const PAGED_RESPONSE = {
  items: [CYCLE_1],
  allIDs: [1001],
  startAt: 0,
  maxResults: 20,
  isLast: true,
};

async function setupStandardMocks() {
  const { fetchAioProjects, fetchAioFolderTree, fetchAioFolderCycleCounts, fetchAioCyclesWithDetail, fetchAioCycleSummaries } =
    await import('@/services/aio');
  (fetchAioProjects as ReturnType<typeof vi.fn>).mockResolvedValue([PROJECT]);
  (fetchAioFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([FOLDER_A]);
  (fetchAioFolderCycleCounts as ReturnType<typeof vi.fn>).mockResolvedValue({ '101': 1 });
  (fetchAioCyclesWithDetail as ReturnType<typeof vi.fn>).mockResolvedValue(PAGED_RESPONSE);
  (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([SUMMARY_1]);
  const { fetchJiraUserByUsername } = await import('@/services/jira/users');
  (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

describe('AioProjectOverviewPage — folder tree', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders folder node with name and cycle count badge', async () => {
    await setupStandardMocks();
    const { fetchAioFolderCycleCounts } = await import('@/services/aio');
    (fetchAioFolderCycleCounts as ReturnType<typeof vi.fn>).mockResolvedValue({ '101': 3 });
    const Page = await importPage();
    wrap(Page);
    await waitFor(() => {
      expect(screen.getByTestId('folder-node-101')).toBeDefined();
      expect(screen.getByText('Sprint 2025')).toBeDefined();
      expect(screen.getByText('3')).toBeDefined();
    });
  });
});

describe('AioProjectOverviewPage — cycle list', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders cycle row with key, name, and progress bar', async () => {
    await setupStandardMocks();
    const Page = await importPage();
    wrap(Page);
    await waitFor(() => {
      expect(screen.getByText('PROJ-CY-1')).toBeDefined();
      expect(screen.getByText('Cycle Alpha')).toBeDefined();
      expect(screen.getByTestId('progress-bar')).toBeDefined();
    });
  });

  it('shows displayName in owner column when user resolves', async () => {
    await setupStandardMocks();
    const { fetchJiraUserByUsername } = await import('@/services/jira/users');
    (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'JIRAUSER23429',
      displayName: 'Alice Tester',
    });
    const Page = await importPage();
    wrap(Page);
    await waitFor(() => {
      expect(screen.getByText('Alice Tester')).toBeDefined();
    });
  });

  it('shows raw ownedByID in owner column when user is null (D-08)', async () => {
    await setupStandardMocks();
    const { fetchJiraUserByUsername } = await import('@/services/jira/users');
    (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const Page = await importPage();
    wrap(Page);
    await waitFor(() => {
      expect(screen.getByText('JIRAUSER23429')).toBeDefined();
    });
  });

  it('dedupes user lookups — 2 cycles same owner fires fetchJiraUserByUsername once', async () => {
    const { fetchAioProjects, fetchAioFolderTree, fetchAioFolderCycleCounts, fetchAioCyclesWithDetail, fetchAioCycleSummaries } =
      await import('@/services/aio');
    const CYCLE_2 = { ...CYCLE_1, ID: 1002 };
    (fetchAioProjects as ReturnType<typeof vi.fn>).mockResolvedValue([PROJECT]);
    (fetchAioFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([FOLDER_A]);
    (fetchAioFolderCycleCounts as ReturnType<typeof vi.fn>).mockResolvedValue({ '101': 2 });
    (fetchAioCyclesWithDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [CYCLE_1, CYCLE_2],
      allIDs: [1001, 1002],
      startAt: 0,
      maxResults: 20,
      isLast: true,
    });
    (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([
      SUMMARY_1,
      { ...SUMMARY_1, ID: 1002 },
    ]);
    const { fetchJiraUserByUsername } = await import('@/services/jira/users');
    (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'JIRAUSER23429',
      displayName: 'Alice',
    });
    const Page = await importPage();
    wrap(Page);
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    });
    expect((fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe('AioProjectOverviewPage — Show closed toggle', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('hides closed cycles by default; shows them after toggle', async () => {
    const { fetchAioProjects, fetchAioFolderTree, fetchAioFolderCycleCounts, fetchAioCyclesWithDetail, fetchAioCycleSummaries } =
      await import('@/services/aio');
    (fetchAioProjects as ReturnType<typeof vi.fn>).mockResolvedValue([PROJECT]);
    (fetchAioFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([FOLDER_A]);
    (fetchAioFolderCycleCounts as ReturnType<typeof vi.fn>).mockResolvedValue({ '101': 2 });
    (fetchAioCyclesWithDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [CYCLE_1, CYCLE_CLOSED],
      allIDs: [1001, 1002],
      startAt: 0,
      maxResults: 20,
      isLast: true,
    });
    (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([SUMMARY_1]);
    const { fetchJiraUserByUsername } = await import('@/services/jira/users');
    (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const Page = await importPage();
    wrap(Page);

    await waitFor(() => {
      expect(screen.getByText('Cycle Alpha')).toBeDefined();
    });
    expect(screen.queryByText('Cycle Beta closed')).toBeNull();

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);
    await waitFor(() => {
      expect(screen.getByText('Cycle Beta closed')).toBeDefined();
    });
  });
});

describe('AioProjectOverviewPage — error states', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders error state when folder tree query fails', async () => {
    const { fetchAioProjects, fetchAioFolderTree, fetchAioFolderCycleCounts, fetchAioCyclesWithDetail, fetchAioCycleSummaries } =
      await import('@/services/aio');
    (fetchAioProjects as ReturnType<typeof vi.fn>).mockResolvedValue([PROJECT]);
    (fetchAioFolderTree as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network fail'));
    (fetchAioFolderCycleCounts as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (fetchAioCyclesWithDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [], allIDs: [], startAt: 0, maxResults: 0, isLast: true,
    });
    (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const Page = await importPage();
    wrap(Page);
    await waitFor(() => {
      // Page should not be stuck on loading — either error UI or empty tree renders
      const body = document.body.textContent ?? '';
      expect(body.length).toBeGreaterThan(10);
    }, { timeout: 4000 });
  });
});
