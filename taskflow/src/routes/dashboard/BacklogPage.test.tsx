/**
 * BacklogPage tests — BACK-01..05 RED stubs (Wave 0)
 *
 * BacklogPage.tsx does not exist yet — all tests fail at import.
 * These stubs define the behavioral contract for Plan 12-02 (GREEN phase).
 *
 * Requirements covered:
 *   BACK-01 — Backlog issue list (load, skeleton, empty state)
 *   BACK-02 — Bulk "Move to sprint" action (checkbox selection, optimistic removal, rollback)
 *   BACK-03 — Create Story entry point (+ Create Story button)
 *   BACK-04 — Epic / assignee filters (AND logic, dismiss chip)
 *   BACK-05 — Row click opens issue detail
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({ onIssueClick: vi.fn(), openCreateStory: vi.fn() }),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/services/jira', () => ({
  fetchBacklogIssues: vi.fn().mockResolvedValue([]),
  addIssuesToSprint: vi.fn().mockResolvedValue(undefined),
  fetchActiveSprint: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  })),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    accountFieldKey: null,
  })),
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return { ...actual, List: () => <span data-testid="icon-list" />, RefreshCw: () => <span /> };
});

// ── Fixtures ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal JiraIssue fixture sufficient for BacklogPage rendering and filter tests.
 * epicKey populates customfield_10014 (epicLinkFieldKey).
 */
function makeIssue(
  key: string,
  summary: string,
  epicKey?: string,
  assigneeDisplayName?: string,
) {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: { id: 'todo', name: 'To Do', statusCategory: { key: 'new' as const } },
      assignee: assigneeDisplayName
        ? { displayName: assigneeDisplayName, avatarUrls: { '48x48': '' } }
        : null,
      customfield_10016: null, // story points
      customfield_10014: epicKey ?? null, // epic link
      customfield_10015: null, // epic name
      issuetype: { name: 'Story', subtask: false },
      labels: [],
    },
  };
}

// ── Render helper ──────────────────────────────────────────────────────────────

function renderBacklogPage(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BACK-01 List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders issue key and summary rows when fetchBacklogIssues resolves with data', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Build login page'),
      makeIssue('PROJ-2', 'Fix signup flow'),
    ]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      expect(screen.getByText('Build login page')).toBeInTheDocument();
      expect(screen.getByText('PROJ-2')).toBeInTheDocument();
      expect(screen.getByText('Fix signup flow')).toBeInTheDocument();
    });
  });

  it('renders skeleton/loading state while query is pending', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockReturnValue(new Promise(() => {})); // never resolves

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('renders empty state message when fetchBacklogIssues resolves with []', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/no backlog issues|backlog is empty/i),
      ).toBeInTheDocument();
    });
  });
});

describe('BACK-02 Move to sprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selecting a row checkbox reveals the bulk action bar', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Build login page'),
    ]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const checkbox = screen.getByRole('checkbox', { name: /PROJ-1/i });
    fireEvent.click(checkbox);

    expect(screen.getByRole('button', { name: /move to sprint/i })).toBeInTheDocument();
  });

  it('"Move to sprint" button is disabled when fetchActiveSprint returns null', async () => {
    const { fetchBacklogIssues, fetchActiveSprint } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Build login page'),
    ]);
    vi.mocked(fetchActiveSprint).mockResolvedValue(null);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const checkbox = screen.getByRole('checkbox', { name: /PROJ-1/i });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /move to sprint/i })).toBeDisabled();
    });
  });

  it('clicking "Move to sprint" removes selected issues optimistically from the list', async () => {
    const { fetchBacklogIssues, fetchActiveSprint, addIssuesToSprint } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Build login page'),
      makeIssue('PROJ-2', 'Fix signup flow'),
    ]);
    vi.mocked(fetchActiveSprint).mockResolvedValue({
      id: 42,
      name: 'Sprint 1',
      state: 'active',
    });
    vi.mocked(addIssuesToSprint).mockResolvedValue(undefined);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const checkbox = screen.getByRole('checkbox', { name: /PROJ-1/i });
    fireEvent.click(checkbox);

    const moveBtn = await screen.findByRole('button', { name: /move to sprint/i });
    fireEvent.click(moveBtn);

    await waitFor(() => {
      expect(screen.queryByText('PROJ-1')).not.toBeInTheDocument();
      expect(screen.getByText('PROJ-2')).toBeInTheDocument();
    });
  });

  it('when addIssuesToSprint rejects, issues reappear and error message is shown', async () => {
    const { fetchBacklogIssues, fetchActiveSprint, addIssuesToSprint } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Build login page'),
    ]);
    vi.mocked(fetchActiveSprint).mockResolvedValue({
      id: 42,
      name: 'Sprint 1',
      state: 'active',
    });
    vi.mocked(addIssuesToSprint).mockRejectedValue(new Error('Failed to add issues to sprint: 500'));

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const checkbox = screen.getByRole('checkbox', { name: /PROJ-1/i });
    fireEvent.click(checkbox);

    const moveBtn = await screen.findByRole('button', { name: /move to sprint/i });
    fireEvent.click(moveBtn);

    await waitFor(() => {
      // Issue reappears (rollback)
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      // Error message shown
      expect(screen.getByText(/failed to add issues to sprint/i)).toBeInTheDocument();
    });
  });
});

