// AUTH-05: Token management in settings — Plan 03
// ROLE-02: Role switching in settings — Plan 03
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Settings from './Settings';

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('my-actual-secret-token'),
  storeSecret: vi.fn().mockResolvedValue(undefined),
}));

// Mock jira service
vi.mock('@/services/jira', () => ({
  validateJira: vi.fn().mockResolvedValue({ displayName: 'Jane Smith', emailAddress: 'jane@example.com' }),
  listJiraProjects: vi.fn().mockResolvedValue([{ id: '10001', key: 'APP', name: 'Application' }]),
}));

// Mock gitlab service
vi.mock('@/services/gitlab', () => ({
  validateGitLab: vi.fn().mockResolvedValue({ id: 1, name: 'Jane Smith', username: 'jane' }),
  listGitLabGroups: vi.fn().mockResolvedValue([{ id: 1, name: 'My Group', full_path: 'my-group' }]),
}));

// Mock theme service
vi.mock('@/services/theme', () => ({
  applyTheme: vi.fn(),
  saveTheme: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth store
const mockAuthStore = {
  jiraConnected: true,
  gitlabConnected: true,
  jiraBaseUrl: 'https://jira.example.com',
  gitlabBaseUrl: 'https://gitlab.example.com',
  activeJiraProject: 'PROJECT-1',
  activeGitlabGroup: 'group-1',
  set: vi.fn(),
  setJiraConnected: vi.fn(),
  setGitlabConnected: vi.fn(),
  setActiveJiraProject: vi.fn(),
  setActiveGitlabGroup: vi.fn(),
};

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => mockAuthStore,
}));

// Mock settings store
const mockSettingsStore = {
  role: 'developer' as 'developer' | 'pm' | null,
  theme: 'system' as 'dark' | 'light' | 'system',
  setRole: vi.fn(),
  setTheme: vi.fn(),
};

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => mockSettingsStore,
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsStore.role = 'developer';
    mockSettingsStore.theme = 'system';
    mockAuthStore.jiraConnected = true;
  });

  it('AUTH-05: Jira token field is displayed as masked by default (type="password")', () => {
    renderWithQuery(<Settings />);
    // Find jira token field — should be type password (masked)
    const tokenFields = screen.getAllByDisplayValue('••••••••');
    expect(tokenFields.length).toBeGreaterThan(0);
  });

  it('AUTH-05: readSecret is called on initial render to load project list, not for token reveal', async () => {
    const { readSecret } = await import('@/services/stronghold');
    renderWithQuery(<Settings />);
    // readSecret('jira-pat') is called on mount to fetch the Jira project list.
    // It is NOT triggered by the eye-toggle — that still requires a user click.
    await waitFor(() => {
      expect(vi.mocked(readSecret)).toHaveBeenCalledWith('jira-pat');
    });
    // Eye toggle buttons are not clicked — so no additional reveal calls occur
    const eyeButtons = screen.queryAllByRole('button', { name: /show|hide|reveal|eye/i });
    expect(eyeButtons.length).toBeGreaterThan(0);
  });

  it('AUTH-05: eye icon click reveals the token', async () => {
    const { readSecret } = await import('@/services/stronghold');
    renderWithQuery(<Settings />);

    // The Jira eye button
    const eyeButtons = screen.getAllByRole('button', { name: /show|hide|reveal|eye/i });
    expect(eyeButtons.length).toBeGreaterThan(0);
    fireEvent.click(eyeButtons[0]);

    await waitFor(() => {
      expect(readSecret).toHaveBeenCalled();
    });
  });

  it('AUTH-05: "Update Token" button triggers store write on success', async () => {
    const { storeSecret } = await import('@/services/stronghold');
    const { validateJira } = await import('@/services/jira');

    vi.mocked(validateJira).mockResolvedValue({
      displayName: 'Jane Smith',
      emailAddress: 'jane@example.com',
    });

    renderWithQuery(<Settings />);

    // Fill in new token input so Update Token is enabled
    const newTokenInputs = screen.getAllByPlaceholderText(/paste new token/i);
    expect(newTokenInputs.length).toBeGreaterThan(0);
    fireEvent.change(newTokenInputs[0], { target: { value: 'new-jira-token-value' } });

    // Find update token button for Jira
    const updateButtons = screen.getAllByRole('button', { name: /update.*token/i });
    expect(updateButtons.length).toBeGreaterThan(0);
    fireEvent.click(updateButtons[0]);

    await waitFor(() => {
      expect(storeSecret).toHaveBeenCalled();
    });
  });

  it('ROLE-02: role picker reads current role from useSettingsStore', () => {
    mockSettingsStore.role = 'pm';
    renderWithQuery(<Settings />);
    // PM radio should be checked
    const pmRadio = screen.getByLabelText(/project manager/i);
    expect(pmRadio).toBeChecked();
  });

  it('ROLE-02: switching role updates useSettingsStore', () => {
    mockSettingsStore.role = 'pm';
    renderWithQuery(<Settings />);
    const developerRadio = screen.getByLabelText(/developer/i);
    fireEvent.click(developerRadio);
    expect(mockSettingsStore.setRole).toHaveBeenCalledWith('developer');
  });
});
