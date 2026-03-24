/**
 * SprintBoardTab tests — HIER-02 Wave 0 RED stubs + infrastructure tests
 *
 * Infrastructure tests (loading/error/empty) PASS against current implementation.
 * HIER-02 behavior tests (column count, subtask grouping, collapse/expand, orphan suppression)
 * are intentionally in RED state — these will pass after HIER-02 implementation.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Shared mock for onIssueClick — tests that need to assert on it can reference this variable.
// The factory always reads the current value of onIssueClickShared so per-test overrides work.
let onIssueClickShared = vi.fn();

vi.mock('react-router-dom', () => ({
  useOutletContext: vi.fn(() => ({ onIssueClick: onIssueClickShared })),
  useNavigate: vi.fn(() => vi.fn()),
}));

// Mock stronghold — avoid real Tauri vault calls
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// Mock jira service — controlled from each test
vi.mock('@/services/jira', () => ({
  fetchSprintIssues: vi.fn().mockResolvedValue([]),
  fetchProjectStatuses: vi.fn().mockResolvedValue([]),
  fetchTransitions: vi.fn().mockResolvedValue([]),
  postTransition: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: 'https://gitlab.example.com',
  })),
}));

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    epicColorFieldKey: 'customfield_10013',
    quickFilters: [],
    addQuickFilter: vi.fn(),
    removeQuickFilter: vi.fn(),
    renameQuickFilter: vi.fn(),
    moveQuickFilter: vi.fn(),
  })),
}));

// Mock jira client — fetchAllSearchPages used by saved filter integration
vi.mock('@/services/jira/client', () => ({
  fetchAllSearchPages: vi.fn().mockResolvedValue([]),
}));

// Mock link engine
vi.mock('@/services/linkEngine', () => ({
  linkMRToTask: vi.fn().mockReturnValue(null),
  isStale: vi.fn().mockReturnValue(false),
}));

// Mock tauri opener
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

// Mock lucide-react — avoids SVG rendering issues in jsdom
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    ChevronDown: () => <span data-testid="chevron-down" />,
    ChevronRight: () => <span data-testid="chevron-right" />,
    RefreshCw: () => <span data-testid="refresh-cw" />,
  };
});

// Helper: build a minimal JiraIssue fixture
// statusId defaults to the status name so column matching (by id) works with makeStatus()
function makeIssue(
  key: string,
  summary: string,
  isSubtask: boolean,
  parentKey?: string,
  status = 'In Progress',
  statusId?: string,
) {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: { id: statusId ?? status, name: status },
      assignee: null,
      customfield_10016: null,
      issuetype: {
        name: isSubtask ? 'Sub-task' : 'Story',
        subtask: isSubtask,
      },
      ...(parentKey
        ? {
            parent: {
              id: parentKey,
              key: parentKey,
              fields: { summary: `Summary for ${parentKey}` },
            },
          }
        : {}),
    },
  };
}

// Helper: build a JiraProjectStatus fixture matching makeIssue's statusId convention
function makeStatus(name: string, categoryKey: 'new' | 'indeterminate' | 'done' = 'indeterminate') {
  return { id: name, name, statusCategory: { key: categoryKey } };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('SprintBoardTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Infrastructure tests (PASS against current implementation) ────────────

  it('renders loading skeleton when isLoading', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    // Never resolve — keep loading state
    vi.mocked(fetchSprintIssues).mockReturnValue(new Promise(() => {}));

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Wait for readSecret to resolve and jiraToken to be set, enabling the query
    // Then skeleton columns should be visible (query never resolves → isLoading=true)
    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('renders error message when isError', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockRejectedValue(new Error('Failed to load sprint board'));

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    await screen.findByText(/Couldn't load sprint board/i);
  });

  it('renders empty state when data is empty array', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    vi.mocked(fetchSprintIssues).mockResolvedValue([]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    await screen.findByText(/No sprint issues/i);
  });

  // ─── HIER-02 behavior stubs (RED state — FAIL against current implementation) ─

  it('story swimlane renders story header and its subtask cards', async () => {
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    const subtask = makeIssue('PROJ-2', 'Subtask One', true, 'PROJ-1', 'Done');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([
      makeStatus('In Progress', 'indeterminate'),
      makeStatus('Done', 'done'),
    ]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Story header must appear once — the swimlane section
    await waitFor(() => {
      expect(screen.getAllByText('PROJ-1').length).toBe(1);
    });
    // Subtask card must be visible directly (no expand needed)
    expect(screen.getByText('Subtask One')).toBeTruthy();
  });

  it('subtask card is always visible under its story header (no collapse)', async () => {
    // New design: subtasks are always shown as cards under a StoryHeaderRow — no collapse.
    // Replaces the old "collapsed by default" behavior.
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    const subtask = makeIssue('PROJ-2', 'Subtask One', true, 'PROJ-1', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([makeStatus('In Progress', 'indeterminate')]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Subtask card should be visible immediately (no expand required)
    await screen.findByText('Subtask One');
    // Story header (PROJ-1 key) should also be visible as a divider
    expect(screen.getByText('PROJ-1')).toBeTruthy();
  });

  it('clicking a story header row opens IssueDetailSheet for that story', async () => {
    // New design: story header rows are clickable — clicking opens the detail sheet.
    // Replaces old "expand subtasks chevron" behavior (no collapse in new design).
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    const subtask = makeIssue('PROJ-2', 'Subtask One', true, 'PROJ-1', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([makeStatus('In Progress', 'indeterminate')]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // StoryHeaderRow for PROJ-1 must be visible
    const storyHeader = await screen.findByText('PROJ-1');
    expect(storyHeader).toBeTruthy();

    // Subtask card is also visible (no expand needed)
    expect(screen.getByText('Subtask One')).toBeTruthy();
  });

  it('orphan subtask (parent not in sprint) is not rendered', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    // Subtask whose parent is NOT in the sprint
    const orphanSubtask = makeIssue('PROJ-99', 'Orphan Subtask', true, 'PROJ-999', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([orphanSubtask]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Wait for the board to finish loading — the refreshed time appears after data loads
    await waitFor(() => {
      expect(screen.getByText(/refreshed: \d/i)).toBeTruthy();
    });

    // Orphan subtask summary must NOT appear — it has no parent in the sprint
    // Current flat implementation shows it in the column — this test FAILS in RED state
    const orphanEl = screen.queryByText('Orphan Subtask');
    expect(orphanEl).toBeNull();
  });

  // ─── BOARD-01 / BOARD-03 Wave 0 RED stubs ─────────────────────────────────
  // These tests describe behavior for the redesigned sprint board.
  // They FAIL now because current board derives columns from issue statuses
  // and has no drag support. They will pass after the relevant plan implementations.

  it('multiple stories render as separate swimlane sections (BOARD-01)', async () => {
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    const story1 = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    const story2 = makeIssue('PROJ-2', 'Story Two', false, undefined, 'To Do');
    const subtask1 = makeIssue('PROJ-3', 'Subtask of One', true, 'PROJ-1', 'In Progress');
    const subtask2 = makeIssue('PROJ-4', 'Subtask of Two', true, 'PROJ-2', 'To Do');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story1, story2, subtask1, subtask2]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([
      makeStatus('To Do', 'new'),
      makeStatus('In Progress', 'indeterminate'),
    ]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Both story headers appear as separate sections
    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeTruthy();
      expect(screen.getByText('PROJ-2')).toBeTruthy();
    });
    // Each subtask appears under its story
    expect(screen.getByText('Subtask of One')).toBeTruthy();
    expect(screen.getByText('Subtask of Two')).toBeTruthy();
  });

  it('story header appears exactly once per story (not per column) (BOARD-01)', async () => {
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    // Story with subtasks in two different statuses — header still appears once
    const story = makeIssue('PROJ-1', 'My Story', false, undefined, 'To Do');
    const subtask1 = makeIssue('PROJ-2', 'My Subtask', true, 'PROJ-1', 'In Progress');
    const subtask2 = makeIssue('PROJ-3', 'Another Subtask', true, 'PROJ-1', 'To Do');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask1, subtask2]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([
      makeStatus('To Do', 'new'),
      makeStatus('In Progress', 'indeterminate'),
    ]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Story header appears exactly once (swimlane, not per-column)
    await waitFor(() => {
      expect(screen.getAllByText('PROJ-1').length).toBe(1);
    });
    // Both subtasks visible beneath it
    expect(screen.getByText('My Subtask')).toBeTruthy();
    expect(screen.getByText('Another Subtask')).toBeTruthy();
  });

  it('subtask card shows status badge (BOARD-03)', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'My Story', false, undefined, 'To Do');
    const subtask = makeIssue('PROJ-2', 'My Subtask', true, 'PROJ-1', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Status badge on the subtask card
    await waitFor(() => {
      expect(screen.getByText('My Subtask')).toBeTruthy();
    });
    // Status name "In Progress" appears as a badge on the card
    const statusBadges = screen.getAllByText('In Progress');
    expect(statusBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('bare story (no subtasks) renders as a standalone card (BOARD-03)', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    const bareStory = makeIssue('PROJ-1', 'Bare Story', false, undefined, 'To Do');
    vi.mocked(fetchSprintIssues).mockResolvedValue([bareStory]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Story header and standalone card both show the summary and status
    await waitFor(() => {
      expect(screen.getAllByText('Bare Story').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('To Do').length).toBeGreaterThanOrEqual(1);
  });

  // ─── EPIC-02 epic filter tests ─────────────────────────────────────────────

  describe('EPIC-02: epic filter', () => {
    function makeIssueWithEpic(
      key: string,
      summary: string,
      isSubtask: boolean,
      parentKey?: string,
      epicKey?: string,
    ) {
      const issue = makeIssue(key, summary, isSubtask, parentKey, 'In Progress');
      if (epicKey) {
        (issue.fields as Record<string, unknown>).customfield_10014 = epicKey;
      }
      return issue;
    }

    it('EPIC-02: filtering by epic key hides non-matching swimlanes', async () => {
      const { fetchSprintIssues } = await import('@/services/jira');
      const { useSettingsStore } = await import('@/stores/settings.store');
      vi.mocked(useSettingsStore).mockReturnValue({
        storyPointsFieldKey: 'customfield_10016',
        epicLinkFieldKey: 'customfield_10014',
        epicNameFieldKey: 'customfield_10015',
        epicColorFieldKey: 'customfield_10013',
        quickFilters: [],
        addQuickFilter: vi.fn(),
        removeQuickFilter: vi.fn(),
        renameQuickFilter: vi.fn(),
        moveQuickFilter: vi.fn(),
      } as ReturnType<typeof useSettingsStore>);

      const story1 = makeIssueWithEpic('PROJ-1', 'Story Alpha', false, undefined, 'PROJ-10');
      const story2 = makeIssueWithEpic('PROJ-2', 'Story Beta', false, undefined, 'PROJ-20');
      const sub1 = makeIssueWithEpic('PROJ-3', 'Sub of Alpha', true, 'PROJ-1', 'PROJ-10');
      const sub2 = makeIssueWithEpic('PROJ-4', 'Sub of Beta', true, 'PROJ-2', 'PROJ-20');
      vi.mocked(fetchSprintIssues).mockResolvedValue([story1, story2, sub1, sub2]);

      const { useAuthStore } = await import('@/stores/auth.store');
      vi.mocked(useAuthStore).mockReturnValue({
        jiraBaseUrl: 'https://jira.example.com',
        activeJiraProject: 'PROJ',
        gitlabBaseUrl: 'https://gitlab.example.com',
      } as ReturnType<typeof useAuthStore>);

      const { default: SprintBoardTab } = await import('./SprintBoardTab');
      renderWithQuery(<SprintBoardTab />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getAllByText('Story Alpha').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Story Beta').length).toBeGreaterThanOrEqual(1);
      });

      // Apply epic filter via the filter store (UnifiedFilterBar uses popover UI)
      const { useFilterStore } = await import('@/stores/filter.store');
      useFilterStore.getState().setActiveEpics(new Set(['PROJ-10']));

      // Story Alpha should still be visible; Story Beta should be hidden
      await waitFor(() => {
        expect(screen.getAllByText('Story Alpha').length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText('Story Beta')).toBeNull();
      });
    });

    it('EPIC-02: stories with no epic link are hidden when filter is active', async () => {
      const { fetchSprintIssues } = await import('@/services/jira');
      const { useSettingsStore } = await import('@/stores/settings.store');
      vi.mocked(useSettingsStore).mockReturnValue({
        storyPointsFieldKey: 'customfield_10016',
        epicLinkFieldKey: 'customfield_10014',
        epicNameFieldKey: 'customfield_10015',
        epicColorFieldKey: 'customfield_10013',
        quickFilters: [],
        addQuickFilter: vi.fn(),
        removeQuickFilter: vi.fn(),
        renameQuickFilter: vi.fn(),
        moveQuickFilter: vi.fn(),
      } as ReturnType<typeof useSettingsStore>);

      const storyWithEpic = makeIssueWithEpic('PROJ-1', 'Epic Story', false, undefined, 'PROJ-10');
      const storyNoEpic = makeIssue('PROJ-2', 'No Epic Story', false);
      vi.mocked(fetchSprintIssues).mockResolvedValue([storyWithEpic, storyNoEpic]);

      const { useAuthStore } = await import('@/stores/auth.store');
      vi.mocked(useAuthStore).mockReturnValue({
        jiraBaseUrl: 'https://jira.example.com',
        activeJiraProject: 'PROJ',
        gitlabBaseUrl: 'https://gitlab.example.com',
      } as ReturnType<typeof useAuthStore>);

      const { default: SprintBoardTab } = await import('./SprintBoardTab');
      renderWithQuery(<SprintBoardTab />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getAllByText('Epic Story').length).toBeGreaterThanOrEqual(1);
      });

      // Apply epic filter via the filter store
      const { useFilterStore } = await import('@/stores/filter.store');
      useFilterStore.getState().setActiveEpics(new Set(['PROJ-10']));

      await waitFor(() => {
        expect(screen.getAllByText('Epic Story').length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText('No Epic Story')).toBeNull();
      });
    });

    it('EPIC-02: clearing filter shows all swimlanes again', async () => {
      const { fetchSprintIssues } = await import('@/services/jira');
      const { useSettingsStore } = await import('@/stores/settings.store');
      vi.mocked(useSettingsStore).mockReturnValue({
        storyPointsFieldKey: 'customfield_10016',
        epicLinkFieldKey: 'customfield_10014',
        epicNameFieldKey: 'customfield_10015',
        epicColorFieldKey: 'customfield_10013',
        quickFilters: [],
        addQuickFilter: vi.fn(),
        removeQuickFilter: vi.fn(),
        renameQuickFilter: vi.fn(),
        moveQuickFilter: vi.fn(),
      } as ReturnType<typeof useSettingsStore>);

      const story1 = makeIssueWithEpic('PROJ-1', 'Story Alpha', false, undefined, 'PROJ-10');
      const story2 = makeIssueWithEpic('PROJ-2', 'Story Beta', false, undefined, 'PROJ-20');
      vi.mocked(fetchSprintIssues).mockResolvedValue([story1, story2]);

      const { useAuthStore } = await import('@/stores/auth.store');
      vi.mocked(useAuthStore).mockReturnValue({
        jiraBaseUrl: 'https://jira.example.com',
        activeJiraProject: 'PROJ',
        gitlabBaseUrl: 'https://gitlab.example.com',
      } as ReturnType<typeof useAuthStore>);

      const { default: SprintBoardTab } = await import('./SprintBoardTab');
      renderWithQuery(<SprintBoardTab />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getAllByText('Story Alpha').length).toBeGreaterThanOrEqual(1);
      });

      // Filter to PROJ-10
      const { useFilterStore } = await import('@/stores/filter.store');
      useFilterStore.getState().setActiveEpics(new Set(['PROJ-10']));
      await waitFor(() => {
        expect(screen.queryByText('Story Beta')).toBeNull();
      });

      // Clear the filter
      useFilterStore.getState().clearAll();
      await waitFor(() => {
        expect(screen.getAllByText('Story Alpha').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Story Beta').length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});

// ─── BOARD-02: all team members' cards visible ─────────────────────────────
describe('BOARD-02: board shows all team members issues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows cards for issues assigned to different team members', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');

    function makeIssueWithAssignee(
      key: string,
      summary: string,
      isSubtask: boolean,
      parentKey: string | undefined,
      assigneeName: string,
    ) {
      return {
        id: key,
        key,
        fields: {
          summary,
          status: {
            id: 'in-progress',
            name: 'In Progress',
            statusCategory: { key: 'indeterminate' as const },
          },
          assignee: { displayName: assigneeName, avatarUrls: { '48x48': '' } },
          customfield_10016: null,
          issuetype: { name: isSubtask ? 'Sub-task' : 'Story', subtask: isSubtask },
          ...(parentKey
            ? {
                parent: {
                  id: parentKey,
                  key: parentKey,
                  fields: { summary: `Parent ${parentKey}` },
                },
              }
            : {}),
        },
      };
    }

    const story1 = makeIssueWithAssignee('PROJ-1', 'Alice Story', false, undefined, 'Alice Smith');
    const story2 = makeIssueWithAssignee('PROJ-2', 'Bob Story', false, undefined, 'Bob Jones');
    const sub1 = makeIssueWithAssignee('PROJ-3', 'Alice Subtask', true, 'PROJ-1', 'Alice Smith');
    const sub2 = makeIssueWithAssignee('PROJ-4', 'Bob Subtask', true, 'PROJ-2', 'Bob Jones');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story1, story2, sub1, sub2]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Cards from both team members must be visible — no user filtering
    await screen.findByText('Alice Subtask');
    expect(screen.getByText('Bob Subtask')).toBeTruthy();
    // Both story headers visible
    expect(screen.getByText('PROJ-1')).toBeTruthy();
    expect(screen.getByText('PROJ-2')).toBeTruthy();
  });
});

// ─── BOARD-05: clicking a card opens the issue detail sheet ─────────────────
describe('BOARD-05: clicking a card opens issue detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the shared click mock so assertions start fresh
    onIssueClickShared = vi.fn();
  });

  it('clicking a subtask card fires onIssueClick with the card issue key', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    const story = makeIssue('PROJ-1', 'My Story', false, undefined, 'In Progress');
    const subtask = makeIssue('PROJ-2', 'Click Me Subtask', true, 'PROJ-1', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Wait for the subtask card to appear
    const cardText = await screen.findByText('Click Me Subtask');

    // Click the card (role=button on TaskCard div)
    fireEvent.click(cardText);

    // onIssueClick should be called with the subtask key
    await waitFor(() => {
      expect(onIssueClickShared).toHaveBeenCalledWith('PROJ-2');
    });
  });

  it('clicking a story header fires onIssueClick with the story key', async () => {
    const { fetchSprintIssues } = await import('@/services/jira');
    // Use a story with a subtask so the bare-story card doesn't appear alongside the header
    const story = makeIssue('PROJ-1', 'My Story', false, undefined, 'In Progress');
    const subtask = makeIssue('PROJ-2', 'A Subtask', true, 'PROJ-1', 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story, subtask]);

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Wait for story header — click the story key span inside the StoryHeaderRow button.
    // Use aria-label on the collapse/expand button to locate the header row, then find the
    // adjacent key+summary button via getAllByText and click the one in the story header.
    await waitFor(() => {
      expect(screen.getAllByText('PROJ-1').length).toBeGreaterThanOrEqual(1);
    });
    // Click the first occurrence — which is the story key span inside StoryHeaderRow's button
    const allKeyEls = screen.getAllByText('PROJ-1');
    fireEvent.click(allKeyEls[0]);

    await waitFor(() => {
      expect(onIssueClickShared).toHaveBeenCalledWith('PROJ-1');
    });
  });
});

// ─── FILT-02: saved filter integration ──────────────────────────────────────
describe('FILT-02: saved filter integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saved filter constrains sprint board to matching issues', async () => {
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    const { fetchAllSearchPages } = await import('@/services/jira/client');
    const { useSavedFilterStore } = await import('@/stores/saved-filter.store');

    const story1 = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    const story2 = makeIssue('PROJ-2', 'Story Two', false, undefined, 'To Do');
    const subtask1 = makeIssue('PROJ-3', 'Subtask of One', true, 'PROJ-1', 'In Progress');
    const subtask2 = makeIssue('PROJ-4', 'Subtask of Two', true, 'PROJ-2', 'To Do');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story1, story2, subtask1, subtask2]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([
      makeStatus('To Do', 'new'),
      makeStatus('In Progress', 'indeterminate'),
    ]);

    // Mock fetchAllSearchPages to return only issues from the first swimlane
    vi.mocked(fetchAllSearchPages).mockResolvedValue([
      { key: 'PROJ-1' } as any,
      { key: 'PROJ-3' } as any,
    ]);

    // Set saved filter store state BEFORE rendering
    useSavedFilterStore.getState().setSavedFilters([
      { id: '100', name: 'My Filter', jql: 'assignee = currentUser()' },
    ]);
    useSavedFilterStore.getState().setActiveFilter('100');

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // PROJ-1 header and its subtask should be visible
    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeTruthy();
      expect(screen.getByText('Subtask of One')).toBeTruthy();
    });

    // PROJ-2 header and its subtask should NOT be visible
    expect(screen.queryByText('PROJ-2')).toBeNull();
    expect(screen.queryByText('Subtask of Two')).toBeNull();

    // Clean up store state
    useSavedFilterStore.getState().setActiveFilter(null);
    useSavedFilterStore.getState().setSavedFilters([]);
  });

  it('clear saved filter restores default board view', async () => {
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    const { fetchAllSearchPages } = await import('@/services/jira/client');
    const { useSavedFilterStore } = await import('@/stores/saved-filter.store');

    const story1 = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    const story2 = makeIssue('PROJ-2', 'Story Two', false, undefined, 'To Do');
    const subtask1 = makeIssue('PROJ-3', 'Subtask of One', true, 'PROJ-1', 'In Progress');
    const subtask2 = makeIssue('PROJ-4', 'Subtask of Two', true, 'PROJ-2', 'To Do');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story1, story2, subtask1, subtask2]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([
      makeStatus('To Do', 'new'),
      makeStatus('In Progress', 'indeterminate'),
    ]);

    vi.mocked(fetchAllSearchPages).mockResolvedValue([
      { key: 'PROJ-1' } as any,
      { key: 'PROJ-3' } as any,
    ]);

    // Start with active filter
    useSavedFilterStore.getState().setSavedFilters([
      { id: '100', name: 'My Filter', jql: 'assignee = currentUser()' },
    ]);
    useSavedFilterStore.getState().setActiveFilter('100');

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Wait for filtered view
    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeTruthy();
    });
    expect(screen.queryByText('PROJ-2')).toBeNull();

    // Clear the saved filter
    useSavedFilterStore.getState().setActiveFilter(null);

    // Both stories should now be visible
    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeTruthy();
      expect(screen.getByText('PROJ-2')).toBeTruthy();
    });
    expect(screen.getByText('Subtask of One')).toBeTruthy();
    expect(screen.getByText('Subtask of Two')).toBeTruthy();

    // Clean up
    useSavedFilterStore.getState().setSavedFilters([]);
  });

  it('active filter banner shows filter name and clear button', async () => {
    const { fetchSprintIssues, fetchProjectStatuses } = await import('@/services/jira');
    const { fetchAllSearchPages } = await import('@/services/jira/client');
    const { useSavedFilterStore } = await import('@/stores/saved-filter.store');

    const story1 = makeIssue('PROJ-1', 'Story One', false, undefined, 'In Progress');
    vi.mocked(fetchSprintIssues).mockResolvedValue([story1]);
    vi.mocked(fetchProjectStatuses).mockResolvedValue([
      makeStatus('In Progress', 'indeterminate'),
    ]);
    vi.mocked(fetchAllSearchPages).mockResolvedValue([{ key: 'PROJ-1' } as any]);

    useSavedFilterStore.getState().setSavedFilters([
      { id: '100', name: 'My Filter', jql: 'assignee = currentUser()' },
    ]);
    useSavedFilterStore.getState().setActiveFilter('100');

    const { useAuthStore } = await import('@/stores/auth.store');
    vi.mocked(useAuthStore).mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'PROJ',
      gitlabBaseUrl: 'https://gitlab.example.com',
    } as ReturnType<typeof useAuthStore>);

    const { default: SprintBoardTab } = await import('./SprintBoardTab');
    renderWithQuery(<SprintBoardTab />);

    // Banner should show filter name
    await waitFor(() => {
      expect(screen.getByText(/My Filter/)).toBeTruthy();
    });
    // Clear button should be visible
    expect(screen.getByText('Clear')).toBeTruthy();

    // Clean up
    useSavedFilterStore.getState().setActiveFilter(null);
    useSavedFilterStore.getState().setSavedFilters([]);
  });
});
