/**
 * Wave 0 progressive-rendering test scaffold for IssueDetailPage.
 *
 * These tests assert per-section independent rendering (PERF-DETAIL-01/02).
 * They MUST FAIL initially (RED gate) — the page still uses the global gate
 * and does not have independent queries for comments/subtasks/changelog.
 * They will turn GREEN after 75-02 wires up the independent queries.
 */

// --- Mocks (declared before any imports that use them) ---

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/stores/breadcrumb.store', () => ({
  useBreadcrumbStore: vi.fn(),
}));

vi.mock('@/stores/pinned-tabs.store', () => ({
  usePinnedTabsStore: vi.fn(),
}));

vi.mock('@/stores/recent-items.store', () => ({
  useRecentItemsStore: vi.fn(),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/hooks/useDelayedLoading', () => ({
  useDelayedLoading: vi.fn().mockReturnValue(false),
}));

vi.mock('@/hooks/useMentionUserMap', () => ({
  useMentionUserMap: vi.fn().mockReturnValue({}),
}));

vi.mock('@/hooks/useResizable', () => ({
  useResizable: vi.fn().mockReturnValue({ width: 400, isDragging: false, handleMouseDown: () => {} }),
}));

vi.mock('@/services/jira', () => ({
  fetchIssueDetail: vi.fn(),
  fetchEnrichedSubtasks: vi.fn(),
  fetchEpicStories: vi.fn().mockResolvedValue([]),
  deleteComment: vi.fn(),
  updateComment: vi.fn(),
}));

vi.mock('@/services/jira/comments', () => ({
  fetchComments: vi.fn(),
}));

vi.mock('@/services/jira/changelog', () => ({
  fetchIssueChangelog: vi.fn(),
}));

vi.mock('@/services/jira/worklogs', () => ({
  fetchFullWorklogs: vi.fn().mockResolvedValue([]),
  deleteWorklog: vi.fn(),
  updateWorklog: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ key: 'PROJ-123' }),
    useNavigate: vi.fn().mockReturnValue(() => {}),
    useOutletContext: vi.fn().mockReturnValue({
      onIssueClick: () => {},
      openEdit: () => {},
      openClone: () => {},
      openAddSubtask: () => {},
    }),
  };
});

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

// --- Imports (after mocks) ---

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchEnrichedSubtasks, fetchIssueDetail } from '@/services/jira';
import { fetchComments } from '@/services/jira/comments';
import { fetchIssueChangelog } from '@/services/jira/changelog';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import { useSettingsStore } from '@/stores/settings.store';

import IssueDetailPage from './IssueDetailPage';

// --- Constants ---

const JIRA_BASE_URL = 'https://jira.example.com';
const ISSUE_KEY = 'PROJ-123';

