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
import { describe, expect, it, vi } from 'vitest';

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
});