describe('BACK-03 Create story', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking "+ Create Story" button calls openCreateStory from outlet context', async () => {
    const openCreateStory = vi.fn();
    const { useOutletContext } = await import('react-router-dom');
    vi.mocked(useOutletContext).mockReturnValue({ onIssueClick: vi.fn(), openCreateStory });

    const { fetchBacklogIssues } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => {
      const createBtn = screen.getByRole('button', { name: /create story/i });
      fireEvent.click(createBtn);
      expect(openCreateStory).toHaveBeenCalledTimes(1);
    });
  });
});

describe('BACK-04 Filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selecting an epic filter hides rows with a different epic', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Story in Epic A', 'EPIC-1'),
      makeIssue('PROJ-2', 'Story in Epic B', 'EPIC-2'),
    ]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // Select EPIC-1 from the epic filter dropdown
    const epicFilter = screen.getByRole('combobox', { name: /epic/i });
    fireEvent.change(epicFilter, { target: { value: 'EPIC-1' } });

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      expect(screen.queryByText('PROJ-2')).not.toBeInTheDocument();
    });
  });

  it('selecting an assignee filter hides rows with a different assignee', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Alice story', undefined, 'Alice'),
      makeIssue('PROJ-2', 'Bob story', undefined, 'Bob'),
    ]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const assigneeFilter = screen.getByRole('combobox', { name: /assignee/i });
    fireEvent.change(assigneeFilter, { target: { value: 'Alice' } });

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      expect(screen.queryByText('PROJ-2')).not.toBeInTheDocument();
    });
  });

  it('two active filters narrow results using AND logic (epic AND assignee)', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Alice + Epic A', 'EPIC-1', 'Alice'),
      makeIssue('PROJ-2', 'Alice + Epic B', 'EPIC-2', 'Alice'),
      makeIssue('PROJ-3', 'Bob + Epic A', 'EPIC-1', 'Bob'),
    ]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    const epicFilter = screen.getByRole('combobox', { name: /epic/i });
    fireEvent.change(epicFilter, { target: { value: 'EPIC-1' } });

    const assigneeFilter = screen.getByRole('combobox', { name: /assignee/i });
    fireEvent.change(assigneeFilter, { target: { value: 'Alice' } });

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();   // Alice + EPIC-1 — shown
      expect(screen.queryByText('PROJ-2')).not.toBeInTheDocument(); // Alice + EPIC-2 — hidden
      expect(screen.queryByText('PROJ-3')).not.toBeInTheDocument(); // Bob + EPIC-1 — hidden
    });
  });

  it('clicking the dismiss chip on an active filter clears that filter', async () => {
    const { fetchBacklogIssues } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Story in Epic A', 'EPIC-1'),
      makeIssue('PROJ-2', 'Story in Epic B', 'EPIC-2'),
    ]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // Apply epic filter
    const epicFilter = screen.getByRole('combobox', { name: /epic/i });
    fireEvent.change(epicFilter, { target: { value: 'EPIC-1' } });

    await waitFor(() => expect(screen.queryByText('PROJ-2')).not.toBeInTheDocument());

    // Dismiss the active filter chip
    const dismissChip = screen.getByRole('button', { name: /clear epic filter|remove epic/i });
    fireEvent.click(dismissChip);

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      expect(screen.getByText('PROJ-2')).toBeInTheDocument();
    });
  });
});

describe('BACK-05 Row click', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking a row (not checkbox) calls onIssueClick with the issue key', async () => {
    const onIssueClick = vi.fn();
    const { useOutletContext } = await import('react-router-dom');
    vi.mocked(useOutletContext).mockReturnValue({ onIssueClick, openCreateStory: vi.fn() });

    const { fetchBacklogIssues } = await import('@/services/jira');
    vi.mocked(fetchBacklogIssues).mockResolvedValue([
      makeIssue('PROJ-1', 'Build login page'),
    ]);

    const { default: BacklogPage } = await import('./BacklogPage');
    renderBacklogPage(<BacklogPage />);

    await waitFor(() => screen.getByText('PROJ-1'));

    // Click the row (by summary text — not the checkbox)
    fireEvent.click(screen.getByText('Build login page'));

    expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
  });
});
