/**
 * Dashboard index tests — DASH-01, DASH-05
 *
 * Tests: hero greeting (displayName + fallback), today's date in en-GB format,
 * absence of widget controls (DASH-05), and presence of all three card stubs.
 */

import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
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

import Dashboard from './index';
import { useAuthStore } from '@/stores/auth.store';

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

  it('Test 1 (greeting renders displayName): renders "Welcome back, Alice Doe"', () => {
    renderDashboard();
    expect(screen.getByText('Welcome back, Alice Doe')).toBeTruthy();
  });

  it("Test 2 (today's date in en-GB format): renders the computed locale date string", () => {
    renderDashboard();
    const expected = new Date('2026-05-21T12:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('Test 3 (greeting fallback when displayName is null): renders "Welcome back, there"', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      jiraUsername: 'alice',
      jiraUserDisplayName: null,
    } as ReturnType<typeof useAuthStore>);
    renderDashboard();
    expect(screen.getByText('Welcome back, there')).toBeTruthy();
  });

  it('Test 4 (DASH-05 — no drag/picker/resize markers): dashboard has no widget controls', () => {
    renderDashboard();
    expect(screen.queryByText(/widget picker/i)).toBeNull();
    expect(document.querySelector('.react-grid-layout')).toBeNull();
    expect(document.querySelector('.react-resizable-handle')).toBeNull();
    expect(document.querySelector('[data-drag-handle]')).toBeNull();
    expect(screen.queryByRole('button', { name: /add widget/i })).toBeNull();
  });

  it('Test 5 (three card components rendered): renders all three dashboard cards', () => {
    renderDashboard();
    expect(screen.getByTestId('sprint-card-stub')).toBeTruthy();
    expect(screen.getByTestId('in-progress-card-stub')).toBeTruthy();
    expect(screen.getByTestId('release-card-stub')).toBeTruthy();
  });
});
