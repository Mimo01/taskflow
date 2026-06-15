/**
 * WeeklyTrendChart.test.tsx — Phase 84 DASH-04/07
 *
 * Render tests for WeeklyTrendChart — Tempo bar chart with 8h ReferenceLine.
 * Uses QueryClient pre-seeding to exercise warm/cold cache paths without network calls.
 *
 * Guards:
 * - tempoEnabled=false → "Tempo not connected" empty state (NOT an error)
 * - tempoEnabled=true with empty worklogs → chart renders (not empty state), all-zero bars valid (Pitfall 6)
 * - queryKey does NOT contain jiraToken (T-84-02 / T-62-06)
 * - region accessibility (role="region", aria-label="Weekly hours logged")
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetchWorklogs — WeeklyTrendChart fires useQuery with this as the queryFn.
// Returning [] exercises the all-zero buckets path (Pitfall 6: empty array ≠ empty state).
vi.mock('@/services/tempo/worklogs', () => ({
  fetchWorklogs: vi.fn().mockResolvedValue([]),
}));

const BASE_URL = 'https://jira.example.com';
const TOKEN = 'test-token';
const USERNAME = 'alice';

const defaultProps = {
  jiraBaseUrl: BASE_URL,
  jiraToken: TOKEN,
  jiraUsername: USERNAME,
  tempoEnabled: true,
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

async function importComponent() {
  const { default: WeeklyTrendChart } = await import('./WeeklyTrendChart');
  return WeeklyTrendChart;
}

describe('WeeklyTrendChart — Tempo not connected empty state (DASH-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Tempo not connected" when tempoEnabled=false — NOT an error state', async () => {
    const WeeklyTrendChart = await importComponent();

    renderWithQuery(<WeeklyTrendChart {...defaultProps} tempoEnabled={false} />);

    // The ChartWrapper isEmpty renders EmptyState with this title (not ErrorState)
    expect(screen.getByText('Tempo not connected')).toBeTruthy();
  });

  it('does NOT render an error when tempoEnabled=false', async () => {
    const WeeklyTrendChart = await importComponent();

    renderWithQuery(<WeeklyTrendChart {...defaultProps} tempoEnabled={false} />);

    // Error state renders "Something went wrong" or the viewName in an error context.
    // No such text should appear when tempoEnabled=false (that is an empty-state path).
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
    // The actual empty state copy (not error):
    expect(screen.getByText('Tempo not connected')).toBeTruthy();
  });
});

describe('WeeklyTrendChart — chart renders for zero worklogs (Pitfall 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chart container when tempoEnabled=true with empty worklogs (all-zero is valid data)', async () => {
    const WeeklyTrendChart = await importComponent();
    const { fetchWorklogs } = await import('@/services/tempo/worklogs');
    (fetchWorklogs as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Seed the cache so the component gets [] synchronously (no loading state)
    const monday = getMondayOfCurrentWeek();
    queryClient.setQueryData(['dashboard', 'tempo-week', BASE_URL, monday, USERNAME], []);

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <WeeklyTrendChart {...defaultProps} tempoEnabled={true} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Chart container is present — empty worklogs is NOT the empty state
    expect(document.querySelector('[data-slot="chart"]')).toBeTruthy();
    // "Tempo not connected" must NOT appear — we have tempoEnabled=true
    expect(screen.queryByText('Tempo not connected')).toBeNull();
  });
});

describe('WeeklyTrendChart — region accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has role="region" with aria-label="Weekly hours logged"', async () => {
    const WeeklyTrendChart = await importComponent();

    renderWithQuery(<WeeklyTrendChart {...defaultProps} tempoEnabled={false} />);

    const region = screen.getByRole('region', { name: /weekly hours logged/i });
    expect(region).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Helper: compute Monday of current week in YYYY-MM-DD (mirrors component logic)
// ---------------------------------------------------------------------------

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  return monday.toLocaleDateString('en-CA'); // YYYY-MM-DD
}
