// Phase 77 Plan 02 — DETAIL-01 and DETAIL-02 tests.
// Requirements covered: DETAIL-01, DETAIL-02

// --- Mocks (hoisted before imports) ---

vi.mock('@/services/jira', () => ({
  fetchIssueDetail: vi.fn(),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((sel?: (s: unknown) => unknown) => {
    const state = { jiraBaseUrl: 'https://jira.example.com', jiraConnected: true };
    return sel ? sel(state) : state;
  }),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn((sel?: (s: unknown) => unknown) => {
    const state = {
      storyPointsFieldKey: 'story_points',
      epicLinkFieldKey: 'epic_link',
      sprintFieldKey: 'sprint',
    };
    return sel ? sel(state) : state;
  }),
}));

vi.mock('@/services/jira/attachments', () => ({
  deleteAttachment: vi.fn(),
}));

vi.mock('./issue-detail/LogWorkPopover', () => ({
  LogWorkPopover: () => null,
}));

vi.mock('./issue-detail/AttachmentsSection', () => ({
  AttachmentsSection: () => null,
}));

vi.mock('@/hooks/useMentionUserMap', () => ({
  useMentionUserMap: () => ({}),
}));

vi.mock('./WikiRenderer', () => ({
  WikiRenderer: ({ wikiText }: { wikiText: string }) => <div>{wikiText}</div>,
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

// --- Imports ---

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ESTIMATE_FORMULA_NOTE } from '@/lib/epic-progress';
import { IssueDetailContent } from './IssueDetailContent';

// --- Fixture helpers ---

function makeSubtaskIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 'issue-1',
    key: 'PROJ-10',
    fields: {
      summary: 'A subtask issue',
      description: '',
      issuetype: { name: 'Sub-task', subtask: true },
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      assignee: null,
      reporter: null,
      priority: null,
      attachment: [],
      subtasks: [],
      issuelinks: [],
      parent: {
        id: '100',
        key: 'PROJ-0',
        fields: { summary: 'Parent story' },
      },
      ...overrides,
    },
  } as never;
}

