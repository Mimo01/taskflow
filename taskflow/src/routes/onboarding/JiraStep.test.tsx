// AUTH-04: Project dropdown appears after successful Jira validation — Plan 02
// AUTH-06: Error banners on validation failure — Plan 02
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JiraStep from './JiraStep';

// Mock the jira service module
vi.mock('@/services/jira', () => ({
  validateJira: vi.fn(),
  listJiraProjects: vi.fn(),
}));

// Mock the stronghold service
vi.mock('@/services/stronghold', () => ({
  storeSecret: vi.fn().mockResolvedValue(undefined),
}));

// Mock the onboarding store — use shared mutable state per test
const mockStore = {
  step: 1,
  jiraUrl: 'https://jira.example.com',
  jiraToken: 'test-token',
  jiraProject: null as string | null,
  jiraProjects: [] as { id: string; key: string; name: string }[],
  jiraValidated: false,
  set: vi.fn((updates: Partial<typeof mockStore>) => Object.assign(mockStore, updates)),
  goNext: vi.fn(),
  goBack: vi.fn(),
};

vi.mock('@/stores/onboarding.store', () => ({
  useOnboardingStore: () => mockStore,
}));

// Mock the auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    setJiraConnected: vi.fn(),
    setActiveJiraProject: vi.fn(),
  }),
}));

import { validateJira, listJiraProjects } from '@/services/jira';

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('JiraStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.jiraUrl = 'https://jira.example.com';
    mockStore.jiraToken = 'test-token';
    mockStore.jiraValidated = false;
    mockStore.jiraProject = null;
    mockStore.jiraProjects = [];
    mockStore.set.mockImplementation((updates: Partial<typeof mockStore>) => Object.assign(mockStore, updates));
  });

  it('AUTH-04: renders URL input, token input, and Test & Continue button', () => {
    renderWithQuery(<JiraStep />);
    expect(screen.getByLabelText(/jira.*url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/token|pat|personal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test.*continue/i })).toBeInTheDocument();
  });

  it('AUTH-04: project dropdown is hidden before validation', () => {
    renderWithQuery(<JiraStep />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('AUTH-04: project dropdown appears after successful validation', async () => {
    vi.mocked(validateJira).mockResolvedValue({
      displayName: 'Jane Smith',
      emailAddress: 'jane@example.com',
      name: 'janesmith',
    });
    vi.mocked(listJiraProjects).mockResolvedValue([
      { id: '10001', key: 'APP', name: 'Application' },
      { id: '10002', key: 'BE', name: 'Backend' },
    ]);

    renderWithQuery(<JiraStep />);
    fireEvent.click(screen.getByRole('button', { name: /test.*continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('AUTH-06: shows "Invalid token or token has expired" on 401', async () => {
    vi.mocked(validateJira).mockRejectedValue(new Error('Invalid token or token has expired'));

    renderWithQuery(<JiraStep />);
    fireEvent.click(screen.getByRole('button', { name: /test.*continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid token or token has expired')).toBeInTheDocument();
    });
  });

  it('AUTH-06: shows "Token valid but lacks required permissions" on 403', async () => {
    vi.mocked(validateJira).mockRejectedValue(
      new Error('Token valid but lacks required permissions'),
    );

    renderWithQuery(<JiraStep />);
    fireEvent.click(screen.getByRole('button', { name: /test.*continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Token valid but lacks required permissions')).toBeInTheDocument();
    });
  });

  it('AUTH-06: shows "Cannot reach [URL]" on network error', async () => {
    vi.mocked(validateJira).mockRejectedValue(
      new Error('Cannot reach https://jira.example.com — check the base URL'),
    );

    renderWithQuery(<JiraStep />);
    fireEvent.click(screen.getByRole('button', { name: /test.*continue/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Cannot reach https://jira.example.com — check the base URL'),
      ).toBeInTheDocument();
    });
  });

  it('AUTH-06: "Test & Continue" button shows "Connecting..." while validating', async () => {
    let resolveValidate!: () => void;
    vi.mocked(validateJira).mockReturnValue(
      new Promise((resolve) => {
        resolveValidate = () =>
          resolve({ displayName: 'Jane Smith', emailAddress: 'jane@example.com', name: 'janesmith' });
      }),
    );

    renderWithQuery(<JiraStep />);
    fireEvent.click(screen.getByRole('button', { name: /test.*continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connecting/i })).toBeInTheDocument();
    });

    resolveValidate();
  });

  it('AUTH-06: "Test & Continue" button is disabled while validating', async () => {
    let resolveValidate!: () => void;
    vi.mocked(validateJira).mockReturnValue(
      new Promise((resolve) => {
        resolveValidate = () =>
          resolve({ displayName: 'Jane Smith', emailAddress: 'jane@example.com', name: 'janesmith' });
      }),
    );

    renderWithQuery(<JiraStep />);
    const button = screen.getByRole('button', { name: /test.*continue/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connecting/i })).toBeDisabled();
    });

    resolveValidate();
  });

  it('AUTH-06: back button renders and calls goBack when clicked', () => {
    renderWithQuery(<JiraStep />);
    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockStore.goBack).toHaveBeenCalledTimes(1);
  });
});
