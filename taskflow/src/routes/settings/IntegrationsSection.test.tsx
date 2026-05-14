import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import IntegrationsSection from './IntegrationsSection';

const mockStore: {
  aioEnabled: boolean;
  setAioEnabled: ReturnType<typeof vi.fn>;
  selectedAioProjectKey: string | null;
  setSelectedAioProjectKey: ReturnType<typeof vi.fn>;
} = {
  aioEnabled: false,
  setAioEnabled: vi.fn(),
  selectedAioProjectKey: null,
  setSelectedAioProjectKey: vi.fn(),
};

vi.mock('../../stores/settings.store', () => ({
  useSettingsStore: (selector?: (s: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/services/aio', () => ({
  fetchAioProjects: vi.fn(),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));

// Replace the base-ui Select primitive with a deterministic <select>+<option>
// stand-in. Reason: base-ui Select renders its options into a positioned portal
// driven by floating-ui, which does not lay out reliably in jsdom — clicking
// the trigger opens the listbox but options never mount in the test DOM. The
// stand-in keeps the same prop API (`value`, `onValueChange`) so the wiring
// from IntegrationsSection → setSelectedAioProjectKey is what gets exercised.
vi.mock('@/components/ui/select', () => {
  type SelectProps = {
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  };
  type ItemProps = { value: string; children?: React.ReactNode };
  type GenericProps = { children?: React.ReactNode; [key: string]: unknown };

  const SelectContext = React.createContext<{
    value: string;
    onValueChange: (v: string) => void;
    disabled: boolean;
  }>({ value: '', onValueChange: () => {}, disabled: false });

  function Select({
    value = '',
    onValueChange = () => {},
    disabled = false,
    children,
  }: SelectProps) {
    return (
      <SelectContext.Provider value={{ value, onValueChange, disabled }}>
        {children}
      </SelectContext.Provider>
    );
  }
  function SelectTrigger({ children, ...rest }: GenericProps) {
    const ctx = React.useContext(SelectContext);
    return (
      <button type="button" disabled={ctx.disabled} {...rest}>
        {children}
      </button>
    );
  }
  function SelectContent({ children }: GenericProps) {
    const ctx = React.useContext(SelectContext);
    return (
      <select
        data-testid="aio-project-select"
        value={ctx.value}
        onChange={(e) => ctx.onValueChange(e.target.value)}
      >
        <option value="" disabled hidden>
          —
        </option>
        {children}
      </select>
    );
  }
  function SelectItem({ value, children }: ItemProps) {
    return <option value={value}>{children}</option>;
  }
  return { Select, SelectTrigger, SelectContent, SelectItem };
});

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
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockReset();
    // vi.clearAllMocks() also clears the readSecret mock — re-arm it so the
    // useEffect resolves the token and the useQuery `enabled` guard becomes true.
    vi.mocked(readSecret).mockResolvedValue('test-jira-token');
  });

  it('hides the picker when aioEnabled is false', () => {
    mockStore.aioEnabled = false;
    renderWithClient(<IntegrationsSection />);
    // Label "AIO Project" should NOT be in the DOM (D-02 gate).
    // Note: "AIO Test Management" heading is still rendered — match exact label.
    expect(screen.queryByLabelText('AIO Project')).toBeNull();
    expect(screen.queryByText('Pick the AIO Test Management project this app shows.')).toBeNull();
  });

  it('renders the project list when aioEnabled is true and the query resolves', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = 'PROJ2'; // pre-select to verify trigger label lookup
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
      { id: 2, projectKey: 'PROJ2', name: 'Project Two' },
      { id: 3, projectKey: 'PROJ3', name: 'Project Three' },
    ]);
    renderWithClient(<IntegrationsSection />);
    // Label is visible
    expect(screen.getByText('AIO Project')).toBeInTheDocument();
    // After query resolves, all 3 projects render as <option>s inside the mocked
    // SelectContent (one <option> per project + the disabled placeholder).
    await waitFor(() => {
      const opts = document.querySelectorAll('[data-testid="aio-project-select"] option');
      expect(opts.length).toBe(4); // 1 placeholder + 3 projects
    });
    // The trigger label displays the project NAME from the selectedProject lookup
    // (Pitfall 3) — name appears in both the trigger span and the matching option,
    // so assert via findAllByText and require at least 2 occurrences (trigger + option).
    const matches = await screen.findAllByText('Project Two');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    // Helper text under picker is present
    expect(
      screen.getByText('Pick the AIO Test Management project this app shows.'),
    ).toBeInTheDocument();
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
    // Wait for the data-loaded branch to render — the mocked Select renders a
    // native <select data-testid="aio-project-select"> once the query resolves
    // AND its <option> children are populated from the projects array.
    await waitFor(() => {
      const opts = document.querySelectorAll('[data-testid="aio-project-select"] option');
      expect(opts.length).toBeGreaterThan(1); // placeholder + projects
    });
    const select = screen.getByTestId('aio-project-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'PROJ2' } });
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
    await waitFor(() => {
      const opts = document.querySelectorAll('[data-testid="aio-project-select"] option');
      expect(opts.length).toBeGreaterThan(1);
    });
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
    await waitFor(() => {
      const opts = document.querySelectorAll('[data-testid="aio-project-select"] option');
      expect(opts.length).toBeGreaterThan(1);
    });
    expect(screen.queryByText(/no longer available/)).toBeNull();
  });
});
