/**
 * ActivityStrip.test.tsx — Phase 84 DASH-05/07
 *
 * Tests for ActivityStrip:
 *   1. Criterion-2 cache reuse: seeded data renders without firing queryFn
 *   2. Newest-first ordering (commit at 12:00 before jira transition at 10:00)
 *   3. Cap overflow: >CAP entries → "+N more" indicator with correct remainder
 *   4. Independent degradation (DASH-07): one source error, other still renders
 *
 * Key arrays match StandupNotesPage lines 308-403 byte-for-byte — that's the
 * whole point of criterion 2.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveYesterdayDate } from '@/lib/standup-date';
import type { GitLabCommit } from '@/services/gitlab';
import type { JiraActivityItem } from '@/services/jira';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any imports of the mocked modules
// ---------------------------------------------------------------------------

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

const mockFetchJiraActivity = vi.fn().mockResolvedValue([]);
const mockFetchUserCommits = vi.fn().mockResolvedValue([]);

vi.mock('@/services/jira', () => ({
  fetchYesterdayJiraActivity: (...args: unknown[]) => mockFetchJiraActivity(...args),
}));

vi.mock('@/services/gitlab', () => ({
  fetchUserCommits: (...args: unknown[]) => mockFetchUserCommits(...args),
}));

// ---------------------------------------------------------------------------
// Constants — mirror the component under test
// ---------------------------------------------------------------------------

/**
 * Same derivation as ActivityStrip.tsx: the most recent working day.
 * With tempoEnabled=false in defaultProps the component's schedule query is disabled,
 * so it resolves the date with no schedule — identical to resolveYesterdayDate() here.
 */
const yesterdayDate = resolveYesterdayDate();

const JIRA_BASE_URL = 'https://jira.example.com';
const JIRA_PROJECT = 'PROJ';
const JIRA_USERNAME = 'jdoe';

const GL_BASE_URL = 'https://gitlab.example.com';
const GL_PROJECT_ID = 42;
const GL_USERNAME = 'jdoe_gl';
const GL_NAME = 'John Doe';

/**
 * Jira activity query key — byte-identical to StandupNotesPage lines 308-316.
 * Sixth element: jiraUsername ?? ''
 */
const JIRA_ACTIVITY_KEY = [
  'standup',
  'jira',
  JIRA_BASE_URL,
  JIRA_PROJECT,
  yesterdayDate,
  JIRA_USERNAME,
];

/**
 * Commits query key — byte-identical to StandupNotesPage lines 358-367.
 * Sixth element: resolvedAccountsKey || resolvedId.gitlabUsername || resolvedId.gitlabName || ''
 * For the self-user (Dashboard) case: gitlabUsername || gitlabName || ''
 */
const COMMITS_KEY = [
  'standup',
  'commits',
  GL_BASE_URL,
  GL_PROJECT_ID,
  yesterdayDate,
  GL_USERNAME || GL_NAME || '',
];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeJiraItem(overrides: { issueKey?: string; at?: string }): JiraActivityItem {
  return {
    issueKey: overrides.issueKey ?? 'PROJ-1',
    summary: 'Do the thing',
    transitions: [
      {
        fromStatus: 'To Do',
        toStatus: 'In Progress',
        at: overrides.at ?? `${yesterdayDate}T10:00:00.000Z`,
      },
    ],
    comments: [],
  };
}

