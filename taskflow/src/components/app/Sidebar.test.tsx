import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level variable so vi.mock factory can close over it (vi.mock is hoisted)
let mockAioEnabled = false;

// Mock NavLink as a plain anchor for test isolation
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    NavLink: ({ to, children, className }: { to: string; children: React.ReactNode; className?: unknown }) => (
      <a href={String(to)} className={typeof className === 'string' ? className : undefined}>
        {children}
      </a>
    ),
  };
});

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  }),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/services/jira', () => ({
  fetchActiveSprint: vi.fn(),
  fetchEpicsBasic: vi.fn(),
  fetchProjectStatuses: vi.fn(),
}));

vi.mock('@/services/jira/backlog', () => ({
  fetchBacklogIssues: vi.fn(),
  fetchBacklogSprintStories: vi.fn(),
  fetchSprintList: vi.fn(),
}));

vi.mock('@/services/jira/issues', () => ({
  fetchSprintStories: vi.fn(),
}));

vi.mock('@/services/jira/sprints', () => ({
  fetchBoardId: vi.fn(),
}));

vi.mock('@/hooks/useResizable', () => ({
  useResizable: () => ({ width: 220, isDragging: false, handleMouseDown: vi.fn() }),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      devToolsEnabled: false,
      aioEnabled: mockAioEnabled,
      sidebarItems: [
        { id: 'dashboard', visible: true },
        { id: 'my-tasks', visible: true },
        { id: 'sprint-board', visible: true },
        { id: 'backlog', visible: true },
        { id: 'epics', visible: true },
        { id: 'merge-requests', visible: true },
        { id: 'sprint-progress', visible: true },
        { id: 'workload', visible: true },
        { id: 'releases', visible: true },
        { id: 'aio-projects', visible: true },
      ],
      sidebarCollapsed: false,
      toggleSidebarCollapsed: vi.fn(),
      sidebarWidth: 220,
      setSidebarWidth: vi.fn(),
      storyPointsFieldKey: 'customfield_10016',
      epicLinkFieldKey: 'customfield_10014',
      epicNameFieldKey: 'customfield_10015',
      epicColorFieldKey: 'customfield_10016',
    };
    return selector ? selector(state) : state;
  },
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderSidebar(aioEnabled: boolean) {
  mockAioEnabled = aioEnabled;
}

describe('Sidebar — aioEnabled gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AION-01: Testing section is visible when aioEnabled is true', async () => {
    renderSidebar(true);
    const { default: Sidebar } = await import('./Sidebar');
    const { getByText } = render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(getByText('Testing')).toBeDefined();
    expect(getByText('AIO Projects')).toBeDefined();
  });

  it('AION-01: Testing section is absent when aioEnabled is false', async () => {
    renderSidebar(false);
    const { default: Sidebar } = await import('./Sidebar');
    const { queryByText } = render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(queryByText('Testing')).toBeNull();
    expect(queryByText('AIO Projects')).toBeNull();
  });
});
