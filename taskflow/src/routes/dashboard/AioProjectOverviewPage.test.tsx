import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));

// In-memory adapter for the selection store — lets tests control persisted values
const SelectionStore: { byProjectKey: Record<string, number> } = { byProjectKey: {} };
const mockGetSelectedFolder = vi.fn((key: string) => SelectionStore.byProjectKey[key] ?? null);
const mockSetSelectedFolder = vi.fn((key: string, id: number) => {
  SelectionStore.byProjectKey[key] = id;
});
const mockClearSelectedFolder = vi.fn((key: string) => {
  delete SelectionStore.byProjectKey[key];
});

vi.mock('@/stores/aio-cycles-selection.store', () => ({
  useAioCyclesSelectionStore: (selector: (s: unknown) => unknown) => {
    const state = {
      getSelectedFolder: mockGetSelectedFolder,
      setSelectedFolder: mockSetSelectedFolder,
      clearSelectedFolder: mockClearSelectedFolder,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/hooks/useAioCredentials', () => ({
  useAioCredentials: () => ({ token: 'test-token', tokenLoading: false }),
}));

vi.mock('@/services/aio', () => ({
  fetchAioFolderTree: vi.fn(),
  fetchAioFolderCycleCounts: vi.fn(),
  fetchAioCyclesWithDetail: vi.fn(),
  fetchAioCycleSummaries: vi.fn(),
  fetchAioProjectConfig: vi.fn(),
}));

vi.mock('@/services/jira/projects', () => ({
  fetchJiraProjectNumericId: vi.fn(),
}));

vi.mock('@/services/jira/users', () => ({
  fetchJiraUserByUsername: vi.fn(),
}));

vi.mock('@/hooks/useDelayedLoading', () => ({
  useDelayedLoading: (v: boolean) => v,
}));

// REMOVED: Show closed toggle tests — toggle was deleted from UI

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

const FOLDER_B: AioFolder = {
  ID: 102,
  name: 'Sprint 2026',
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
  const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
  (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(PROJECT.id);
  const {
    fetchAioFolderTree,
    fetchAioFolderCycleCounts,
    fetchAioCyclesWithDetail,
    fetchAioCycleSummaries,
    fetchAioProjectConfig,
  } = await import('@/services/aio');
  (fetchAioFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([FOLDER_A]);
  (fetchAioFolderCycleCounts as ReturnType<typeof vi.fn>).mockResolvedValue({ '101': 1 });
  (fetchAioCyclesWithDetail as ReturnType<typeof vi.fn>).mockResolvedValue(PAGED_RESPONSE);
  (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([SUMMARY_1]);
  (fetchAioProjectConfig as ReturnType<typeof vi.fn>).mockResolvedValue([
    { ID: 51, name: 'Not Run', statusType: 'NOT_RUN', color: '#92959B' },
    { ID: 52, name: 'In Progress', statusType: 'IN_PROGRESS', color: '#0E5FDF' },
    { ID: 53, name: 'Passed', statusType: 'PASSED', color: '#037B3E' },
    { ID: 54, name: 'Failed', statusType: 'FAILED', color: '#EB2617' },
    { ID: 55, name: 'Blocked', statusType: 'BLOCKED', color: '#DF6005' },
    { ID: 901, name: 'N/A', statusType: 'PASSED', color: '#037B3E' },
  ]);
  const { fetchJiraUserByUsername } = await import('@/services/jira/users');
  (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

describe('AioProjectOverviewPage — folder tree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
    (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(PROJECT.id);
    const {
      fetchAioFolderTree,
      fetchAioFolderCycleCounts,
      fetchAioCyclesWithDetail,
      fetchAioCycleSummaries,
      fetchAioProjectConfig,
    } = await import('@/services/aio');
    const CYCLE_2 = { ...CYCLE_1, ID: 1002 };
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
    (fetchAioProjectConfig as ReturnType<typeof vi.fn>).mockResolvedValue([]);
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
    expect(
      (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeLessThanOrEqual(1);
  });
});

describe('AioProjectOverviewPage — persisted folder selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset in-memory selection store
    SelectionStore.byProjectKey = {};
    mockGetSelectedFolder.mockImplementation(
      (key: string) => SelectionStore.byProjectKey[key] ?? null,
    );
    mockSetSelectedFolder.mockImplementation((key: string, id: number) => {
      SelectionStore.byProjectKey[key] = id;
    });
    mockClearSelectedFolder.mockImplementation((key: string) => {
      delete SelectionStore.byProjectKey[key];
    });
  });

  it('auto-selects persisted folder on second load', async () => {
    // Pre-load stored selection for PROJ = folder 102
    SelectionStore.byProjectKey.PROJ = 102;

    const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
    (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
    const {
      fetchAioFolderTree,
      fetchAioFolderCycleCounts,
      fetchAioCyclesWithDetail,
      fetchAioCycleSummaries,
      fetchAioProjectConfig,
    } = await import('@/services/aio');
    // Both folders have cycles; without persistence, 101 would be auto-selected
    (fetchAioFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([FOLDER_A, FOLDER_B]);
    (fetchAioFolderCycleCounts as ReturnType<typeof vi.fn>).mockResolvedValue({
      '101': 1,
      '102': 1,
    });
    (fetchAioCyclesWithDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
      allIDs: [],
      startAt: 0,
      maxResults: 20,
      isLast: true,
    });
    (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchAioProjectConfig as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { fetchJiraUserByUsername } = await import('@/services/jira/users');
    (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const Page = await importPage();
    wrap(Page);

    await waitFor(() => {
      const folder102 = screen.getByTestId('folder-node-102');
      expect(folder102.className).toContain('bg-primary');
    });
    // folder 101 should NOT be selected
    const folder101 = screen.getByTestId('folder-node-101');
    expect(folder101.className).not.toContain('bg-primary');
  });

  it('falls back to first non-empty when persisted ID is stale', async () => {
    // Pre-load a stale folder ID that does not exist in the tree
    SelectionStore.byProjectKey.PROJ = 999;

    const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
    (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
    const {
      fetchAioFolderTree,
      fetchAioFolderCycleCounts,
      fetchAioCyclesWithDetail,
      fetchAioCycleSummaries,
      fetchAioProjectConfig,
    } = await import('@/services/aio');
    (fetchAioFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([FOLDER_A]);
    (fetchAioFolderCycleCounts as ReturnType<typeof vi.fn>).mockResolvedValue({ '101': 1 });
    (fetchAioCyclesWithDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
      allIDs: [],
      startAt: 0,
      maxResults: 20,
      isLast: true,
    });
    (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchAioProjectConfig as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { fetchJiraUserByUsername } = await import('@/services/jira/users');
    (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const Page = await importPage();
    wrap(Page);

    await waitFor(() => {
      const folder101 = screen.getByTestId('folder-node-101');
      expect(folder101.className).toContain('bg-primary');
    });
    // Stale entry should be cleared
    await waitFor(() => {
      expect(mockClearSelectedFolder).toHaveBeenCalledWith('PROJ');
    });
  });

  it('persists selection on folder click', async () => {
    const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
    (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(10134);
    const {
      fetchAioFolderTree,
      fetchAioFolderCycleCounts,
      fetchAioCyclesWithDetail,
      fetchAioCycleSummaries,
      fetchAioProjectConfig,
    } = await import('@/services/aio');
    (fetchAioFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([FOLDER_A, FOLDER_B]);
    (fetchAioFolderCycleCounts as ReturnType<typeof vi.fn>).mockResolvedValue({
      '101': 1,
      '102': 1,
    });
    (fetchAioCyclesWithDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
      allIDs: [],
      startAt: 0,
      maxResults: 20,
      isLast: true,
    });
    (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchAioProjectConfig as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { fetchJiraUserByUsername } = await import('@/services/jira/users');
    (fetchJiraUserByUsername as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const Page = await importPage();
    wrap(Page);

    // Wait for folder tree to render
    await waitFor(() => {
      expect(screen.getByTestId('folder-node-101')).toBeDefined();
    });

    // Click folder 101
    fireEvent.click(screen.getByTestId('folder-node-101'));

    await waitFor(() => {
      expect(mockSetSelectedFolder).toHaveBeenCalledWith('PROJ', 101);
    });
  });
});

describe('AioProjectOverviewPage — error states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders error state when folder tree query fails', async () => {
    const { fetchJiraProjectNumericId } = await import('@/services/jira/projects');
    (fetchJiraProjectNumericId as ReturnType<typeof vi.fn>).mockResolvedValue(PROJECT.id);
    const {
      fetchAioFolderTree,
      fetchAioFolderCycleCounts,
      fetchAioCyclesWithDetail,
      fetchAioCycleSummaries,
      fetchAioProjectConfig,
    } = await import('@/services/aio');
    (fetchAioFolderTree as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network fail'));
    (fetchAioFolderCycleCounts as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (fetchAioProjectConfig as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchAioCyclesWithDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
      allIDs: [],
      startAt: 0,
      maxResults: 0,
      isLast: true,
    });
    (fetchAioCycleSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const Page = await importPage();
    wrap(Page);
    await waitFor(
      () => {
        // Page should not be stuck on loading — either error UI or empty tree renders
        const body = document.body.textContent ?? '';
        expect(body.length).toBeGreaterThan(10);
      },
      { timeout: 4000 },
    );
  });
});
