import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import AioBlock from './AioBlock';

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

vi.mock('@/stores/settings.store', () => ({
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
// from AioBlock → setSelectedAioProjectKey is what gets exercised.
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

describe('AioBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.aioEnabled = false;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockReset();
    // vi.clearAllMocks() also clears the readSecret mock — re-arm it so the
    // useEffect resolves the token and the useQuery `enabled` guard becomes true.
    vi.mocked(readSecret).mockResolvedValue('test-jira-token');
  });

  it('renders AIO Test Management checkbox', () => {
    renderWithClient(<AioBlock />);
    expect(
      screen.getByRole('checkbox', { name: /enable aio test management/i }),
    ).toBeInTheDocument();
  });

  it('checkbox is unchecked when aioEnabled=false', () => {
    renderWithClient(<AioBlock />);
    expect(screen.getByRole('checkbox', { name: /enable aio test management/i })).not.toBeChecked();
  });

  it('checkbox is checked when aioEnabled=true', () => {
    mockStore.aioEnabled = true;
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<AioBlock />);
    expect(screen.getByRole('checkbox', { name: /enable aio test management/i })).toBeChecked();
  });

  it('toggling checkbox calls setAioEnabled(true)', () => {
    renderWithClient(<AioBlock />);
    fireEvent.click(screen.getByRole('checkbox', { name: /enable aio test management/i }));
    expect(mockStore.setAioEnabled).toHaveBeenCalledWith(true);
  });
});

describe('AioBlock — AIO project picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.aioEnabled = false;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockReset();
    vi.mocked(readSecret).mockResolvedValue('test-jira-token');
  });

  it('hides the picker when aioEnabled is false', () => {
    mockStore.aioEnabled = false;
    renderWithClient(<AioBlock />);
    // Label "AIO Project Key" should NOT be in the DOM when toggle is off.
    expect(screen.queryByLabelText('AIO Project Key')).toBeNull();
    expect(screen.queryByText('Pick the AIO Test Management project key this app shows.')).toBeNull();
  });

  it('shows loading row while query is pending', async () => {
    mockStore.aioEnabled = true;
    // Never-resolving promise to hold the query in `pending` state.
    vi.mocked(fetchAioProjects).mockImplementation(() => new Promise(() => {}) as Promise<never>);
    renderWithClient(<AioBlock />);
    await waitFor(() => {
      expect(screen.getByText('Loading projects…')).toBeInTheDocument();
    });
  });

  it('shows error row with role="alert" and Retry button when query rejects', async () => {
    mockStore.aioEnabled = true;
    vi.mocked(fetchAioProjects).mockRejectedValue(new Error('boom'));
    renderWithClient(<AioBlock />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/Couldn't load AIO projects/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it("shows disabled Select with 'No AIO projects available' when projects=[]", async () => {
    mockStore.aioEnabled = true;
    vi.mocked(fetchAioProjects).mockResolvedValue([]);
    renderWithClient(<AioBlock />);
    await waitFor(() => {
      expect(screen.getByText('No AIO projects available')).toBeInTheDocument();
    });
    // Disabled state on the Select trigger button
    const placeholder = screen.getByText('No AIO projects available');
    const trigger = placeholder.closest('button') as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    expect(trigger).toBeDisabled();
  });

  it('renders project list sorted alphabetically case-insensitive when resolved', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = 'PROJ2';
    // Non-alphabetical order: Three, One, Two — after sorting must be One, Three, Two
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 3, projectKey: 'PROJ3', name: 'Project Three' },
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
      { id: 2, projectKey: 'PROJ2', name: 'Project Two' },
    ]);
    renderWithClient(<AioBlock />);
    await waitFor(() => {
      const opts = document.querySelectorAll('[data-testid="aio-project-select"] option');
      expect(opts.length).toBe(4); // 1 placeholder + 3 projects
    });
    const opts = Array.from(document.querySelectorAll('[data-testid="aio-project-select"] option'));
    const names = opts.map((el) => el.textContent);
    // First option is the placeholder (—), then sorted alphabetically
    expect(names).toEqual(['—', 'Project One', 'Project Three', 'Project Two']);

    // Mixed case sort check — re-render with a new client so the query refetches
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 3, projectKey: 'C', name: 'charlie' },
      { id: 1, projectKey: 'A', name: 'Alpha' },
      { id: 2, projectKey: 'B', name: 'bravo' },
    ]);
    renderWithClient(<AioBlock />);
    await waitFor(() => {
      // Use the last rendered select to avoid picking up the previous render's options
      const selects = screen.getAllByTestId('aio-project-select');
      const lastSelect = selects[selects.length - 1];
      const opts = Array.from(lastSelect.querySelectorAll('option'));
      expect(opts.map((el) => el.textContent)).toEqual(['—', 'Alpha', 'bravo', 'charlie']);
    });
  });

  it('calls setSelectedAioProjectKey with projectKey on option selection', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = null;
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
      { id: 2, projectKey: 'PROJ2', name: 'Project Two' },
      { id: 3, projectKey: 'PROJ3', name: 'Project Three' },
    ]);
    renderWithClient(<AioBlock />);
    await waitFor(() => {
      const opts = document.querySelectorAll('[data-testid="aio-project-select"] option');
      expect(opts.length).toBeGreaterThan(1); // placeholder + projects
    });
    const select = screen.getByTestId('aio-project-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'PROJ2' } });
    expect(mockStore.setSelectedAioProjectKey).toHaveBeenCalledWith('PROJ2');
  });

  it('WR-01: shows stale-key warning when selectedAioProjectKey not in fetched projects', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = 'GHOST'; // persisted key not present in list
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
      { id: 2, projectKey: 'PROJ2', name: 'Project Two' },
    ]);
    renderWithClient(<AioBlock />);
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

  it('WR-01: no stale-key warning when selectedAioProjectKey resolves to known project', async () => {
    mockStore.aioEnabled = true;
    mockStore.selectedAioProjectKey = 'PROJ2';
    vi.mocked(fetchAioProjects).mockResolvedValue([
      { id: 1, projectKey: 'PROJ1', name: 'Project One' },
      { id: 2, projectKey: 'PROJ2', name: 'Project Two' },
    ]);
    renderWithClient(<AioBlock />);
    await waitFor(() => {
      const opts = document.querySelectorAll('[data-testid="aio-project-select"] option');
      expect(opts.length).toBeGreaterThan(1);
    });
    expect(screen.queryByText(/no longer available/)).toBeNull();
  });
});
