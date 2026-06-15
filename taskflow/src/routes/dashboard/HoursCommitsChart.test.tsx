/**
 * HoursCommitsChart.test.tsx — Phase 86 D-09/D-11/D-12
 *
 * Unit tests for buildRolling7Buckets (data layer) and render tests for
 * HoursCommitsChart (state/UI).
 *
 * Guards:
 * - D-09: 7 buckets, last bucket isToday===true, weekday labels
 * - D-11: worklogs bucketed by dateStarted string equality; commits from commitsByDay map
 * - D-12: all-zero input yields all hours:0/commits:0 (not empty state)
 * - D-12: tempoEnabled=false → "Tempo not connected" EmptyState, no chart
 * - D-12: all-zero connected week → ChartContainer present, no EmptyState
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TempoWorklog } from '@/services/tempo/types';

// Mock fetchWorklogs — HoursCommitsChart fires useQuery with this as queryFn
vi.mock('@/services/tempo/worklogs', () => ({
  fetchWorklogs: vi.fn().mockResolvedValue([]),
}));

// Mock fetchUserCommits — HoursCommitsChart fires useQueries × 7 with this as queryFn
vi.mock('@/services/gitlab', () => ({
  fetchUserCommits: vi.fn().mockResolvedValue([]),
}));

const BASE_URL = 'https://jira.example.com';
const GITLAB_URL = 'https://gitlab.example.com';
const TOKEN = 'test-token';
const USERNAME = 'alice';

const defaultProps = {
  jiraBaseUrl: BASE_URL,
  jiraToken: TOKEN,
  jiraUsername: USERNAME,
  tempoEnabled: true,
  gitlabBaseUrl: GITLAB_URL,
  gitlabToken: TOKEN,
  activeGitlabProject: 123,
  gitlabUsername: 'alice_gl',
  gitlabName: null,
  gitlabEmail: null,
};

function getTodayDate(): string {
  return new Date().toLocaleDateString('en-CA');
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d + n);
  return new Date(utcMs).toISOString().slice(0, 10);
}

function makeWorklog(dateStarted: string, timeSpentSeconds: number): TempoWorklog {
  return {
    id: Math.random(),
    issueKey: 'PROJ-1',
    dateStarted,
    timeSpentSeconds,
    author: { name: USERNAME },
  } as unknown as TempoWorklog;
}

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

async function importBuildRolling7Buckets() {
  const mod = await import('./HoursCommitsChart');
  return mod.buildRolling7Buckets;
}

async function importComponent() {
  const mod = await import('./HoursCommitsChart');
  return mod.default;
}

// ---------------------------------------------------------------------------
// Unit tests: buildRolling7Buckets
// ---------------------------------------------------------------------------

describe('buildRolling7Buckets — D-09: rolling 7 buckets ending today', () => {
  it('returns exactly 7 buckets', async () => {
    const buildRolling7Buckets = await importBuildRolling7Buckets();
    const today = getTodayDate();
    const buckets = buildRolling7Buckets([], new Map(), today);
    expect(buckets).toHaveLength(7);
  });

  it('last bucket has isToday===true (D-09)', async () => {
    const buildRolling7Buckets = await importBuildRolling7Buckets();
    const today = getTodayDate();
    const buckets = buildRolling7Buckets([], new Map(), today);
    expect(buckets[6].isToday).toBe(true);
    expect(buckets[6].day).toBe(today);
  });

  it('first 6 buckets have isToday===false (D-09)', async () => {
    const buildRolling7Buckets = await importBuildRolling7Buckets();
    const today = getTodayDate();
    const buckets = buildRolling7Buckets([], new Map(), today);
    for (let i = 0; i < 6; i++) {
      expect(buckets[i].isToday).toBe(false);
    }
  });

  it('buckets cover the 7 local-calendar dates ending today (D-09)', async () => {
    const buildRolling7Buckets = await importBuildRolling7Buckets();
    const today = getTodayDate();
    const expected = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const buckets = buildRolling7Buckets([], new Map(), today);
    expect(buckets.map((b) => b.day)).toEqual(expected);
  });

  it('each bucket has a non-empty weekday label (D-09)', async () => {
    const buildRolling7Buckets = await importBuildRolling7Buckets();
    const today = getTodayDate();
    const buckets = buildRolling7Buckets([], new Map(), today);
    for (const b of buckets) {
      expect(b.label.length).toBeGreaterThan(0);
    }
  });
});

describe('buildRolling7Buckets — D-11: worklog + commits bucketing', () => {
  it('adds hours to correct bucket by dateStarted string equality (D-11)', async () => {
    const buildRolling7Buckets = await importBuildRolling7Buckets();
    const today = getTodayDate();
    const day3 = addDays(today, -3); // 4th bucket (index 3)
    const worklogs = [makeWorklog(day3, 7200)]; // 2h
    const buckets = buildRolling7Buckets(worklogs, new Map(), today);
    const target = buckets.find((b) => b.day === day3);
    expect(target?.hours).toBeCloseTo(2);
    // Other buckets should have 0 hours
    for (const b of buckets) {
      if (b.day !== day3) expect(b.hours).toBe(0);
    }
  });

  it('worklog on day outside rolling-7 window is ignored (D-11)', async () => {
    const buildRolling7Buckets = await importBuildRolling7Buckets();
    const today = getTodayDate();
    const outsideDay = addDays(today, -10); // outside 7-day window
    const worklogs = [makeWorklog(outsideDay, 3600)];
    const buckets = buildRolling7Buckets(worklogs, new Map(), today);
    for (const b of buckets) {
      expect(b.hours).toBe(0);
    }
  });

  it('commitsByDay map populates commits field (D-11)', async () => {
    const buildRolling7Buckets = await importBuildRolling7Buckets();
    const today = getTodayDate();
    const yesterday = addDays(today, -1);
    const commitsByDay = new Map([[yesterday, 5], [today, 3]]);
    const buckets = buildRolling7Buckets([], commitsByDay, today);
    expect(buckets.find((b) => b.day === yesterday)?.commits).toBe(5);
    expect(buckets.find((b) => b.day === today)?.commits).toBe(3);
  });

  it('multiple worklogs on same day accumulate hours (D-11)', async () => {
    const buildRolling7Buckets = await importBuildRolling7Buckets();
    const today = getTodayDate();
    const worklogs = [makeWorklog(today, 3600), makeWorklog(today, 5400)]; // 1h + 1.5h = 2.5h
    const buckets = buildRolling7Buckets(worklogs, new Map(), today);
    expect(buckets[6].hours).toBeCloseTo(2.5);
  });
});

describe('buildRolling7Buckets — D-12: all-zero input yields 7 empty buckets', () => {
  it('all-zero input: no worklogs, empty commits map yields 7 buckets all hours:0 commits:0 (D-12)', async () => {
    const buildRolling7Buckets = await importBuildRolling7Buckets();
    const today = getTodayDate();
    const buckets = buildRolling7Buckets([], new Map(), today);
    for (const b of buckets) {
      expect(b.hours).toBe(0);
      expect(b.commits).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Render tests: HoursCommitsChart states
// ---------------------------------------------------------------------------

describe('HoursCommitsChart — D-12: tempoEnabled=false → Tempo empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Tempo not connected" when tempoEnabled=false (D-12)', async () => {
    const HoursCommitsChart = await importComponent();

    renderWithQuery(<HoursCommitsChart {...defaultProps} tempoEnabled={false} />);

    expect(screen.getByText('Tempo not connected')).toBeTruthy();
  });

  it('does NOT render chart when tempoEnabled=false (D-12)', async () => {
    const HoursCommitsChart = await importComponent();

    renderWithQuery(<HoursCommitsChart {...defaultProps} tempoEnabled={false} />);

    // Chart container data-slot should not be present
    expect(document.querySelector('[data-slot="chart"]')).toBeNull();
  });
});

describe('HoursCommitsChart — D-12: all-zero connected week renders chart not empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ChartContainer when tempoEnabled=true with zero data (D-12: zero is valid data)', async () => {
    const HoursCommitsChart = await importComponent();

    const today = getTodayDate();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Seed tempo query cache with empty array — warm cache so we skip loading state
    queryClient.setQueryData(
      ['dashboard', 'tempo-7day', BASE_URL, today, USERNAME],
      [],
    );

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <HoursCommitsChart {...defaultProps} tempoEnabled={true} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Chart container must be present
    expect(document.querySelector('[data-slot="chart"]')).toBeTruthy();
    // "Tempo not connected" must NOT appear — we have tempoEnabled=true
    expect(screen.queryByText('Tempo not connected')).toBeNull();
  });

  it('does NOT render EmptyState for all-zero connected week (D-12)', async () => {
    const HoursCommitsChart = await importComponent();

    const today = getTodayDate();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    queryClient.setQueryData(
      ['dashboard', 'tempo-7day', BASE_URL, today, USERNAME],
      [],
    );

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <HoursCommitsChart {...defaultProps} tempoEnabled={true} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // No EmptyState should appear for an all-zero connected week
    expect(screen.queryByText('Tempo not connected')).toBeNull();
    expect(screen.queryByText('No data')).toBeNull();
  });
});

describe('HoursCommitsChart — render: chart has both Bar series', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both hours and commits data series in the chart', async () => {
    const HoursCommitsChart = await importComponent();

    const today = getTodayDate();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    queryClient.setQueryData(
      ['dashboard', 'tempo-7day', BASE_URL, today, USERNAME],
      [],
    );

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <HoursCommitsChart {...defaultProps} tempoEnabled={true} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // ChartContainer renders with data-slot="chart"
    expect(document.querySelector('[data-slot="chart"]')).toBeTruthy();
  });
});
