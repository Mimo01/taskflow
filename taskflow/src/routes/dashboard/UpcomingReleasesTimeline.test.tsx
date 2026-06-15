/**
 * UpcomingReleasesTimeline.test.tsx — Phase 86 D-06/D-07/D-08
 *
 * Tests for UpcomingReleasesTimeline — up-to-3-dot release timeline card.
 * Uses useQuery/useQueries mock pattern (same as DashboardReleaseCard.test.tsx).
 *
 * Guards:
 * - D-08: exactly 2 dots render for a 2-version fixture (no placeholder third dot)
 * - D-06/D-08: "No upcoming releases" empty state for 0 versions / no due dates
 * - D-08: "Tomorrow" renders for daysUntil===1 fixture
 * - Render: role="region" accessibility
 */
import type { UseQueryResult } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Safe partial mock — project convention: single cast from unknown (no explicit any)
function mockQuery<T>(partial: Partial<UseQueryResult<T>>): UseQueryResult<T> {
  return partial as unknown as UseQueryResult<T>;
}

// useQueries returns an array — cast each element similarly
function mockQueriesResult(items: Array<{ data: unknown; isLoading: boolean }>) {
  return items as unknown as ReturnType<typeof import('@tanstack/react-query').useQueries>;
}

// Mock @tanstack/react-query (useQuery + useQueries)
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, error: null }),
    useQueries: vi.fn().mockReturnValue([]),
  };
});

// Mock jira service
vi.mock('@/services/jira', () => ({
  fetchFixVersions: vi.fn().mockResolvedValue([]),
  fetchReleaseIssues: vi.fn().mockResolvedValue([]),
}));

function makeFixVersion(name: string, releaseDate: string | undefined, released = false) {
  return { id: name, name, released, releaseDate };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const defaultProps = {
  jiraBaseUrl: 'https://jira.example.com',
  jiraToken: 'test-token',
  activeJiraProject: 'PROJ',
};

describe('UpcomingReleasesTimeline — D-08 fewer-than-3 dots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('D-08: renders exactly 2 dots when only 2 upcoming releases exist (no placeholder third dot)', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    const versions = [
      makeFixVersion('v1.0', '2026-07-01', false),
      makeFixVersion('v2.0', '2026-08-01', false),
    ];

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: versions, isLoading: false, error: null, refetch: vi.fn() }),
    );

    vi.mocked(useQueries).mockReturnValue(
      mockQueriesResult([
        { data: [], isLoading: false },
        { data: [], isLoading: false },
      ]),
    );

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    const dots = document.querySelectorAll('[data-testid="release-dot"]');
    expect(dots.length).toBe(2);
  });

  it('D-08: renders exactly 3 dots when 3 upcoming releases exist', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    const versions = [
      makeFixVersion('v1.0', '2026-07-01', false),
      makeFixVersion('v2.0', '2026-08-01', false),
      makeFixVersion('v3.0', '2026-09-01', false),
    ];

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: versions, isLoading: false, error: null, refetch: vi.fn() }),
    );

    vi.mocked(useQueries).mockReturnValue(
      mockQueriesResult([
        { data: [], isLoading: false },
        { data: [], isLoading: false },
        { data: [], isLoading: false },
      ]),
    );

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    const dots = document.querySelectorAll('[data-testid="release-dot"]');
    expect(dots.length).toBe(3);
  });

  it('D-08: renders only 3 dots even when more than 3 upcoming releases exist (slice to 3)', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    const versions = [
      makeFixVersion('v1.0', '2026-07-01', false),
      makeFixVersion('v2.0', '2026-08-01', false),
      makeFixVersion('v3.0', '2026-09-01', false),
      makeFixVersion('v4.0', '2026-10-01', false),
      makeFixVersion('v5.0', '2026-11-01', false),
    ];

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: versions, isLoading: false, error: null, refetch: vi.fn() }),
    );

    // Component slices to 3 so useQueries only gets 3 queries
    vi.mocked(useQueries).mockReturnValue(
      mockQueriesResult([
        { data: [], isLoading: false },
        { data: [], isLoading: false },
        { data: [], isLoading: false },
      ]),
    );

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    const dots = document.querySelectorAll('[data-testid="release-dot"]');
    expect(dots.length).toBe(3);
  });
});

