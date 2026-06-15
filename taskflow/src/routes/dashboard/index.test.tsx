/**
 * Dashboard index tests — DASH-01, DASH-02, DASH-03, DASH-05, DASH-07
 *
 * Tests: hero greeting (displayName + fallback), today's date in en-GB format,
 * absence of widget controls (DASH-05), stat tiles grid (DASH-02),
 * SprintHealthSection and DashboardReleaseCard presence (DASH-03/01).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock child components for isolation
vi.mock('./StatTile', () => ({
  default: vi.fn(({ label, value }: { label: string; value: number }) => (
    <div data-testid={`stat-tile-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      {label}: {value}
    </div>
  )),
}));

vi.mock('./SprintHealthSection', () => ({
  default: vi.fn(() => <div data-testid="sprint-health-section-stub" />),
}));

vi.mock('./DashboardReleaseCard', () => ({
  default: vi.fn(() => <div data-testid="release-card-stub" />),
}));

// Mock auth store — overridden per-test where needed
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    jiraUsername: 'alice',
    jiraUserDisplayName: 'Alice Doe',
  })),
}));

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
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

// Mock useDelayedLoading — always return false (no loading) for deterministic tests
vi.mock('@/hooks/useDelayedLoading', () => ({
  useDelayedLoading: vi.fn(() => false),
}));

// Mock react-router-dom — useOutletContext returns stub context
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(() => ({ onIssueClick: vi.fn() })),
  };
});

// Mock fetchSprintIssues to return empty array (no network calls in tests)
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

describe('Dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00Z'));
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      jiraUsername: 'alice',
      jiraUserDisplayName: 'Alice Doe',
    } as ReturnType<typeof useAuthStore>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 1 (greeting renders first name only): heading contains "Alice" but not "Doe"', () => {
    renderDashboard();
    // Heading contains first name
    expect(screen.getByText(/Alice/)).toBeTruthy();
    // Last name must NOT appear
    expect(screen.queryByText(/Alice Doe/)).toBeNull();
  });

  it('Test 2 (Jane Doe): heading contains "Jane" but not "Doe"', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      jiraUsername: 'jane',
      jiraUserDisplayName: 'Jane Doe',
    } as ReturnType<typeof useAuthStore>);
    renderDashboard();
    expect(screen.getByText(/Jane/)).toBeTruthy();
    expect(screen.queryByText(/Doe/)).toBeNull();
  });

  it("Test 3 (today's date in en-GB format): renders the computed locale date string", () => {
    renderDashboard();
    const expected = new Date('2026-05-21T12:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('Test 4 (greeting fallback when displayName is null): renders graceful fallback with "there"', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      jiraUsername: 'alice',
      jiraUserDisplayName: null,
    } as ReturnType<typeof useAuthStore>);
    renderDashboard();
    expect(screen.getByText(/there/)).toBeTruthy();
  });

  it('Test 5 (single-token displayName): heading renders "Alice" without crash', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      jiraUsername: 'alice',
      jiraUserDisplayName: 'Alice',
    } as ReturnType<typeof useAuthStore>);
    renderDashboard();
    expect(screen.getByText(/Alice/)).toBeTruthy();
  });

  it('Test 6 (modern header, no ambient SVG): bold title rendered, ambient hero SVG removed', () => {
    renderDashboard();
    // Header now uses the MyTasksPage bold-title pattern (text-3xl), not the old text-6xl hero.
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-3xl');
    // The decorative ambient-curve <section> SVG is intentionally gone after this visual pass.
    expect(document.querySelector('section svg')).toBeNull();
  });

  it('Test 7 (DASH-05 — no drag/picker/resize markers): dashboard has no widget controls', () => {
    renderDashboard();
    expect(screen.queryByText(/widget picker/i)).toBeNull();
    expect(document.querySelector('.react-grid-layout')).toBeNull();
    expect(document.querySelector('.react-resizable-handle')).toBeNull();
    expect(document.querySelector('[data-drag-handle]')).toBeNull();
    expect(screen.queryByRole('button', { name: /add widget/i })).toBeNull();
  });

  it('Test 8 (DASH-02 — stat tiles rendered): renders 4 stat tiles (Open, In Progress, Overdue, SP Done)', () => {
    renderDashboard();
    expect(screen.getByTestId('stat-tile-open')).toBeTruthy();
    expect(screen.getByTestId('stat-tile-in-progress')).toBeTruthy();
    expect(screen.getByTestId('stat-tile-overdue')).toBeTruthy();
    expect(screen.getByTestId('stat-tile-sp-done')).toBeTruthy();
  });

  it('Test 9 (SURNAME Firstname OrgCode (status) format): extracts mixed-case first name from all-caps surname format', () => {
    // Reproduces the actual auth.json value: "DOE Jane ACME (ext.)"
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.orange.sk',
      activeJiraProject: 'ESHOP',
      jiraUsername: 'ext99328',
      jiraUserDisplayName: 'DOE Jane ACME (ext.)',
    } as ReturnType<typeof useAuthStore>);
    renderDashboard();
    expect(screen.getByText(/Jane/)).toBeTruthy();
    expect(screen.queryByText(/DOE/)).toBeNull();
  });

  it('Test 10 ([Disabled] bracketed token stripped): first name extracted after stripping [Disabled]', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      jiraUsername: 'bob',
      jiraUserDisplayName: 'Bob Smith [Disabled]',
    } as ReturnType<typeof useAuthStore>);
    renderDashboard();
    expect(screen.getByText(/Bob/)).toBeTruthy();
    expect(screen.queryByText(/\[Disabled\]/)).toBeNull();
  });

  it('Test 11 (DASH-03/01 — SprintHealthSection and DashboardReleaseCard rendered): both new sections present', () => {
    renderDashboard();
    expect(screen.getByTestId('sprint-health-section-stub')).toBeTruthy();
    expect(screen.getByTestId('release-card-stub')).toBeTruthy();
  });

  it('Test 12 (DASH-01 — deleted cards absent): no sprint-card-stub, in-progress-card-stub in DOM', () => {
    renderDashboard();
    expect(screen.queryByTestId('sprint-card-stub')).toBeNull();
    expect(screen.queryByTestId('in-progress-card-stub')).toBeNull();
  });
});