const BASE_ISSUE = {
  id: '10001',
  key: ISSUE_KEY,
  fields: {
    summary: 'Test issue title',
    status: { id: '1', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    assignee: { displayName: 'Alice', avatarUrls: { '48x48': '' }, name: 'alice' },
    reporter: { displayName: 'Bob', name: 'bob', emailAddress: 'bob@example.com' },
    priority: { name: 'Medium' },
    issuetype: { name: 'Story', subtask: false },
    project: { id: '1', key: 'PROJ', name: 'Project' },
    description: null,
    attachment: [],
    issuelinks: [],
    subtasks: [],
    labels: [],
    fixVersions: [],
    parent: undefined,
    timetracking: {},
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    duedate: null,
    customfield_13415: null,
  },
};

// --- Test helpers ---

const mockUseSettingsStore = vi.mocked(useSettingsStore);
const mockUseAuthStore = vi.mocked(useAuthStore);
const mockUseBreadcrumbStore = vi.mocked(useBreadcrumbStore);
const mockUsePinnedTabsStore = vi.mocked(usePinnedTabsStore);
const mockUseRecentItemsStore = vi.mocked(useRecentItemsStore);
const mockUseDelayedLoading = vi.mocked(useDelayedLoading);
const mockFetchIssueDetail = vi.mocked(fetchIssueDetail);
const mockFetchComments = vi.mocked(fetchComments);
const mockFetchIssueChangelog = vi.mocked(fetchIssueChangelog);
const mockFetchEnrichedSubtasks = vi.mocked(fetchEnrichedSubtasks);

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function setupDefaultStores() {
  // useSettingsStore is called with selectors — mock as implementation
  mockUseSettingsStore.mockImplementation((selector?: unknown) => {
    const store = {
      epicLinkFieldKey: 'customfield_10014',
      epicNameFieldKey: 'customfield_10010',
      sprintFieldKey: 'customfield_10020',
      storyPointsFieldKey: 'customfield_10016',
      epicColorFieldKey: undefined,
      issueDetailPanelWidth: 400,
      setIssueDetailPanelWidth: () => {},
    };
    if (typeof selector === 'function') return selector(store);
    return store;
  });

  mockUseAuthStore.mockImplementation((selector?: unknown) => {
    const store = {
      jiraBaseUrl: JIRA_BASE_URL,
      jiraConnected: true,
      jiraUserDisplayName: 'Alice',
    };
    if (typeof selector === 'function') return selector(store);
    return store;
  });

  mockUseBreadcrumbStore.mockImplementation((selector?: unknown) => {
    const store = { trail: [], pop: () => {} };
    if (typeof selector === 'function') return selector(store);
    return store;
  });

  mockUsePinnedTabsStore.mockImplementation((selector?: unknown) => {
    const store = { pinnedKeys: [], togglePin: () => {} };
    if (typeof selector === 'function') return selector(store);
    return store;
  });

  mockUseRecentItemsStore.mockImplementation((selector?: unknown) => {
    const store = { pushItem: () => {} };
    if (typeof selector === 'function') return selector(store);
    return store;
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/issue/${ISSUE_KEY}`]}>
        <IssueDetailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// --- Tests ---

describe('IssueDetailPage — progressive rendering (Wave 0 RED gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDelayedLoading.mockReturnValue(false);
    setupDefaultStores();
    mockFetchIssueDetail.mockResolvedValue(BASE_ISSUE as never);
    mockFetchComments.mockReturnValue(new Promise(() => {})); // never resolves
    mockFetchIssueChangelog.mockReturnValue(new Promise(() => {})); // never resolves
    mockFetchEnrichedSubtasks.mockReturnValue(new Promise(() => {})); // never resolves
  });

  // PERF-DETAIL-01: header renders before comments query resolves
  it('renders issue title when base query resolves but comments query is still pending', async () => {
    // Base issue resolves immediately; comments query is pending (never resolves mock above)
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Test issue title')).toBeTruthy();
    });
    // The page should show the header without waiting for comments
    expect(screen.getByText(ISSUE_KEY)).toBeTruthy();
  });

  // PERF-DETAIL-02: comments-skeleton shown when comments query isPending + useDelayedLoading true
  it('renders comments-skeleton when comments query is pending and useDelayedLoading returns true', async () => {
    // useDelayedLoading returns true → skeleton should render
    mockUseDelayedLoading.mockReturnValue(true);
    mockFetchComments.mockReturnValue(new Promise(() => {}));

    renderPage();
    await waitFor(() => {
      // Base issue is loaded
      expect(screen.getByText('Test issue title')).toBeTruthy();
    });

    // comments-skeleton must be present (independent of base issue gate)
    expect(screen.getByTestId('comments-skeleton')).toBeTruthy();
  });

  // PERF-DETAIL-02: subtasks-skeleton shown when subtask enrichment query isPending
  it('renders subtasks-skeleton when subtask enrichment query is pending and useDelayedLoading returns true', async () => {
    const issueWithSubtasks = {
      ...BASE_ISSUE,
      fields: {
        ...BASE_ISSUE.fields,
        subtasks: [
          {
            id: '10002',
            key: 'PROJ-124',
            fields: {
              summary: 'Subtask 1',
              status: { name: 'To Do', statusCategory: { key: 'new' } },
              assignee: null,
            },
          },
        ],
      },
    };
    mockFetchIssueDetail.mockResolvedValue(issueWithSubtasks as never);
    mockUseDelayedLoading.mockReturnValue(true);
    mockFetchEnrichedSubtasks.mockReturnValue(new Promise(() => {}));

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Test issue title')).toBeTruthy();
    });

    // subtasks-skeleton must be present while enrichment is pending
    expect(screen.getByTestId('subtasks-skeleton')).toBeTruthy();
  });
});