describe('UpcomingReleasesTimeline — D-06/D-08 empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('D-06/D-08: renders "No upcoming releases" when no fix versions exist', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
    );
    vi.mocked(useQueries).mockReturnValue(mockQueriesResult([]));

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    expect(screen.getByText('No upcoming releases')).toBeTruthy();
  });

  it('D-06: renders empty state when all fix versions are released', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    const versions = [
      makeFixVersion('v0.9', '2026-01-01', true),
      makeFixVersion('v0.8', '2025-12-01', true),
    ];

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: versions, isLoading: false, error: null, refetch: vi.fn() }),
    );
    vi.mocked(useQueries).mockReturnValue(mockQueriesResult([]));

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    expect(screen.getByText('No upcoming releases')).toBeTruthy();
  });

  it('D-06: renders empty state when unreleased versions have no releaseDate', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    const versions = [makeFixVersion('v-no-date', undefined, false)];

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: versions, isLoading: false, error: null, refetch: vi.fn() }),
    );
    vi.mocked(useQueries).mockReturnValue(mockQueriesResult([]));

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    expect(screen.getByText('No upcoming releases')).toBeTruthy();
  });

  it('renders empty state subtitle copy', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
    );
    vi.mocked(useQueries).mockReturnValue(mockQueriesResult([]));

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    expect(screen.getByText('No unreleased versions with a due date were found.')).toBeTruthy();
  });
});

describe('UpcomingReleasesTimeline — D-08 "Tomorrow" label', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // System time: 2026-06-15 — "tomorrow" = 2026-06-16
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('D-08: renders the literal "Tomorrow" label for a version due in 1 day (daysUntil===1)', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    const versions = [makeFixVersion('v-tomorrow', '2026-06-16', false)];

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: versions, isLoading: false, error: null, refetch: vi.fn() }),
    );
    vi.mocked(useQueries).mockReturnValue(
      mockQueriesResult([{ data: [], isLoading: false }]),
    );

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    expect(screen.getByText('Tomorrow')).toBeTruthy();
  });

  it('D-08: renders "Today" label for a version due today', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    const versions = [makeFixVersion('v-today', '2026-06-15', false)];

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: versions, isLoading: false, error: null, refetch: vi.fn() }),
    );
    vi.mocked(useQueries).mockReturnValue(
      mockQueriesResult([{ data: [], isLoading: false }]),
    );

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('D-08: renders "in N days" label for a version due in more than 1 day', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    const versions = [makeFixVersion('v-future', '2026-06-22', false)];

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: versions, isLoading: false, error: null, refetch: vi.fn() }),
    );
    vi.mocked(useQueries).mockReturnValue(
      mockQueriesResult([{ data: [], isLoading: false }]),
    );

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    expect(screen.getByText('in 7 days')).toBeTruthy();
  });

  it('renders "overdue" with amber styling for a past-due version', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    const versions = [makeFixVersion('v-overdue', '2026-06-10', false)];

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: versions, isLoading: false, error: null, refetch: vi.fn() }),
    );
    vi.mocked(useQueries).mockReturnValue(
      mockQueriesResult([{ data: [], isLoading: false }]),
    );

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    const overdueEl = screen.getByText('overdue');
    expect(overdueEl).toBeTruthy();
    const cls = overdueEl.className;
    expect(cls.includes('text-amber-600') || cls.includes('text-amber-400')).toBe(true);
  });
});

describe('UpcomingReleasesTimeline — region accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has role="region" with aria-label="Upcoming releases"', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
    );
    vi.mocked(useQueries).mockReturnValue(mockQueriesResult([]));

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    const region = screen.getByRole('region', { name: /upcoming releases/i });
    expect(region).toBeTruthy();
  });
});

describe('UpcomingReleasesTimeline — donePct readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders "{donePct}% ready" for each release dot', async () => {
    const { useQuery, useQueries } = await import('@tanstack/react-query');

    const versions = [makeFixVersion('v1.0', '2026-07-01', false)];

    vi.mocked(useQuery).mockReturnValue(
      mockQuery({ data: versions, isLoading: false, error: null, refetch: vi.fn() }),
    );

    // 5 done, 5 not done → 50% ready
    const issues = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `done-${i}`,
        key: `PROJ-${i}`,
        fields: { status: { statusCategory: { key: 'done' } } },
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `todo-${i}`,
        key: `PROJ-${i + 5}`,
        fields: { status: { statusCategory: { key: 'new' } } },
      })),
    ];

    vi.mocked(useQueries).mockReturnValue(
      mockQueriesResult([{ data: issues, isLoading: false }]),
    );

    const { default: UpcomingReleasesTimeline } = await import('./UpcomingReleasesTimeline');
    renderWithQuery(<UpcomingReleasesTimeline {...defaultProps} />);

    expect(screen.getByText('50% ready')).toBeTruthy();
  });
});
