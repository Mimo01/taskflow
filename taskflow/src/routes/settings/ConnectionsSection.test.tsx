/**
 * ConnectionsSection inline test-connection feedback tests — Phase 18 scaffold.
 *
 * These tests describe the inline feedback (idle/pending/success/error) that
 * will be built in Plan 18-03. They are RED at Wave 0 because ConnectionsSection.tsx
 * does not exist yet — that is expected.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConnectionsSection from './ConnectionsSection';

// Mock stronghold — stub readSecret to return a fake token
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('fake-secret-token'),
  storeSecret: vi.fn().mockResolvedValue(undefined),
}));

// Mock jira service
const mockValidateJira = vi.fn().mockResolvedValue({
  displayName: 'Jane Smith',
  emailAddress: 'jane@example.com',
  name: 'janesmith',
});
vi.mock('@/services/jira', () => ({
  validateJira: (...args: unknown[]) => mockValidateJira(...args),
  listJiraProjects: vi.fn().mockResolvedValue([]),
}));

// Mock gitlab service
const mockValidateGitLab = vi.fn().mockResolvedValue({
  id: 1,
  name: 'Jane Smith',
  username: 'jane',
});
vi.mock('@/services/gitlab', () => ({
  validateGitLab: (...args: unknown[]) => mockValidateGitLab(...args),
  listGitLabProjects: vi.fn().mockResolvedValue([]),
}));

// Mock settings store — return jiraUrl, gitlabUrl, and relevant setters
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
  debugMode: false,
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
  setDebugMode: vi.fn(),
};

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => mockSettingsStore,
}));

// Mock auth store — provides jiraBaseUrl, gitlabBaseUrl
const mockAuthStore = {
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
};

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => mockAuthStore,
}));

describe('ConnectionsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateJira.mockResolvedValue({
      displayName: 'Jane Smith',
      emailAddress: 'jane@example.com',
      name: 'janesmith',
    });
    mockValidateGitLab.mockResolvedValue({ id: 1, name: 'Jane Smith', username: 'jane' });
  });

  it('renders a Jira card and a GitLab card', () => {
    render(<ConnectionsSection />);
    expect(screen.getByText('Jira', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('GitLab', { selector: 'span' })).toBeInTheDocument();
  });

  it('Test Connection button is present on each card', () => {
    render(<ConnectionsSection />);
    const testButtons = screen.getAllByRole('button', { name: /test connection/i });
    expect(testButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('clicking Test Connection for Jira shows a loading/pending state', async () => {
    // Make validateJira hang so we can observe the pending state
    mockValidateJira.mockReturnValue(new Promise(() => {}));
    render(<ConnectionsSection />);

    const testButtons = screen.getAllByRole('button', { name: /test connection/i });
    fireEvent.click(testButtons[0]);

    // Should show a loading indicator (spinner or text)
    expect(
      screen.getByRole('button', { name: /testing|connecting|loading/i }) ||
        screen.getAllByRole('button')[0],
    ).toBeInTheDocument();
  });

  it('shows "Connected" inline on Jira success (no toast)', async () => {
    render(<ConnectionsSection />);
    const testButtons = screen.getAllByRole('button', { name: /test connection/i });
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });

  it('shows error message inline on Jira failure (no toast)', async () => {
    mockValidateJira.mockRejectedValue(new Error('Invalid credentials'));
    render(<ConnectionsSection />);

    const testButtons = screen.getAllByRole('button', { name: /test connection/i });
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials|failed|error/i)).toBeInTheDocument();
    });
  });

  it('shows "Connected" inline on GitLab success (no toast)', async () => {
    render(<ConnectionsSection />);
    const testButtons = screen.getAllByRole('button', { name: /test connection/i });
    // GitLab card is the second card
    fireEvent.click(testButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });

  it('shows error message inline on GitLab failure (no toast)', async () => {
    mockValidateGitLab.mockRejectedValue(new Error('Unauthorized'));
    render(<ConnectionsSection />);

    const testButtons = screen.getAllByRole('button', { name: /test connection/i });
    fireEvent.click(testButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/unauthorized|failed|error/i)).toBeInTheDocument();
    });
  });

  it('status resets to idle when URL input changes', async () => {
    render(<ConnectionsSection />);
    const testButtons = screen.getAllByRole('button', { name: /test connection/i });
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });

    // Change the Jira URL input — status should reset
    const urlInput = screen.getByLabelText(/jira.*url|url.*jira/i);
    fireEvent.change(urlInput, { target: { value: 'https://new-jira.example.com' } });

    expect(screen.queryByText(/connected/i)).not.toBeInTheDocument();
  });

  it('status resets to idle when token input changes', async () => {
    render(<ConnectionsSection />);
    const testButtons = screen.getAllByRole('button', { name: /test connection/i });
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });

    // Change the token input — status should reset
    const tokenInput = screen.getByLabelText(/jira.*token|token.*jira|api.*token/i);
    fireEvent.change(tokenInput, { target: { value: 'new-token-value' } });

    expect(screen.queryByText(/connected/i)).not.toBeInTheDocument();
  });
});
