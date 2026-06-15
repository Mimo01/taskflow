/**
 * Dashboard index tests — Phase 86 D-01/D-13
 *
 * Tests: 3-region layout (MyIssuesCard, UpcomingReleasesTimeline, HoursCommitsChart),
 * sprint-day subline with active sprint (D-13), absence of sprint clause when
 * activeSprint=null (D-13), hero greeting + date subline.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the 3 new child components for isolation
vi.mock('./MyIssuesCard', () => ({
  default: vi.fn(() => <div data-testid="my-issues-card-stub" />),
}));

vi.mock('./UpcomingReleasesTimeline', () => ({
  default: vi.fn(() => <div data-testid="upcoming-releases-stub" />),
}));

vi.mock('./HoursCommitsChart', () => ({
  default: vi.fn(() => <div data-testid="hours-commits-chart-stub" />),
}));

// Mock auth store — overridden per-test where needed
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    jiraUsername: 'alice',
    jiraUserDisplayName: 'Alice Doe',
    gitlabBaseUrl: null,
    gitlabUsername: null,
    gitlabName: null,
    gitlabEmail: null,
    activeGitlabProject: 0,
    jiraUserKey: null,
  })),
}));

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
    tempoEnabled: false,
  })),
}));

// Mock stronghold — PAT load must not throw
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// Mock useBoardId — stub so tests need no real board resolution
vi.mock('@/hooks/useBoardId', () => ({
  useBoardId: () => ({ boardId: null, isLoading: false }),
}));

// Mock react-router-dom — useOutletContext returns stub context
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(() => ({ onIssueClick: vi.fn(), onOpenIssue: vi.fn() })),
  };
});

// Mock fetchSprintIssues + fetchActiveSprint (no network calls in tests)
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
  fetchActiveSprint: vi.fn().mockResolvedValue(null),
}));

import { useAuthStore } from '@/stores/auth.store';
import Dashboard from './index';

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Dashboard — Phase 86 3-region layout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00Z'));
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      jiraUsername: 'alice',
      jiraUserDisplayName: 'Alice Doe',
      gitlabBaseUrl: null,
      gitlabUsername: null,
      gitlabName: null,
      gitlabEmail: null,
      activeGitlabProject: 0,
      jiraUserKey: null,
    } as ReturnType<typeof useAuthStore>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 1 (D-01 — 3 new regions rendered): MyIssuesCard, UpcomingReleasesTimeline, and HoursCommitsChart are all present', () => {
    renderDashboard();
    expect(screen.getByTestId('my-issues-card-stub')).toBeTruthy();
    expect(screen.getByTestId('upcoming-releases-stub')).toBeTruthy();
    expect(screen.getByTestId('hours-commits-chart-stub')).toBeTruthy();
  });

  it('Test 2 (D-01 — no old widgets): none of the 7 deleted widget stubs appear', () => {
    renderDashboard();
    expect(screen.queryByTestId('sprint-health-section-stub')).toBeNull();
    expect(screen.queryByTestId('stat-tile-open')).toBeNull();
    expect(screen.queryByTestId('weekly-trend-chart-stub')).toBeNull();
    expect(screen.queryByTestId('activity-strip-stub')).toBeNull();
    expect(screen.queryByTestId('release-card-stub')).toBeNull();
    expect(screen.queryByTestId('velocity-chart-stub')).toBeNull();
    expect(screen.queryByTestId('burndown-chart-stub')).toBeNull();
  });

  it('Test 3 (D-13 — sprint-day clause with active sprint): subline contains "Sprint day N of M"', async () => {
    const { fetchActiveSprint } = await import('@/services/jira');
    vi.mocked(fetchActiveSprint).mockResolvedValue({
      id: 42,
      name: 'Sprint 42',
      state: 'active',
      startDate: '2026-05-18T00:00:00.000Z', // Mon — 3 days before 2026-05-21
      endDate: '2026-05-31T00:00:00.000Z', // Sun — 13 days after start (14-day sprint)
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Pre-seed activeSprint into cache so the component reads it synchronously
    queryClient.setQueryData(['jira-active-sprint', 'PROJ', 'https://jira.example.com', null], {
      id: 42,
      name: 'Sprint 42',
      state: 'active',
      startDate: '2026-05-18',
      endDate: '2026-05-31',
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // 2026-05-21 is day 4 of a sprint starting 2026-05-18 (elapsed = (21-18)+1 = 4)
    // total = (31-18)+1 = 14
    const subline = screen.getByText(/Sprint day/);
    expect(subline).toBeTruthy();
    expect(subline.textContent).toMatch(/Sprint day 4 of 14/);
  });

  it('Test 4 (D-13 — no sprint-day clause when activeSprint=null): subline shows date only, no "Sprint day"', () => {
    renderDashboard();
    // The date subline element must exist
    const expected = new Date('2026-05-21T12:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    expect(screen.getByText(new RegExp(expected.slice(0, 10)))).toBeTruthy();
    // "Sprint day" must NOT appear
    expect(screen.queryByText(/Sprint day/)).toBeNull();
  });

  it('Test 5 (hero greeting): heading contains first name "Alice" extracted from "Alice Doe"', () => {
    renderDashboard();
    expect(screen.getByText(/Alice/)).toBeTruthy();
    expect(screen.queryByText(/Alice Doe/)).toBeNull();
  });

  it('Test 6 (greeting fallback): renders "there" when displayName is null', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      jiraUsername: 'alice',
      jiraUserDisplayName: null,
      gitlabBaseUrl: null,
      gitlabUsername: null,
      gitlabName: null,
      gitlabEmail: null,
      activeGitlabProject: 0,
      jiraUserKey: null,
    } as ReturnType<typeof useAuthStore>);
    renderDashboard();
    expect(screen.getByText(/there/)).toBeTruthy();
  });

  it('Test 7 (hero heading is text-4xl): h1 has text-4xl class', () => {
    renderDashboard();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.className).toContain('text-4xl');
  });

  it('Test 8 (D-05 — no widget controls): no drag/picker/resize markers', () => {
    renderDashboard();
    expect(screen.queryByText(/widget picker/i)).toBeNull();
    expect(document.querySelector('.react-grid-layout')).toBeNull();
    expect(document.querySelector('.react-resizable-handle')).toBeNull();
    expect(document.querySelector('[data-drag-handle]')).toBeNull();
    expect(screen.queryByRole('button', { name: /add widget/i })).toBeNull();
  });
});
