import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level variable so vi.mock factory can close over it (vi.mock is hoisted)
let mockAioEnabled = false;
let mockSelectedAioProjectKey: string | null = null;
let mockTempoEnabled = false;

// Mock NavLink as a plain anchor for test isolation
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    NavLink: ({
      to,
      children,
      className,
    }: {
      to: string;
      children: React.ReactNode;
      className?: unknown;
    }) => (
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
  fetchActiveSprint: vi.fn().mockResolvedValue(null),
  fetchEpicsBasic: vi.fn().mockResolvedValue([]),
  fetchProjectStatuses: vi.fn().mockResolvedValue([]),
  // Phase 73 Plan 03: sprint-board prefetch swap (D-08). The sidebar no longer
  // imports fetchSprintStories; getGhAllData is the warm path.
  getGhAllData: vi.fn().mockResolvedValue({ issuesData: { issues: [] } }),
}));

vi.mock('@/services/jira/backlog', () => ({
  fetchBacklogIssues: vi.fn(),
  fetchBacklogSprintStories: vi.fn(),
  fetchSprintList: vi.fn(),
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
      selectedAioProjectKey: mockSelectedAioProjectKey,
      tempoEnabled: mockTempoEnabled,
      sidebarItems: [
        { id: 'dashboard', visible: true },
        { id: 'sprint-board', visible: true },
        { id: 'backlog', visible: true },
        { id: 'epics', visible: true },
        { id: 'merge-requests', visible: true },
        { id: 'releases', visible: true },
        { id: 'worklogs', visible: true },
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

function renderSidebar(aioEnabled: boolean, selectedAioProjectKey: string | null = null) {
  mockAioEnabled = aioEnabled;
  mockSelectedAioProjectKey = selectedAioProjectKey;
}

describe('Sidebar — aioEnabled gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AION-01: Testing section is visible when aioEnabled is true', async () => {
    renderSidebar(true, 'PROJ'); // gated by selectedAioProjectKey since Phase 55
    const { default: Sidebar } = await import('./Sidebar');
    const { getByText } = render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(getByText('Testing')).toBeDefined();
    expect(getByText('AIO Cycles')).toBeDefined();
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
    expect(queryByText('AIO Cycles')).toBeNull();
  });

  it('hides Testing section when aioEnabled=true but selectedAioProjectKey is null (Phase 55 D-09)', async () => {
    renderSidebar(true, null);
    const { default: Sidebar } = await import('./Sidebar');
    const { queryByText } = render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(queryByText('AIO Cycles')).toBeNull();
  });

  it('shows AIO Cycles nav item when aioEnabled=true AND selectedAioProjectKey is set (Phase 55 D-09)', async () => {
    renderSidebar(true, 'PROJ');
    const { default: Sidebar } = await import('./Sidebar');
    const { findByText } = render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await findByText('AIO Cycles')).toBeDefined();
  });

  it('renders AIO Cycles NavLink href as /aio-project/<selectedAioProjectKey> (Phase 55 D-09)', async () => {
    renderSidebar(true, 'PROJ');
    const { default: Sidebar } = await import('./Sidebar');
    const { findByText } = render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const link = (await findByText('AIO Cycles')).closest('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/aio-project/PROJ');
  });
});

describe('Sidebar — tempoEnabled gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('D-06: shows Worklogs link when tempoEnabled=true', async () => {
    mockTempoEnabled = true;
    const { default: Sidebar } = await import('./Sidebar');
    const { getByText } = render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(getByText('Worklogs')).toBeDefined();
  });

  it('D-06: hides Worklogs link when tempoEnabled=false', async () => {
    mockTempoEnabled = false;
    const { default: Sidebar } = await import('./Sidebar');
    const { queryByText } = render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(queryByText('Worklogs')).toBeNull();
  });
});

// ─── Phase 73 Plan 03: sprint-board prefetch swap (D-08 / D-08a) ─────────────

describe('Sidebar — sprint-board prefetch swaps to getGhAllData (Phase 73 Plan 03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAioEnabled = false;
    mockSelectedAioProjectKey = null;
    mockTempoEnabled = false;
  });

  it("focusing the Sprint Board nav resolves boardId and warms getGhAllData (D-08)", async () => {
    const { fetchBoardId } = await import('@/services/jira/sprints');
    const jira = await import('@/services/jira');
    vi.mocked(fetchBoardId).mockResolvedValueOnce(163);

    const { default: Sidebar } = await import('./Sidebar');
    const { findByText } = render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const sprintBoardLink = await findByText('Sprint Board');
    fireEvent.focus(sprintBoardLink);

    await waitFor(() => {
      expect(fetchBoardId).toHaveBeenCalled();
    });
    await waitFor(() => {
      // D-08: getGhAllData warm with the resolved boardId.
      expect((jira as unknown as { getGhAllData: ReturnType<typeof vi.fn> }).getGhAllData)
        .toHaveBeenCalled();
    });
    const ghCalls = (jira as unknown as { getGhAllData: ReturnType<typeof vi.fn> }).getGhAllData
      .mock.calls;
    // queryClient (arg 0), baseUrl, token, boardId
    expect(ghCalls[0][1]).toBe('https://jira.example.com');
    expect(ghCalls[0][2]).toBe('test-jira-token');
    expect(ghCalls[0][3]).toBe(163);
  });

  it("D-08a: silently skips getGhAllData when boardId resolves null", async () => {
    const { fetchBoardId } = await import('@/services/jira/sprints');
    const jira = await import('@/services/jira');
    vi.mocked(fetchBoardId).mockResolvedValueOnce(null);

    const { default: Sidebar } = await import('./Sidebar');
    const { findByText } = render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const sprintBoardLink = await findByText('Sprint Board');
    fireEvent.focus(sprintBoardLink);

    await waitFor(() => {
      expect(fetchBoardId).toHaveBeenCalled();
    });
    // Wait a beat for the .then() to run.
    await new Promise((r) => setTimeout(r, 50));
    expect((jira as unknown as { getGhAllData: ReturnType<typeof vi.fn> }).getGhAllData)
      .not.toHaveBeenCalled();
  });
});