function makeCommit(overrides: {
  id?: string;
  title?: string;
  authored_date?: string;
}): GitLabCommit {
  return {
    id: overrides.id ?? 'abc123',
    short_id: (overrides.id ?? 'abc123').slice(0, 7),
    title: overrides.title ?? 'feat: add something',
    message: overrides.title ?? 'feat: add something',
    author_name: 'John Doe',
    author_email: 'jdoe@example.com',
    authored_date: overrides.authored_date ?? `${yesterdayDate}T12:00:00.000Z`,
    web_url: `https://gitlab.example.com/commit/${overrides.id ?? 'abc123'}`,
  };
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const defaultProps = {
  jiraBaseUrl: JIRA_BASE_URL,
  jiraToken: 'jira-token',
  jiraUserKey: 'jdoe-key',
  activeJiraProject: JIRA_PROJECT,
  jiraUsername: JIRA_USERNAME,
  // tempoEnabled=false → schedule query disabled → date resolved with no schedule
  // (weekend-skip only), matching resolveYesterdayDate() used for the seeded keys above.
  tempoEnabled: false,
  gitlabBaseUrl: GL_BASE_URL,
  gitlabToken: 'gl-token',
  activeGitlabProject: GL_PROJECT_ID,
  gitlabUsername: GL_USERNAME,
  gitlabName: GL_NAME,
  gitlabEmail: 'jdoe@example.com',
};

async function importComponent() {
  const { default: ActivityStrip } = await import('./ActivityStrip');
  return ActivityStrip;
}

function renderWithQuery(
  ui: React.ReactElement,
  {
    jiraData,
    commitsData,
    jiraError,
  }: {
    jiraData?: JiraActivityItem[];
    commitsData?: GitLabCommit[];
    jiraError?: Error;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });

  if (jiraData !== undefined) {
    queryClient.setQueryData(JIRA_ACTIVITY_KEY, jiraData);
  }
  if (jiraError !== undefined) {
    // Seed an error state for the Jira query
    queryClient.setQueryData(JIRA_ACTIVITY_KEY, undefined);
  }
  if (commitsData !== undefined) {
    queryClient.setQueryData(COMMITS_KEY, commitsData);
  }

  return {
    queryClient,
    ...render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </MemoryRouter>,
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityStrip — shared-key cache reuse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('criterion 2: seeded data renders without calling queryFn (cache reuse)', async () => {
    const ActivityStrip = await importComponent();

    const jiraData = [makeJiraItem({ issueKey: 'PROJ-1', at: `${yesterdayDate}T10:00:00.000Z` })];
    const commitsData = [
      makeCommit({ id: 'abc1', authored_date: `${yesterdayDate}T12:00:00.000Z` }),
    ];

    renderWithQuery(<ActivityStrip {...defaultProps} />, { jiraData, commitsData });

    // The queryFn spies must NOT have been called — data came from the seeded cache.
    // This proves the ActivityStrip key arrays are byte-identical to StandupNotesPage.
    expect(mockFetchJiraActivity).not.toHaveBeenCalled();
    expect(mockFetchUserCommits).not.toHaveBeenCalled();

    // The seeded data should render (confirms the cache was consumed correctly)
    expect(screen.getByText(/PROJ-1/i)).toBeTruthy();
    expect(screen.getByText(/feat: add something/i)).toBeTruthy();
  });

  it('renders newest-first (commit at 12:00 before jira at 10:00)', async () => {
    const ActivityStrip = await importComponent();

    const jiraData = [makeJiraItem({ issueKey: 'PROJ-2', at: `${yesterdayDate}T10:00:00.000Z` })];
    const commitsData = [
      makeCommit({
        id: 'abc2',
        title: 'later commit',
        authored_date: `${yesterdayDate}T12:00:00.000Z`,
      }),
    ];

    renderWithQuery(<ActivityStrip {...defaultProps} />, { jiraData, commitsData });

    // Commit (12:00) should appear before Jira transition (10:00).
    const allText = document.body.textContent ?? '';
    const commitPos = allText.indexOf('later commit');
    const jiraPos = allText.indexOf('PROJ-2');

    expect(commitPos).toBeGreaterThan(-1);
    expect(jiraPos).toBeGreaterThan(-1);
    expect(commitPos).toBeLessThan(jiraPos);
  });

  it('renders "+N more" with correct remainder when entries exceed CAP (6)', async () => {
    const ActivityStrip = await importComponent();

    // CAP = 6; seed 4 commits + 4 jira items = 8 total entries → overflow = 2
    const commitsData = [
      makeCommit({ id: 'c1', authored_date: `${yesterdayDate}T14:00:00.000Z` }),
      makeCommit({ id: 'c2', authored_date: `${yesterdayDate}T13:00:00.000Z` }),
      makeCommit({ id: 'c3', authored_date: `${yesterdayDate}T12:00:00.000Z` }),
      makeCommit({ id: 'c4', authored_date: `${yesterdayDate}T11:00:00.000Z` }),
    ];
    // Each JiraActivityItem with one transition = 1 merged entry
    const jiraData = [
      makeJiraItem({ issueKey: 'PROJ-10', at: `${yesterdayDate}T10:30:00.000Z` }),
      makeJiraItem({ issueKey: 'PROJ-11', at: `${yesterdayDate}T10:00:00.000Z` }),
      makeJiraItem({ issueKey: 'PROJ-12', at: `${yesterdayDate}T09:30:00.000Z` }),
      makeJiraItem({ issueKey: 'PROJ-13', at: `${yesterdayDate}T09:00:00.000Z` }),
    ];

    renderWithQuery(<ActivityStrip {...defaultProps} />, { jiraData, commitsData });

    // Should render "+2 more" overflow indicator
    expect(screen.getByText('+2 more')).toBeTruthy();
  });

  it('DASH-07: jira error + commits succeed → commit rows still render (strip not blank)', async () => {
    const ActivityStrip = await importComponent();

    // Mock Jira queryFn to reject (simulates error on cold load)
    mockFetchJiraActivity.mockRejectedValue(new Error('Jira error'));

    // Seed commits cache (warm) — commits key is seeded, no fetch needed
    const commitsData = [makeCommit({ id: 'xyz', title: 'surviving commit' })];

    // Do NOT seed Jira data → let the query attempt to fetch and fail
    // But since setQueryData for jira wasn't called, the query will be enabled and call queryFn.
    // We already mocked it to reject.
    renderWithQuery(<ActivityStrip {...defaultProps} />, { commitsData });

    // The commit row should eventually render — wait for async settle
    // Give React Query time to settle the errored jira query
    await new Promise((r) => setTimeout(r, 50));

    // Commits should still show — strip must NOT be fully blank
    expect(screen.getByText('surviving commit')).toBeTruthy();
  });
});

describe('ActivityStrip — empty and loading states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when both sources return empty arrays', async () => {
    const ActivityStrip = await importComponent();

    renderWithQuery(<ActivityStrip {...defaultProps} />, {
      jiraData: [],
      commitsData: [],
    });

    expect(screen.getByText('No recent activity')).toBeTruthy();
  });
});
