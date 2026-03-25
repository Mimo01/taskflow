import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import UpdatesSection from './UpdatesSection';

// Mock react-markdown to render children as plain text
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));
vi.mock('remark-gfm', () => ({ default: vi.fn() }));

// Mock build-info
vi.mock('@/lib/build-info', () => ({
  buildInfo: { version: '1.6.0', commitSha: 'abc1234', buildDate: '2026-03-24' },
}));

// Mock settings store
const mockSettingsStore = {
  updateCheckInterval: 6 as 1 | 6 | 12 | 24 | 'manual',
  setUpdateCheckInterval: vi.fn(),
  lastChecked: null as string | null,
  setLastChecked: vi.fn(),
};
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: Object.assign(
    (selector?: (s: typeof mockSettingsStore) => unknown) =>
      selector ? selector(mockSettingsStore) : mockSettingsStore,
    { getState: () => mockSettingsStore },
  ),
}));

// Mock update store
const mockUpdateStore = {
  status: 'idle' as 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error',
  availableVersion: null as string | null,
  setChecking: vi.fn(),
  setAvailable: vi.fn(),
  setError: vi.fn(),
  resetToIdle: vi.fn(),
};
vi.mock('@/stores/update.store', () => ({
  useUpdateStore: Object.assign(
    (selector?: (s: typeof mockUpdateStore) => unknown) =>
      selector ? selector(mockUpdateStore) : mockUpdateStore,
    { getState: () => mockUpdateStore },
  ),
}));

// Mock updater service
const mockCheck = vi.fn().mockResolvedValue(null);
vi.mock('@/services/updater', () => ({
  updaterService: { check: (...args: unknown[]) => mockCheck(...args) },
}));

// Mock global fetch for version history
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('UpdatesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsStore.updateCheckInterval = 6;
    mockSettingsStore.lastChecked = null;
    mockUpdateStore.status = 'idle';
    mockUpdateStore.availableVersion = null;
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            tag_name: 'v1.6.0',
            name: 'v1.6.0',
            published_at: '2026-03-24T12:00:00Z',
            body: '## Changes\n- Feature A',
            prerelease: false,
            draft: false,
          },
          {
            tag_name: 'v1.5.0',
            name: 'v1.5.0',
            published_at: '2026-03-20T12:00:00Z',
            body: '## Changes\n- Feature B',
            prerelease: false,
            draft: false,
          },
        ]),
    });
  });

  it('renders section-updates testid', () => {
    renderWithQuery(<UpdatesSection />);
    expect(screen.getByTestId('section-updates')).toBeInTheDocument();
  });

  it('renders current version display', () => {
    renderWithQuery(<UpdatesSection />);
    expect(screen.getByText(/1\.6\.0/)).toBeInTheDocument();
  });

  it('renders Updates heading', () => {
    renderWithQuery(<UpdatesSection />);
    // Use level:2 to match only the h2 "Updates", not h3 "Check for updates"
    expect(screen.getByRole('heading', { name: /^updates$/i, level: 2 })).toBeInTheDocument();
  });

  it('renders Check Now button', () => {
    renderWithQuery(<UpdatesSection />);
    expect(screen.getByRole('button', { name: /check now/i })).toBeInTheDocument();
  });

  it('renders check frequency dropdown', () => {
    renderWithQuery(<UpdatesSection />);
    // Check the label for the select is present
    expect(screen.getByText('Check frequency')).toBeInTheDocument();
    // Verify the Select trigger is rendered (aria-haspopup="listbox")
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('hides last checked when never checked', () => {
    mockSettingsStore.lastChecked = null;
    renderWithQuery(<UpdatesSection />);
    expect(screen.queryByText(/last checked/i)).not.toBeInTheDocument();
  });

  it('shows last checked when timestamp exists', () => {
    mockSettingsStore.lastChecked = new Date().toISOString();
    renderWithQuery(<UpdatesSection />);
    expect(screen.getByText(/last checked/i)).toBeInTheDocument();
  });

  it('Check Now button shows checking state', async () => {
    // Make check hang so we can see the checking state
    mockCheck.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<UpdatesSection />);
    const btn = screen.getByRole('button', { name: /check now/i });
    fireEvent.click(btn);
    expect(await screen.findByText(/checking/i)).toBeInTheDocument();
  });

  it('renders version history loading skeletons', () => {
    // Return a never-resolving promise to keep loading state
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<UpdatesSection />);
    // Skeletons are rendered during loading — use data-slot attribute from shadcn Skeleton
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    // At least some skeleton elements should exist
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders version history release rows when loaded', async () => {
    renderWithQuery(<UpdatesSection />);
    await waitFor(() => {
      expect(screen.getByText('v1.6.0')).toBeInTheDocument();
      expect(screen.getByText('v1.5.0')).toBeInTheDocument();
    });
  });

  it('shows (current) badge for matching version', async () => {
    renderWithQuery(<UpdatesSection />);
    await waitFor(() => {
      expect(screen.getByText('current')).toBeInTheDocument();
    });
  });

  it('shows error state with Retry when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    // Override queryFn retry at the client level to skip exponential backoff
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Override component-level retry:1 via client default
          gcTime: 0,
          staleTime: 0,
        },
      },
    });
    render(
      <QueryClientProvider client={qc}>
        <UpdatesSection />
      </QueryClientProvider>,
    );
    await waitFor(
      () => {
        expect(screen.getByText(/unable to load release history/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('expands release row to show changelog on click', async () => {
    renderWithQuery(<UpdatesSection />);
    await waitFor(() => {
      expect(screen.getByText('v1.5.0')).toBeInTheDocument();
    });
    // Click v1.5.0 row to expand
    fireEvent.click(screen.getByText('v1.5.0'));
    await waitFor(() => {
      expect(screen.getByText(/feature b/i)).toBeInTheDocument();
    });
  });
});