function makeStoryIssue(subtasks: unknown[] = []) {
  return {
    id: 'issue-2',
    key: 'PROJ-20',
    fields: {
      summary: 'A story issue',
      description: '',
      issuetype: { name: 'Story', subtask: false },
      status: { name: 'To Do', statusCategory: { key: 'new' } },
      assignee: null,
      reporter: null,
      priority: null,
      attachment: [],
      subtasks,
      issuelinks: [],
    },
  } as never;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('IssueDetailContent', () => {
  // DETAIL-01: for a subtask fixture with fields.parent, a clickable parent card with the
  //            parent key + summary renders in the relationships region (replaced the old
  //            breadcrumb-above-title; see quick-260606-ugr redesign).
  it('DETAIL-01: for a subtask fixture with fields.parent, a clickable parent card with the parent key renders', () => {
    const onOpenIssue = vi.fn();
    const issue = makeSubtaskIssue();

    render(
      <IssueDetailContent
        issue={issue}
        issueKey="PROJ-10"
        jiraBaseUrl="https://jira.example.com"
        storyPointsFieldKey="story_points"
        sprintFieldKey="sprint"
        epicLinkFieldKey="epic_link"
        onOpenIssue={onOpenIssue}
      />,
      { wrapper },
    );

    // Parent key + summary render inside the clickable parent card.
    expect(screen.getByText('PROJ-0')).toBeTruthy();
    expect(screen.getByText('Parent story')).toBeTruthy();

    // The card is a button wired to open the parent issue.
    const parentBtn = screen.getByLabelText('Open parent issue PROJ-0');
    fireEvent.click(parentBtn);
    expect(onOpenIssue).toHaveBeenCalledWith('PROJ-0');
  });

  // DETAIL-01: parent now renders as a labelled "Parent" section in the relationships region
  // (the redesign added a prominent parent card; it is no longer a breadcrumb above the title).
  it('DETAIL-01: parent section renders for a subtask', () => {
    const issue = makeSubtaskIssue();

    render(
      <IssueDetailContent
        issue={issue}
        issueKey="PROJ-10"
        jiraBaseUrl="https://jira.example.com"
        storyPointsFieldKey="story_points"
        sprintFieldKey="sprint"
        epicLinkFieldKey="epic_link"
      />,
      { wrapper },
    );

    // The "Parent" section heading now renders by design.
    const parentLabel = screen.queryByText('Parent', { exact: true });
    expect(parentLabel).not.toBeNull();
  });

  // DETAIL-02: subtask row buttons carry the cursor-pointer class
  it('DETAIL-02: subtask row buttons carry the cursor-pointer class', () => {
    const subtasks = [
      {
        id: 'sub-1',
        key: 'PROJ-11',
        fields: {
          summary: 'First subtask',
          status: { name: 'To Do', statusCategory: { key: 'new' } },
        },
      },
    ];
    const issue = makeStoryIssue(subtasks);

    render(
      <IssueDetailContent
        issue={issue}
        issueKey="PROJ-20"
        jiraBaseUrl="https://jira.example.com"
        storyPointsFieldKey="story_points"
        sprintFieldKey="sprint"
        epicLinkFieldKey="epic_link"
        enrichedSubtasks={subtasks as never}
      />,
      { wrapper },
    );

    // Find the subtask button (contains the subtask key)
    const subtaskBtn = screen.getByText('PROJ-11').closest('button');
    expect(subtaskBtn).toBeTruthy();
    expect(subtaskBtn?.className).toContain('cursor-pointer');
  });

  describe('Stories list mini time bars (261001-hsz)', () => {
    function epicIssue() {
      return {
        id: 'epic-1',
        key: 'PROJ-30',
        fields: {
          summary: 'An epic',
          description: '',
          issuetype: { name: 'Epic', subtask: false },
          status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
          assignee: null,
          reporter: null,
          priority: null,
          attachment: [],
          subtasks: [],
          issuelinks: [],
        },
      } as never;
    }
    function epicStory(
      key: string,
      cat: 'new' | 'indeterminate' | 'done',
      o: { est?: number; spent?: number },
    ) {
      return {
        id: key,
        key,
        fields: {
          summary: `Story ${key}`,
          status: { name: cat === 'done' ? 'Closed' : 'Open', statusCategory: { key: cat } },
          assignee: null,
          issuetype: { name: 'Story', subtask: false },
          aggregatetimeoriginalestimate: o.est,
          timeoriginalestimate: o.est,
          aggregatetimespent: o.spent,
        },
      };
    }
    function renderEpic(stories: unknown[], onOpenIssue = vi.fn()) {
      render(
        <IssueDetailContent
          issue={epicIssue()}
          issueKey="PROJ-30"
          jiraBaseUrl="https://jira.example.com"
          storyPointsFieldKey="story_points"
          sprintFieldKey="sprint"
          epicLinkFieldKey="epic_link"
          epicStories={stories as never}
          onOpenIssue={onOpenIssue}
        />,
        { wrapper },
      );
      return onOpenIssue;
    }

    it('fills proportionally and stays non-interactive inside the row button', () => {
      const onOpen = renderEpic([epicStory('S-1', 'new', { est: 7200, spent: 3600 })]);
      const bar = screen.getByTestId('story-time-bar');
      expect(bar.tagName).toBe('SPAN');
      expect(bar).not.toHaveAttribute('data-overrun');
      expect(bar).not.toHaveAttribute('data-empty');
      expect((bar.firstElementChild as HTMLElement).style.width).toBe('50%');
      const row = bar.closest('button') as HTMLElement;
      expect(bar.hasAttribute('tabindex')).toBe(false);
      expect(row.querySelectorAll('button')).toHaveLength(0);
      fireEvent.click(row);
      expect(onOpen).toHaveBeenCalledWith('S-1');
    });

    it('flags overrun with a clamped red fill', () => {
      renderEpic([epicStory('S-1', 'new', { est: 3600, spent: 7200 })]);
      const bar = screen.getByTestId('story-time-bar');
      expect(bar).toHaveAttribute('data-overrun', 'true');
      const fill = bar.firstElementChild as HTMLElement;
      expect(fill.style.width).toBe('100%');
      expect(fill.className).toContain('bg-red-500');
    });

    it('renders an empty muted track when there is no estimate', async () => {
      const user = userEvent.setup();
      renderEpic([epicStory('S-1', 'new', { spent: 1800 })]);
      const bar = screen.getByTestId('story-time-bar');
      expect(bar).toHaveAttribute('data-empty', 'true');
      expect(bar.firstElementChild).toBeNull();
      await user.hover(bar);
      expect(await screen.findByText('No estimate')).toBeInTheDocument();
      expect(screen.getByText('Logged 30m')).toBeInTheDocument();
    });

    it('tooltip shows estimate, logged, remaining and the formula note', async () => {
      const user = userEvent.setup();
      renderEpic([epicStory('S-1', 'indeterminate', { est: 7200, spent: 1800 })]);
      await user.hover(screen.getByTestId('story-time-bar'));
      expect(await screen.findByText('Estimate 2h')).toBeInTheDocument();
      expect(screen.getByText('Logged 30m')).toBeInTheDocument();
      expect(screen.getByText('Remaining 1h 30m')).toBeInTheDocument();
      expect(screen.getAllByText(ESTIMATE_FORMULA_NOTE).length).toBeGreaterThan(0);
    });

    it('done stories show zero remaining', async () => {
      const user = userEvent.setup();
      renderEpic([epicStory('S-1', 'done', { est: 7200, spent: 3600 })]);
      await user.hover(screen.getByTestId('story-time-bar'));
      expect(await screen.findByText('Remaining 0m')).toBeInTheDocument();
    });
  });
});
