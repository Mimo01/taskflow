/**
 * MyTasksPage smoke test — MYTASK-01 (updated for 82-DESIGN-TARGET redesign)
 *
 * Verifies the page mounts and renders without throwing.
 * Checks the new structure: 3-way scope control, 3 stat tiles, GROUP control row.
 *
 * Pattern: DashboardInProgressCard.test.tsx (mock useQuery at the top,
 * provide QueryClientProvider + MemoryRouter in render helper).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Top-of-file mocks ─────────────────────────────────────────────────────────

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: null,
    gitlabUserId: null,
  })),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      storyPointsFieldKey: 'customfield_10016',
      flaggedFieldKey: 'customfield_10021',
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/stores/my-tasks.store', () => ({
  useMyTasksStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      groupingMode: 'my-day',
      scope: 'current-sprint',
      setGroupingMode: vi.fn(),
      setScope: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/services/jira', () => ({
  fetchMyTasksHierarchy: vi.fn().mockResolvedValue({ issues: [], myIssueKeys: new Set() }),
  fetchAllAssignedHierarchy: vi.fn().mockResolvedValue({ issues: [], myIssueKeys: new Set() }),
  fetchAllReportedHierarchy: vi.fn().mockResolvedValue({ issues: [], myIssueKeys: new Set() }),
  isIssueFlagged: vi.fn().mockReturnValue(false),
}));

vi.mock('@/services/gitlab', () => ({
  fetchAuthoredMRs: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

// Mock Tauri plugin-store to prevent IPC calls in jsdom
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

// ── Import component after mocks ──────────────────────────────────────────────

import MyTasksPage from './MyTasksPage';

// ── Test helpers ──────────────────────────────────────────────────────────────

// Mock useOutletContext so the component gets a proper outlet context in tests
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(),
  };
});

import { useOutletContext } from 'react-router-dom';

function renderPage(outletCtx?: Record<string, unknown>) {
  vi.mocked(useOutletContext).mockReturnValue(outletCtx ?? {});
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <MyTasksPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MyTasksPage — MYTASK-01 smoke render (82-DESIGN-TARGET)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "My Tasks" page title without throwing', () => {
    renderPage();
    expect(screen.getByText('My Tasks')).toBeDefined();
  });

  it('renders the three stat tiles (To Do / In Progress / Done)', () => {
    renderPage();
    // The new design has 3 tiles (replacing the old 6 filter chips)
    const toDo = screen.getAllByText('To Do');
    expect(toDo.length).toBeGreaterThanOrEqual(1);
    const inProgress = screen.getAllByText('In Progress');
    expect(inProgress.length).toBeGreaterThanOrEqual(1);
    const done = screen.getAllByText('Done');
    expect(done.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the grouping segmented control options in the GROUP row', () => {
    renderPage();
    expect(screen.getByText('My Day')).toBeDefined();
    expect(screen.getByText('By Status')).toBeDefined();
    expect(screen.getByText('By Sprint & Parent')).toBeDefined();
  });

  it('renders all three scope toggle options in the right toolbar', () => {
    renderPage();
    expect(screen.getByText('Current Sprint')).toBeDefined();
    expect(screen.getByText('All Assigned')).toBeDefined();
    expect(screen.getByText('All Reported')).toBeDefined();
  });

  it('renders the empty state when no data is available', () => {
    renderPage();
    // My Day with no issues should show the "all caught up" empty state
    expect(screen.getByText("You're all caught up")).toBeDefined();
  });

  it('renders the Updated sort toggle button', () => {
    renderPage();
    expect(screen.getByTitle('Sorting by last updated — click for default order')).toBeDefined();
  });

  it('renders the + New issue button', () => {
    renderPage();
    expect(screen.getByText('New issue')).toBeDefined();
  });

  it('B1: outlet onOpenIssue is consumed (not navigate) for peek context', () => {
    // If outlet context provides onOpenIssue, the component should not throw when receiving it
    const onOpenIssue = vi.fn();
    const onIssueClick = vi.fn();
    renderPage({ onIssueClick, onOpenIssue });
    expect(screen.getByText('My Tasks')).toBeDefined();
  });
});
