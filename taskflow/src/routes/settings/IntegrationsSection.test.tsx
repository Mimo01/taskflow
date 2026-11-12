import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import IntegrationsSection from './IntegrationsSection';

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

vi.mock('../../stores/settings.store', () => ({
  useSettingsStore: (selector?: (s: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// The Release Management picker has its own tests (ReleaseManagementBlock.test.tsx). Stub it
// here: it renders its own picker, which would collide on the shared "Loading projects…" / "Retry" texts these AIO assertions query.
vi.mock('@/components/integrations/ReleaseManagementBlock', () => ({
  default: () => null,
}));

vi.mock('@/services/aio', () => ({
  fetchAioProjects: vi.fn(),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));

/** Hand back the AIO trigger once the list has loaded (it is briefly rendered, then swapped for the loading row). */
async function openablePicker(): Promise<HTMLElement> {
  await waitFor(() => expect(fetchAioProjects).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText('Loading projects…')).toBeNull());
  return waitFor(() => {
    const trigger = document.getElementById('aio-project');
    expect(trigger).not.toBeNull();
    expect(trigger).toBeEnabled();
    return trigger as HTMLElement;
  });
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderWithClient(ui: ReactElement) {
  return render(<QueryClientProvider client={makeClient()}>{ui}</QueryClientProvider>);
}

describe('IntegrationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.aioEnabled = false;
    mockStore.tempoEnabled = false;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockReset();
    // vi.clearAllMocks() also clears the readSecret mock — re-arm it so the
    // useEffect resolves the token and the useQuery `enabled` guard becomes true.
    vi.mocked(readSecret).mockResolvedValue('test-jira-token');
  });

  it('renders Integrations heading', () => {
    renderWithClient(<IntegrationsSection />);
    expect(screen.getByRole('heading', { name: /integrations/i })).toBeInTheDocument();
  });

  it('renders AIO Test Management checkbox', () => {
    renderWithClient(<IntegrationsSection />);
    expect(
      screen.getByRole('checkbox', { name: /enable aio test management/i }),
    ).toBeInTheDocument();
  });

  it('checkbox is unchecked when aioEnabled=false', () => {
    renderWithClient(<IntegrationsSection />);
    expect(screen.getByRole('checkbox', { name: /enable aio test management/i })).not.toBeChecked();
  });

  it('checkbox is checked when aioEnabled=true', () => {
    mockStore.aioEnabled = true;
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<IntegrationsSection />);
    expect(screen.getByRole('checkbox', { name: /enable aio test management/i })).toBeChecked();
  });

  it('toggling checkbox calls setAioEnabled(true)', () => {
    renderWithClient(<IntegrationsSection />);
    fireEvent.click(screen.getByRole('checkbox', { name: /enable aio test management/i }));
    expect(mockStore.setAioEnabled).toHaveBeenCalledWith(true);
  });
});

describe('IntegrationsSection — AIO project picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.aioEnabled = false;
    mockStore.tempoEnabled = false;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockReset();
    // vi.clearAllMocks() also clears the readSecret mock — re-arm it so the
    // useEffect resolves the token and the useQuery `enabled` guard becomes true.
    vi.mocked(readSecret).mockResolvedValue('test-jira-token');
  });

  it('hides the picker when aioEnabled is false', () => {
    mockStore.aioEnabled = false;
    renderWithClient(<IntegrationsSection />);
    // Label "AIO Project Key" should NOT be in the DOM (D-02 gate).
    // Note: "AIO Test Management" heading is still rendered — match exact label.
    expect(screen.queryByLabelText('AIO Project Key')).toBeNull();
    expect(
      screen.queryByText('Pick the AIO Test Management project key this app shows.'),
    ).toBeNull();
  });

  it('renders the project list when aioEnabled is true and the query resolves', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = 'PROJ2'; // pre-select to verify trigger label lookup
    // Non-alphabetical order: Three, One, Two — after sorting must render One, Three, Two
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 3, projectKey: 'PROJ3', name: 'Project Three' },
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
      { id: 2, projectKey: 'PROJ2', name: 'Project Two' },
    ]);
    renderWithClient(<IntegrationsSection />);
    // Label is visible
    expect(screen.getByText('AIO Project Key')).toBeInTheDocument();
    const user = userEvent.setup();
    const trigger = await openablePicker();
    // The trigger label displays the project NAME from the selectedProject lookup (Pitfall 3).
    expect(trigger).toHaveTextContent('Project Two');
    await user.click(trigger);
    // Alphabetical by name: Project One, Project Three, Project Two
    expect((await screen.findAllByRole('option')).map((el) => el.textContent)).toEqual([
      'Project One',
      'Project Three',
      'Project Two',
    ]);
    // Helper text under picker is present
    expect(
      screen.getByText('Pick the AIO Test Management project key this app shows.'),
    ).toBeInTheDocument();
  });

  it('sorts AIO project options alphabetically by name (case-insensitive)', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = null;
    // Mixed-case names in non-alphabetical order
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 3, projectKey: 'C', name: 'charlie' },
      { id: 1, projectKey: 'A', name: 'Alpha' },
      { id: 2, projectKey: 'B', name: 'bravo' },
    ]);
    renderWithClient(<IntegrationsSection />);
    await userEvent.setup().click(await openablePicker());
    // Case-insensitive alphabetical: Alpha → bravo → charlie
    expect((await screen.findAllByRole('option')).map((el) => el.textContent)).toEqual([
      'Alpha',
      'bravo',
      'charlie',
    ]);
  });

  it('calls setSelectedAioProjectKey with the projectKey when an option is selected', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
      { id: 2, projectKey: 'PROJ2', name: 'Project Two' },
      { id: 3, projectKey: 'PROJ3', name: 'Project Three' },
    ]);
    renderWithClient(<IntegrationsSection />);
    const user = userEvent.setup();
    await user.click(await openablePicker());
    await user.click(await screen.findByRole('option', { name: 'Project Two' }));
    expect(mockStore.setSelectedAioProjectKey).toHaveBeenCalledWith('PROJ2');
  });

  it('shows the loading row while the query is pending', async () => {
    mockStore.aioEnabled = true;
    // Never-resolving promise to hold the query in `pending` state.
    vi.mocked(fetchAioProjects).mockImplementation(() => new Promise(() => {}) as Promise<never>);
    renderWithClient(<IntegrationsSection />);
    await waitFor(() => {
      expect(screen.getByText('Loading projects…')).toBeInTheDocument();
    });
  });

  it('shows the error row and a Retry button when the query rejects', async () => {
    mockStore.aioEnabled = true;
    vi.mocked(fetchAioProjects).mockRejectedValue(new Error('boom'));
    renderWithClient(<IntegrationsSection />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/Couldn't load AIO projects/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it("shows a disabled Select with 'No AIO projects available' when projects=[]", async () => {
    mockStore.aioEnabled = true;
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<IntegrationsSection />);
    await waitFor(() => {
      expect(screen.getByText('No AIO projects available')).toBeInTheDocument();
    });
    // Disabled state on the Select trigger — base-ui renders the `disabled`
    // attribute on the underlying button. Navigate via DOM from the placeholder.
    const placeholder = screen.getByText('No AIO projects available');
    const trigger = placeholder.closest('button') as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    expect(trigger).toBeDisabled();
  });

  // D-14 silent persist — negative assertion: no useNavigate is mocked or imported,
  // so any router call would be undefined and throw. Existence of passing tests above
  // that select items implicitly verifies no navigation happens on change.

  it('WR-01: shows destructive stale-key warning when selectedAioProjectKey is not in fetched projects', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = 'GHOST'; // persisted key not present in the list below
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
      { id: 2, projectKey: 'PROJ2', name: 'Project Two' },
    ]);
    renderWithClient(<IntegrationsSection />);
    // Wait for projects to resolve so the stale-key derivation has Array projects + non-match.
    await openablePicker();
    expect(
      await screen.findByText(
        /Previously selected project "GHOST" is no longer available\. Pick another or clear the selection\./,
      ),
    ).toBeInTheDocument();
  });

  it('WR-01: stale-key warning is absent when selectedProject resolves to a known project', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = 'PROJ2';
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
      { id: 2, projectKey: 'PROJ2', name: 'Project Two' },
    ]);
    renderWithClient(<IntegrationsSection />);
    await openablePicker();
    expect(screen.queryByText(/no longer available/)).toBeNull();
  });
});

describe('Tempo Timesheets toggle (Phase 61)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.aioEnabled = false;
    mockStore.tempoEnabled = false;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockReset();
    vi.mocked(readSecret).mockResolvedValue('test-jira-token');
  });

  it('renders Tempo Timesheets checkbox', () => {
    renderWithClient(<IntegrationsSection />);
    expect(screen.getByRole('checkbox', { name: /enable tempo timesheets/i })).toBeInTheDocument();
  });

  it('checkbox is unchecked when tempoEnabled=false', () => {
    renderWithClient(<IntegrationsSection />);
    expect(screen.getByRole('checkbox', { name: /enable tempo timesheets/i })).not.toBeChecked();
  });

  it('checkbox is checked when tempoEnabled=true', () => {
    mockStore.tempoEnabled = true;
    renderWithClient(<IntegrationsSection />);
    expect(screen.getByRole('checkbox', { name: /enable tempo timesheets/i })).toBeChecked();
  });

  it('toggling checkbox calls setTempoEnabled(true)', () => {
    renderWithClient(<IntegrationsSection />);
    fireEvent.click(screen.getByRole('checkbox', { name: /enable tempo timesheets/i }));
    expect(mockStore.setTempoEnabled).toHaveBeenCalledWith(true);
  });
});
