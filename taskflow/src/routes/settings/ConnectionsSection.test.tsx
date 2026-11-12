/**
 * ConnectionsSection inline test-connection feedback tests — Phase 18 scaffold.
 *
 * These tests describe the inline feedback (idle/pending/success/error) that
 * will be built in Plan 18-03. They are RED at Wave 0 because ConnectionsSection.tsx
 * does not exist yet — that is expected.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openExternal } from '@/lib/openExternal';
import { jiraTokenUrl } from '@/lib/token-links';
import { listJiraProjects } from '@/services/jira';
import ConnectionsSection from './ConnectionsSection';

vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));

// All renders need a QueryClientProvider — ConnectionsSection calls useQueryClient
// to invalidate active-sprint caches on a board switch (FB8-4).
let client: QueryClient;
function render(ui: ReactElement) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

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

// Mock sprints service — board listing for the BoardPicker
vi.mock('@/services/jira/sprints', () => ({
  listProjectBoards: vi.fn().mockResolvedValue([]),
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
  theme: 'system' as 'dark' | 'light' | 'system',
  density: 'default' as 'compact' | 'default' | 'comfortable',
  fontScale: 'md' as 'sm' | 'md' | 'lg' | 'xl',
  sprintCollapseByDefault: false,
  staleMrThresholdDays: 3,
  notificationPollIntervalSecs: 60,
  desktopNotificationsEnabled: true,
  devToolsEnabled: false,
  storyPointsFieldKey: 'customfield_10016',
  epicLinkFieldKey: 'customfield_10014',
  epicNameFieldKey: 'customfield_10015',
  sprintFieldKey: 'customfield_10020',
  accountFieldKey: null,
  setTheme: vi.fn(),
  setDensity: vi.fn(),
  setFontScale: vi.fn(),
  setSprintCollapseByDefault: vi.fn(),
  setStaleMrThresholdDays: vi.fn(),
  setNotificationPollIntervalSecs: vi.fn(),
  setDesktopNotificationsEnabled: vi.fn(),
  setDevToolsEnabled: vi.fn(),
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
  jiraBoardIds: {} as Record<string, number>,
  set: vi.fn(),
  setJiraConnected: vi.fn(),
  setGitlabConnected: vi.fn(),
  setActiveJiraProject: vi.fn(),
  setActiveGitlabProject: vi.fn(),
  setJiraBoardId: vi.fn(),
  bumpCredentialsRevision: vi.fn(),
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

  it('Jira test uses the typed token, not the stored one', async () => {
    render(<ConnectionsSection />);
    fireEvent.change(screen.getByLabelText(/jira token/i), { target: { value: '  typed-jira  ' } });
    fireEvent.click(screen.getAllByRole('button', { name: /test connection/i })[0]);

    await waitFor(() => expect(mockValidateJira).toHaveBeenCalled());
    expect(mockValidateJira.mock.calls[0][1]).toBe('typed-jira');
  });

  it('Jira test falls back to the stored token when nothing is typed', async () => {
    render(<ConnectionsSection />);
    fireEvent.click(screen.getAllByRole('button', { name: /test connection/i })[0]);

    await waitFor(() => expect(mockValidateJira).toHaveBeenCalled());
    expect(mockValidateJira.mock.calls[0][1]).toBe('fake-secret-token');
  });

  it('GitLab test uses the typed token, not the stored one', async () => {
    render(<ConnectionsSection />);
    fireEvent.change(screen.getByLabelText(/gitlab token/i), { target: { value: 'typed-gl' } });
    fireEvent.click(screen.getAllByRole('button', { name: /test connection/i })[1]);

    await waitFor(() => expect(mockValidateGitLab).toHaveBeenCalled());
    expect(mockValidateGitLab.mock.calls[0][1]).toBe('typed-gl');
  });

  it('Jira active-project picker opens a search box that narrows options by key and name', async () => {
    vi.mocked(listJiraProjects).mockResolvedValueOnce([
      { id: '1', key: 'APP', name: 'Application' },
      { id: '2', key: 'BE', name: 'Backend' },
    ] as Awaited<ReturnType<typeof listJiraProjects>>);
    const user = userEvent.setup();
    render(<ConnectionsSection />);
    await user.click(screen.getAllByRole('button', { name: /test connection/i })[0]);

    await user.click(await screen.findByLabelText('Active Project'));
    expect(await screen.findAllByRole('option')).toHaveLength(2);

    await user.type(screen.getByPlaceholderText('Search projects…'), 'be');
    const opts = screen.getAllByRole('option');
    expect(opts).toHaveLength(1);
    expect(opts[0]).toHaveTextContent('BackendBE');
  });

  // Replacing an expired token must not leave the app on data/errors fetched with
  // the old one: failed queries stay errored (gcTime: Infinity) and ['jira-pat']
  // (staleTime: Infinity) keeps the expired PAT unless the cache is dropped.
  it.each([
    ['Jira', 0, /jira token/i],
    ['GitLab', 1, /gitlab token/i],
  ] as const)('saving a new %s token clears the query cache and bumps credentials', async (_name, idx, label) => {
    render(<ConnectionsSection />);
    client.setQueryData(['jira-pat'], 'expired-token');
    fireEvent.change(screen.getByLabelText(label), { target: { value: 'fresh-token' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^save$/i })[idx]);

    await waitFor(() => expect(mockAuthStore.bumpCredentialsRevision).toHaveBeenCalledTimes(1));
    expect(client.getQueryData(['jira-pat'])).toBeUndefined();
  });
});

describe('ConnectionsSection token quick links', () => {
  const linkName = { name: 'Create a token' };

  beforeEach(() => {
    vi.mocked(openExternal).mockClear();
  });

  function typeUrl(label: string, value: string) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }

  it('Jira: hidden for empty and Cloud URLs, opens the PAT page for a DC URL', () => {
    render(<ConnectionsSection />);
    typeUrl('Jira URL', '');
    expect(screen.queryAllByRole('button', linkName)).toHaveLength(1); // GitLab card only
    typeUrl('Jira URL', 'https://acme.atlassian.net');
    expect(screen.queryAllByRole('button', linkName)).toHaveLength(1);
    typeUrl('Jira URL', 'https://jira.example.com');
    const buttons = screen.getAllByRole('button', linkName);
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(openExternal).toHaveBeenCalledWith(jiraTokenUrl('https://jira.example.com'));
  });

  it('GitLab: keeps the context path and prefills the api scope', () => {
    render(<ConnectionsSection />);
    typeUrl('GitLab URL', 'https://gitlab.example.com/gitlab');
    const buttons = screen.getAllByRole('button', linkName);
    fireEvent.click(buttons[buttons.length - 1]);
    const url = vi.mocked(openExternal).mock.calls[0][0];
    expect(
      url.startsWith('https://gitlab.example.com/gitlab/-/user_settings/personal_access_tokens'),
    ).toBe(true);
    expect(url).toContain('scopes=api');
  });
});
