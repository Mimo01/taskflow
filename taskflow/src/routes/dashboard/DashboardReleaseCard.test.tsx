/**
 * DashboardReleaseCard tests — DASH-04
 *
 * Tests soonest unreleased sort (ascending), overdue state,
 * today state (Badge tone="blue"), future days-away state,
 * and empty state (no upcoming releases).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @tanstack/react-query (useQuery)
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
    useQueryClient: vi.fn().mockReturnValue({ getQueryData: vi.fn() }),
  };
});

// Mock jira service
vi.mock('@/services/jira', () => ({
  fetchFixVersions: vi.fn().mockResolvedValue([]),
  fetchReleaseIssues: vi.fn().mockResolvedValue([]),
}));

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// Helper: build a fix version fixture
function makeFixVersion(name: string, releaseDate: string | undefined, released = false) {
  return {
    id: name,
    name,
    released,
    releaseDate,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DashboardReleaseCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 1 (soonest unreleased sort): renders the earliest unreleased version by ascending releaseDate, ignoring released versions', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    // v1: 2030-01-01, v2: 2026-12-31 (earliest unreleased), v3: 2027-06-15
    // v4: released=true, releaseDate='2025-01-01' (must be ignored)
    const versions = [
      makeFixVersion('release-v1', '2030-01-01', false),
      makeFixVersion('release-v2', '2026-12-31', false),
      makeFixVersion('release-v3', '2027-06-15', false),
      makeFixVersion('release-v4', '2025-01-01', true),
    ];

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: versions,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardReleaseCard } = await import('./DashboardReleaseCard');
    renderWithQuery(
      <DashboardReleaseCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
      />,
    );

    // v2 is the soonest unreleased version (2026-12-31)
    expect(screen.getByText('release-v2')).toBeDefined();
    // v4 released version should NOT appear (it's released)
    expect(screen.queryByText('release-v4')).toBeNull();
  });

  it('Test 2 (overdue): renders "5 days overdue" with amber styling when releaseDate is 5 days in the past', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    // System time is 2026-05-21, releaseDate is 2026-05-16 → 5 days overdue
    const versions = [makeFixVersion('release-overdue', '2026-05-16', false)];

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: versions,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardReleaseCard } = await import('./DashboardReleaseCard');
    renderWithQuery(
      <DashboardReleaseCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
      />,
    );

    // Should render "5 days overdue"
    const overdueEl = screen.getByText(/5 days overdue/);
    expect(overdueEl).toBeDefined();

    // Should have amber color class
    const classList = overdueEl.className;
    expect(classList.includes('text-amber-600') || classList.includes('text-amber-400')).toBe(true);
  });

  it('Test 3 (today): renders a Badge with text "Today" when releaseDate equals today', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    // System time is 2026-05-21, releaseDate is 2026-05-21 → due today
    const versions = [makeFixVersion('release-today', '2026-05-21', false)];

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: versions,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardReleaseCard } = await import('./DashboardReleaseCard');
    renderWithQuery(
      <DashboardReleaseCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
      />,
    );

    // Should render "Today" text
    const todayEl = screen.getByText('Today');
    expect(todayEl).toBeDefined();

    // Should be rendered as a Badge (data-slot="badge" or has badge styling)
    // Badge uses data-slot via useRender — check parent chain or self for badge slot
    const el = todayEl;
    const hasSlot =
      el.getAttribute('data-slot') === 'badge' || el.closest('[data-slot="badge"]') !== null;
    expect(hasSlot).toBe(true);
  });

  it('Test 4 (future days away): renders "7 days away" when releaseDate is 7 days in the future', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    // System time is 2026-05-21, releaseDate is 2026-05-28 → 7 days away
    const versions = [makeFixVersion('release-future', '2026-05-28', false)];

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: versions,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardReleaseCard } = await import('./DashboardReleaseCard');
    renderWithQuery(
      <DashboardReleaseCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
      />,
    );

    expect(screen.getByText(/7 days away/)).toBeDefined();
  });

  it('Test 5 (empty state): renders "No upcoming releases" when no unreleased version with releaseDate exists', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    // Empty array — no fix versions at all
    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardReleaseCard } = await import('./DashboardReleaseCard');
    renderWithQuery(
      <DashboardReleaseCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
      />,
    );

    expect(screen.getByText('No upcoming releases')).toBeDefined();
  });

  it('Test 6 (progress bar): renders Progress bar and "42% complete · 5 / 12 issues" caption when 5 of 12 release issues are done', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    function makeReleaseIssue(key: string, statusCategoryKey: string) {
      return {
        id: key,
        key,
        fields: { status: { statusCategory: { key: statusCategoryKey } } },
      };
    }

    const versions = [makeFixVersion('release-v1', '2026-05-28', false)];
    const issues = [
      ...Array.from({ length: 5 }, (_, i) => makeReleaseIssue(`PROJ-${i + 1}`, 'done')),
      ...Array.from({ length: 7 }, (_, i) => makeReleaseIssue(`PROJ-${i + 6}`, 'indeterminate')),
    ];

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: versions,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: issues,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardReleaseCard } = await import('./DashboardReleaseCard');
    renderWithQuery(
      <DashboardReleaseCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
      />,
    );

    expect(screen.getByText('42% complete · 5 / 12 issues')).toBeDefined();
    // Progress bar is present (role="progressbar")
    expect(screen.getByRole('progressbar')).toBeDefined();
  });

  it('Test 7 (progress bar zero-issue): renders "0% complete · 0 / 0 issues" and Progress value 0 when no issues are tagged to the release', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const versions = [makeFixVersion('release-empty', '2026-06-01', false)];

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: versions,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardReleaseCard } = await import('./DashboardReleaseCard');
    renderWithQuery(
      <DashboardReleaseCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
      />,
    );

    expect(screen.getByText('0% complete · 0 / 0 issues')).toBeDefined();
  });

  it('Test 8 (no soonest version): renders "No upcoming releases" empty state and no progress bar when fixVersions returns no unreleased versions', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>);

    const { default: DashboardReleaseCard } = await import('./DashboardReleaseCard');
    renderWithQuery(
      <DashboardReleaseCard
        jiraBaseUrl="https://jira.example.com"
        jiraToken="token"
        activeJiraProject="PROJ"
      />,
    );

    expect(screen.getByText('No upcoming releases')).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
