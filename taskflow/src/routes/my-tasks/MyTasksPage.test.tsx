/**
 * MyTasksPage smoke test — MYTASK-01
 *
 * Verifies the page mounts and renders without throwing.
 * Mocks all external dependencies (services, stores, stronghold).
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

function renderPage() {
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

describe('MyTasksPage — MYTASK-01 smoke render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "My Tasks" page title without throwing', () => {
    renderPage();
    expect(screen.getByText('My Tasks')).toBeDefined();
  });

  it('renders the summary filter strip pills', () => {
    renderPage();
    expect(screen.getByText('To Do')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('Done this sprint')).toBeDefined();
    expect(screen.getByText('Overdue')).toBeDefined();
    expect(screen.getByText('MRs awaiting me')).toBeDefined();
  });

  it('renders the grouping tabs', () => {
    renderPage();
    expect(screen.getByText('My Day')).toBeDefined();
    expect(screen.getByText('By Status')).toBeDefined();
    expect(screen.getByText('By Sprint & Parent')).toBeDefined();
  });

  it('renders the scope toggle with both options', () => {
    renderPage();
    expect(screen.getByText('Current Sprint')).toBeDefined();
    expect(screen.getByText('All Assigned')).toBeDefined();
  });

  it('renders the empty state when no data is available', () => {
    renderPage();
    // My Day with no issues should show the "all caught up" empty state
    expect(screen.getByText("You're all caught up")).toBeDefined();
  });
});
