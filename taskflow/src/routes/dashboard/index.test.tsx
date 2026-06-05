/**
 * Dashboard index tests — DASH-01, DASH-05
 *
 * Tests: hero greeting (displayName + fallback), today's date in en-GB format,
 * absence of widget controls (DASH-05), and presence of all three card stubs.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock child card components for isolation
vi.mock('./DashboardSprintCard', () => ({
  default: vi.fn(() => <div data-testid="sprint-card-stub" />),
}));

vi.mock('./DashboardInProgressCard', () => ({
  default: vi.fn(() => <div data-testid="in-progress-card-stub" />),
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

// Mock useBoardId — Dashboard resolves a board id for the (mocked) sprint card;
// stub it so these greeting/layout tests need no QueryClientProvider.
vi.mock('@/hooks/useBoardId', () => ({
  useBoardId: () => ({ boardId: null, isLoading: false }),
}));

// Mock react-router-dom — useOutletContext returns null by default in MemoryRouter; mock prevents TypeError
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(() => ({ onIssueClick: vi.fn() })),
  };
});

import { useOutletContext } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import DashboardInProgressCard from './DashboardInProgressCard';
import Dashboard from './index';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
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

  it('Test 6 (decorative SVG present): hero section contains an aria-hidden SVG', () => {
    renderDashboard();
    const svg = document.querySelector('section svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('Test 7 (DASH-05 — no drag/picker/resize markers): dashboard has no widget controls', () => {
    renderDashboard();
    expect(screen.queryByText(/widget picker/i)).toBeNull();
    expect(document.querySelector('.react-grid-layout')).toBeNull();
    expect(document.querySelector('.react-resizable-handle')).toBeNull();
    expect(document.querySelector('[data-drag-handle]')).toBeNull();
    expect(screen.queryByRole('button', { name: /add widget/i })).toBeNull();
  });

  it('Test 8 (three card components rendered): renders all three dashboard cards', () => {
    renderDashboard();
    expect(screen.getByTestId('sprint-card-stub')).toBeTruthy();
    expect(screen.getByTestId('in-progress-card-stub')).toBeTruthy();
    expect(screen.getByTestId('release-card-stub')).toBeTruthy();
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

  it('Test 11 (HB4 — In-Progress card opens full page with fresh breadcrumb trail): forwards no peek handler and wraps onIssueClick with resetTrail=true', () => {
    // The breadcrumb-reset wrapping lives at this call site, not in the card —
    // dropping the ", true" must fail a test. Capture the props the (mocked)
    // card receives and exercise its onIssueClick.
    const outletOnIssueClick = vi.fn();
    vi.mocked(useOutletContext).mockReturnValue({ onIssueClick: outletOnIssueClick });
    renderDashboard();

    const cardCalls = vi.mocked(DashboardInProgressCard).mock.calls;
    expect(cardCalls.length).toBeGreaterThan(0);
    const cardProps = cardCalls[cardCalls.length - 1][0] as {
      onIssueClick: (key: string, resetTrail?: boolean) => void;
      onOpenIssue?: unknown;
    };

    // No peek handler is forwarded — dashboard-home clicks are full-page only.
    expect(cardProps.onOpenIssue).toBeUndefined();

    // Invoking the card's onIssueClick navigates full-page AND resets the trail.
    cardProps.onIssueClick('PROJ-101');
    expect(outletOnIssueClick).toHaveBeenCalledWith('PROJ-101', true);
  });
});
