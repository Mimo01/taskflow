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
};

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => mockSettingsStore,
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

  it('renders 5 sidebar nav buttons', () => {
    renderWithQuery(<Settings />);
    const navButtons = screen.getAllByRole('button', {
      name: /Connections|Appearance|Notifications|Workflow|Role/i,
    });
    expect(navButtons.length).toBe(5);
  });

  it('renders sidebar buttons with correct labels', () => {
    renderWithQuery(<Settings />);
    expect(screen.getByRole('button', { name: /connections/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /workflow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /role/i })).toBeInTheDocument();
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

  it('clicking Role button renders Role section', () => {
    renderWithQuery(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /role/i }));
    expect(screen.getByTestId('section-role')).toBeVisible();
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
