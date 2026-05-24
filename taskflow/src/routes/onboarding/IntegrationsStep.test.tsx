// WIZ-02: Continue gating (D-01..D-04) — AIO enabled/project/loading/error/empty states
// WIZ-03: Tempo toggle reads/writes tempoEnabled from useSettingsStore
// WIZ-04: Continue click sets integrationsVisited=true and calls goNext

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import IntegrationsStep from './IntegrationsStep';

// ── Settings store mock ──────────────────────────────────────────────────────
// Selector-aware, same shape as AioBlock.test.tsx / IntegrationsSection.test.tsx.
const mockStore: {
  aioEnabled: boolean;
  setAioEnabled: ReturnType<typeof vi.fn>;
  selectedAioProjectKey: string | null;
  setSelectedAioProjectKey: ReturnType<typeof vi.fn>;
  tempoEnabled: boolean;
  setTempoEnabled: ReturnType<typeof vi.fn>;
} = {
  aioEnabled: false,
  setAioEnabled: vi.fn(),
  selectedAioProjectKey: null,
  setSelectedAioProjectKey: vi.fn(),
  tempoEnabled: false,
  setTempoEnabled: vi.fn(),
};

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: (selector?: (s: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));

// ── Onboarding store mock ────────────────────────────────────────────────────
// Module-level object so test assertions can read spy call counts directly.
const mockOnboardingStore = {
  goBack: vi.fn(),
  goNext: vi.fn(),
  set: vi.fn(),
};

vi.mock('@/stores/onboarding.store', () => ({
  useOnboardingStore: () => mockOnboardingStore,
}));

// ── AioBlock stub ────────────────────────────────────────────────────────────
// Isolates IntegrationsStep navigation/gating logic — AioBlock tested separately.
vi.mock('@/components/integrations/AioBlock', () => ({
  default: () => <div data-testid="aio-block" />,
}));

// ── Services / auth mocks ────────────────────────────────────────────────────
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/services/aio', () => ({
  fetchAioProjects: vi.fn(),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));

// ── QueryClient helper ───────────────────────────────────────────────────────
function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderWithClient(ui: ReactElement) {
  return render(<QueryClientProvider client={makeClient()}>{ui}</QueryClientProvider>);
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('IntegrationsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.aioEnabled = false;
    mockStore.tempoEnabled = false;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockReset();
    // vi.clearAllMocks() resets readSecret — re-arm so token resolves
    vi.mocked(readSecret).mockResolvedValue('test-jira-token');
    mockOnboardingStore.goBack.mockReset();
    mockOnboardingStore.goNext.mockReset();
    mockOnboardingStore.set.mockReset();
  });

  it('renders the step heading and subtitle', () => {
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<IntegrationsStep />);
    expect(screen.getByRole('heading', { name: /set up integrations/i })).toBeInTheDocument();
    expect(
      screen.getByText(/enable optional plugins to see test execution and worklog data/i),
    ).toBeInTheDocument();
  });

  it('mounts the AioBlock stub', () => {
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<IntegrationsStep />);
    expect(screen.getByTestId('aio-block')).toBeInTheDocument();
  });

  it('renders Back and Continue buttons', () => {
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<IntegrationsStep />);
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  // ── D-02: isLoading → Continue disabled ───────────────────────────────────
  it('D-02: Continue is disabled when aioEnabled=true and query isLoading', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = null;
    // Never-resolving promise holds the query in the loading state
    vi.mocked(fetchAioProjects).mockImplementation(() => new Promise(() => {}) as Promise<never>);
    renderWithClient(<IntegrationsStep />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });
  });

  // ── D-03: isError → Continue disabled ─────────────────────────────────────
  it('D-03: Continue is disabled when aioEnabled=true and query isError', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockRejectedValue(new Error('network error'));
    renderWithClient(<IntegrationsStep />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });
  });

  // ── D-04: projects=[] → Continue disabled ─────────────────────────────────
  it('D-04: Continue is disabled when aioEnabled=true and projects=[]', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<IntegrationsStep />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });
  });

  // ── D-01: selectedAioProjectKey=null, projects loaded → Continue disabled ──
  it('D-01: Continue is disabled when aioEnabled=true and no project selected (projects loaded)', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
    ]);
    renderWithClient(<IntegrationsStep />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });
  });

  // ── D-01 short-circuit: aioEnabled=false → Continue always enabled ─────────
  it('D-01: Continue is enabled when aioEnabled=false regardless of project state', async () => {
    mockStore.aioEnabled = false;
    mockStore.selectedAioProjectKey = null;
    // Query state irrelevant when aioEnabled=false
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<IntegrationsStep />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });
  });

  // ── D-01: project selected, projects loaded → Continue enabled ─────────────
  it('D-01: Continue is enabled when aioEnabled=true, project selected, and projects loaded', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = 'PROJ1';
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
    ]);
    renderWithClient(<IntegrationsStep />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });
  });

  // ── WIZ-03: Tempo toggle renders and calls setTempoEnabled ─────────────────
  it('WIZ-03: Tempo toggle renders and clicking it calls setTempoEnabled(true)', () => {
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<IntegrationsStep />);
    const tempoCheckbox = screen.getByRole('checkbox', { name: /enable tempo timesheets/i });
    expect(tempoCheckbox).toBeInTheDocument();
    fireEvent.click(tempoCheckbox);
    expect(mockStore.setTempoEnabled).toHaveBeenCalledWith(true);
  });

  // ── WIZ-04: Continue click sets integrationsVisited=true and goNext ─────────
  it('WIZ-04: clicking Continue calls set({ integrationsVisited: true }) and goNext', async () => {
    mockStore.aioEnabled = false; // ensure Continue is enabled
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<IntegrationsStep />);
    const continueBtn = await screen.findByRole('button', { name: /continue/i });
    fireEvent.click(continueBtn);
    expect(mockOnboardingStore.set).toHaveBeenCalledWith({ integrationsVisited: true });
    expect(mockOnboardingStore.goNext).toHaveBeenCalledTimes(1);
  });

  // ── Back button calls goBack ────────────────────────────────────────────────
  it('clicking Back calls goBack', () => {
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<IntegrationsStep />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockOnboardingStore.goBack).toHaveBeenCalledTimes(1);
  });
});
