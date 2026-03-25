/**
 * Settings sidebar-nav tests — Phase 18 scaffold.
 *
 * These tests describe the multi-page sidebar structure that will be built
 * in Plans 18-03 through 18-05. They are RED at Wave 0 (component not yet
 * restructured) and will turn GREEN as plans land.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from './Settings';
import WorkflowSection from './WorkflowSection';

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// Mock build-info
vi.mock('@/lib/build-info', () => ({
  buildInfo: { version: '1.6.0', commitSha: 'abc1234', buildDate: '2026-03-24' },
}));

// Mock update store
vi.mock('@/stores/update.store', () => ({
  useUpdateStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      selector
        ? selector({ status: 'idle', availableVersion: null })
        : { status: 'idle', availableVersion: null },
    {
      getState: () => ({
        status: 'idle',
        availableVersion: null,
        setChecking: vi.fn(),
        setAvailable: vi.fn(),
        setError: vi.fn(),
        resetToIdle: vi.fn(),
      }),
    },
  ),
}));

// Mock updater service
vi.mock('@/services/updater', () => ({
  updaterService: { check: vi.fn().mockResolvedValue(null) },
}));

// Stub global fetch for version history query
vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  }),
);

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('fake-token'),
  storeSecret: vi.fn().mockResolvedValue(undefined),
}));

// Mock jira service
vi.mock('@/services/jira', () => ({
  validateJira: vi.fn().mockResolvedValue({
    displayName: 'Jane Smith',
    emailAddress: 'jane@example.com',
    name: 'janesmith',
  }),
  listJiraProjects: vi.fn().mockResolvedValue([]),
}));

// Mock gitlab service
vi.mock('@/services/gitlab', () => ({
  validateGitLab: vi.fn().mockResolvedValue({ id: 1, name: 'Jane Smith', username: 'jane' }),
  listGitLabProjects: vi.fn().mockResolvedValue([]),
}));

// Mock theme service
vi.mock('@/services/theme', () => ({
  applyTheme: vi.fn(),
  applyDensity: vi.fn(),
  saveTheme: vi.fn().mockResolvedValue(undefined),
}));

// Mock settings store — covers all fields the component reads
const mockSettingsStore = {
  role: 'developer' as 'developer' | 'pm' | 'tech-lead' | null,
  theme: 'system' as 'dark' | 'light' | 'system',
  density: 'default' as 'compact' | 'default' | 'comfortable',
  sprintCollapseByDefault: false,
  showSubtasksInMyTasks: true,
  staleMrThresholdDays: 3,
  notificationPollIntervalSecs: 60,
  osNotifJiraEnabled: true,
  osNotifGitlabEnabled: true,
  devToolsEnabled: false,
  storyPointsFieldKey: 'customfield_10016',
  epicLinkFieldKey: 'customfield_10014',
  epicNameFieldKey: 'customfield_10015',
  sprintFieldKey: 'customfield_10020',
  accountFieldKey: null,
  updateCheckInterval: 6,
  setUpdateCheckInterval: vi.fn(),
  lastChecked: null,
  setLastChecked: vi.fn(),
  setRole: vi.fn(),
  setTheme: vi.fn(),
  setDensity: vi.fn(),
  setSprintCollapseByDefault: vi.fn(),
  setShowSubtasksInMyTasks: vi.fn(),
  setStaleMrThresholdDays: vi.fn(),
  setNotificationPollIntervalSecs: vi.fn(),
  setOsNotifJiraEnabled: vi.fn(),
  setOsNotifGitlabEnabled: vi.fn(),
  setDevToolsEnabled: vi.fn(),
  sidebarItems: [
    { id: 'dashboard', visible: true },
    { id: 'my-tasks', visible: true },
    { id: 'sprint-board', visible: true },
    { id: 'backlog', visible: true },
    { id: 'epics', visible: true },
    { id: 'merge-requests', visible: true },
    { id: 'mr-attention', visible: true },
    { id: 'sprint-progress', visible: false },
    { id: 'workload', visible: false },
    { id: 'releases', visible: false },
  ],
  dashboardLayout: [],
  setSidebarItems: vi.fn(),
  setSidebarItemVisible: vi.fn(),
  reorderSidebarItem: vi.fn(),
  setDashboardLayout: vi.fn(),
  addDashboardWidget: vi.fn(),
  removeDashboardWidget: vi.fn(),
  updateWidgetConfig: vi.fn(),
  applyPreset: vi.fn(),
};

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: (selector?: (s: typeof mockSettingsStore) => unknown) =>
    selector ? selector(mockSettingsStore) : mockSettingsStore,
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraConnected: true,
    gitlabConnected: true,
    jiraBaseUrl: 'https://jira.example.com',
    gitlabBaseUrl: 'https://gitlab.example.com',
    activeJiraProject: 'PROJECT-1',
    activeGitlabProject: 1,
    activeGitlabProjectPath: 'Org / My Project',
    set: vi.fn(),
    setJiraConnected: vi.fn(),
    setGitlabConnected: vi.fn(),
    setActiveJiraProject: vi.fn(),
    setActiveGitlabProject: vi.fn(),
  }),
}));

describe('Settings sidebar nav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 7 sidebar nav buttons', () => {
    renderWithQuery(<Settings />);
    const navButtons = screen.getAllByRole('button', {
      name: /Connections|Appearance|Sidebar|Notifications|Workflow|Updates|Advanced/i,
    });
    expect(navButtons.length).toBe(7);
  });

  it('renders sidebar buttons with correct labels', () => {
    renderWithQuery(<Settings />);
    expect(screen.getByRole('button', { name: /connections/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /workflow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /updates/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /advanced/i })).toBeInTheDocument();
  });

  it('shows Connections section content on initial render (default active section)', () => {
    renderWithQuery(<Settings />);
    // Connections section should be visible by default
    expect(screen.getByTestId('section-connections')).toBeVisible();
  });

  it('active sidebar button has aria-current="page"', () => {
    renderWithQuery(<Settings />);
    const connectionsBtn = screen.getByRole('button', { name: /connections/i });
    expect(connectionsBtn).toHaveAttribute('aria-current', 'page');
  });

  it('clicking Appearance button renders Appearance section, hides Connections', () => {
    renderWithQuery(<Settings />);
    const appearanceBtn = screen.getByRole('button', { name: /appearance/i });
    fireEvent.click(appearanceBtn);
    expect(screen.getByTestId('section-appearance')).toBeVisible();
    expect(screen.queryByTestId('section-connections')).not.toBeInTheDocument();
  });

  it('clicking Notifications button renders Notifications section', () => {
    renderWithQuery(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByTestId('section-notifications')).toBeVisible();
  });

  it('clicking Workflow button renders Workflow section', () => {
    renderWithQuery(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /workflow/i }));
    expect(screen.getByTestId('section-workflow')).toBeVisible();
  });

  it('clicking Sidebar button renders Sidebar section', () => {
    renderWithQuery(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /sidebar/i }));
    expect(screen.getByTestId('section-sidebar')).toBeVisible();
  });

  it('active sidebar button updates aria-current when section changes', () => {
    renderWithQuery(<Settings />);
    const appearanceBtn = screen.getByRole('button', { name: /appearance/i });
    fireEvent.click(appearanceBtn);
    expect(appearanceBtn).toHaveAttribute('aria-current', 'page');
    // Connections should no longer be active
    expect(screen.getByRole('button', { name: /connections/i })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('WorkflowSection content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Workflow heading', () => {
    render(<WorkflowSection />);
    expect(screen.getByRole('heading', { name: /workflow/i })).toBeInTheDocument();
  });

  it('renders Sprint Board subsection heading', () => {
    render(<WorkflowSection />);
    expect(screen.getByText(/sprint board/i)).toBeInTheDocument();
  });

  it('renders collapse parent stories toggle', () => {
    render(<WorkflowSection />);
    expect(screen.getByText(/collapse parent stories by default/i)).toBeInTheDocument();
  });

  it('renders show subtasks toggle', () => {
    render(<WorkflowSection />);
    expect(screen.getByText(/show subtasks in my tasks/i)).toBeInTheDocument();
  });

  it('does not render DebugModeSection (moved to top-level Advanced section)', () => {
    render(<WorkflowSection />);
    // Debug controls live in Settings > Advanced, not inside WorkflowSection
    expect(screen.queryByText(/enable api call logging/i)).not.toBeInTheDocument();
  });

  it('collapse toggle reflects sprintCollapseByDefault from store (false by default)', () => {
    render(<WorkflowSection />);
    const collapseCheckbox = screen.getByRole('checkbox', { name: /collapse parent stories/i });
    expect(collapseCheckbox).not.toBeChecked();
  });

  it('subtasks toggle reflects showSubtasksInMyTasks from store (true by default)', () => {
    render(<WorkflowSection />);
    const subtasksCheckbox = screen.getByRole('checkbox', { name: /show subtasks in my tasks/i });
    expect(subtasksCheckbox).toBeChecked();
  });

  it('toggling collapse calls setSprintCollapseByDefault', () => {
    render(<WorkflowSection />);
    const collapseCheckbox = screen.getByRole('checkbox', { name: /collapse parent stories/i });
    fireEvent.click(collapseCheckbox);
    expect(mockSettingsStore.setSprintCollapseByDefault).toHaveBeenCalledWith(true);
  });

  it('toggling subtasks calls setShowSubtasksInMyTasks', () => {
    render(<WorkflowSection />);
    const subtasksCheckbox = screen.getByRole('checkbox', { name: /show subtasks in my tasks/i });
    fireEvent.click(subtasksCheckbox);
    expect(mockSettingsStore.setShowSubtasksInMyTasks).toHaveBeenCalledWith(false);
  });
});
