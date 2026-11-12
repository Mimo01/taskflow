import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UpdatesSection from './UpdatesSection';

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
  status: 'idle' as 'idle' | 'checking' | 'available' | 'downloading' | 'error',
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

function release(tag: string, body: string, published = '2026-03-01T12:00:00Z') {
  return {
    tag_name: tag,
    name: tag,
    published_at: published,
    body,
    prerelease: false,
    draft: false,
  };
}

function page(rows: unknown[], link?: string) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(rows),
    headers: { get: (n: string) => (n.toLowerCase() === 'link' ? (link ?? null) : null) },
  };
}

/** The release row button for a version (not the "Current version" text). */
function row(version: string) {
  return screen.queryByRole('button', {
    name: new RegExp(`^${version.replace(/\./g, '\\.')}(?!\\d)`),
  });
}

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
    mockFetch.mockResolvedValue(
      page([
        release(
          'v1.6.0',
          'Newest.\n\n### New\n- **Feature A** — does a thing',
          '2026-03-24T12:00:00Z',
        ),
        release('v1.5.0', 'Older.\n\n### Fixed\n- **Fix B**', '2026-03-20T12:00:00Z'),
      ]),
    );
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
    expect(screen.getByText('Check frequency')).toBeInTheDocument();
    // Trigger shows the option label, not the raw interval value
    expect(screen.getByRole('combobox')).toHaveTextContent('Every 6 hours');
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

  it('groups releases under minor-version subheadings', async () => {
    renderWithQuery(<UpdatesSection />);
    await screen.findByRole('heading', { name: '1.6' });
    expect(screen.getByRole('heading', { name: '1.5' })).toBeInTheDocument();
    expect(row('1.6.0')).toBeInTheDocument();
    expect(row('1.5.0')).toBeInTheDocument();
  });

  it('marks the installed version only', async () => {
    renderWithQuery(<UpdatesSection />);
    expect(await screen.findByText('Installed')).toBeInTheDocument();
    expect(screen.getAllByText('Installed')).toHaveLength(1);
  });

  it('loads every page via the Link header and shows the latest 8 until asked', async () => {
    const first = Array.from({ length: 13 }, (_, i) => release(`v1.6.${12 - i}`, `Notes ${i}.`));
    const second = Array.from({ length: 13 }, (_, i) => release(`v1.3.${12 - i}`, `Old ${i}.`));
    mockFetch
      .mockResolvedValueOnce(page(first, '<https://api.example/page2>; rel="next"'))
      .mockResolvedValueOnce(page(second));
    renderWithQuery(<UpdatesSection />);
    const more = await screen.findByRole('button', { name: /show older versions \(18\)/i });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(row('1.6.12')).toBeInTheDocument();
    expect(row('1.6.4')).not.toBeInTheDocument();
    fireEvent.click(more);
    expect(row('1.6.4')).toBeInTheDocument();
    expect(row('1.3.0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show older versions/i })).not.toBeInTheDocument();
  });

  it('expands a release to one-line title · description items', async () => {
    renderWithQuery(<UpdatesSection />);
    const r = await screen.findByRole('button', { name: /1\.6\.0/ });
    expect(screen.queryByText('Feature A')).not.toBeInTheDocument();
    fireEvent.click(r);
    expect(r).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Feature A')).toBeInTheDocument();
    // One line: title, then the description muted on the same line; headline not repeated
    expect(screen.getByText(/· does a thing/)).toBeInTheDocument();
    expect(screen.getAllByText('Newest.')).toHaveLength(1);
  });

  it('shows error state with Retry that refetches', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    renderWithQuery(<UpdatesSection />);
    const retry = await screen.findByRole('button', { name: /retry/i }, { timeout: 5000 });
    expect(screen.getByText(/unable to load release history/i)).toBeInTheDocument();
    mockFetch.mockResolvedValue(page([release('v1.6.0', 'Back.\n\n### New\n- **Again**')]));
    fireEvent.click(retry);
    await screen.findByRole('heading', { name: '1.6' });
    expect(row('1.6.0')).toBeInTheDocument();
  });
});
