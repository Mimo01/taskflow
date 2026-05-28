/**
 * EpicDetailSheet behavioral tests — EPIC-03
 *
 * Architecture deviation (approved): EpicDetailSheet.tsx was NOT created as a
 * standalone component. Epic detail view is implemented via IssueDetailSheet /
 * IssueDetailContent with the isEpic=true branch. These tests verify the
 * EPIC-03 requirements against the actual implementation.
 *
 * Requirements validated:
 *   EPIC-03-A: When opened for an Epic issue, renders a "Stories" section
 *   EPIC-03-B: Stories list shows issue key, summary, and status for each story
 *   EPIC-03-C: Clicking a story calls onOpenIssue with the story key
 *   EPIC-03-D: Non-epic issues do NOT show a Stories section
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth store — prevents Tauri storage init error in jsdom
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    jiraConnected: true,
    activeJiraProject: 'PROJ',
  })),
}));

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    sprintFieldKey: 'customfield_10020',
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

// Mock @tauri-apps/plugin-opener — not needed but prevents module errors
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

// Mock WikiRenderer
vi.mock('./WikiRenderer', () => ({
  WikiRenderer: ({ wikiText }: { wikiText: string | null }) => (
    <div data-testid="wiki-renderer">{wikiText}</div>
  ),
}));

function makeEpicIssue(_epicStoryOverrides?: object[]) {
  return {
    id: 'PROJ-42',
    key: 'PROJ-42',
    fields: {
      summary: 'My Epic Issue',
      description: null,
      status: { id: '3', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      issuetype: { name: 'Epic', subtask: false },
      priority: { name: 'Medium' },
      assignee: null,
      reporter: { displayName: 'Admin', avatarUrls: { '48x48': '' } },
      subtasks: [],
      issuelinks: [],
      comment: { comments: [] },
      labels: [],
      fixVersions: [],
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-03-01T00:00:00.000Z',
      duedate: null,
      customfield_10016: null,
      customfield_10014: null,
      customfield_10015: 'My Epic Issue',
      customfield_10020: [],
    },
  };
}

function makeStory(key: string, summary: string, statusName: string) {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: { name: statusName, statusCategory: { key: 'indeterminate' } },
      issuetype: { name: 'Story', subtask: false },
      assignee: null,
      priority: null,
      customfield_10016: 3,
    },
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('EPIC-03: epic stories list in IssueDetailContent (isEpic branch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('EPIC-03-A: renders Stories section heading when issue is of type Epic', async () => {
    const { IssueDetailContent } = await import('./IssueDetailContent');
    const epicIssue = makeEpicIssue();
    const epicStories = [makeStory('PROJ-5', 'Story One', 'In Progress')];

    render(
      <IssueDetailContent
        issue={epicIssue as never}
        issueKey="PROJ-42"
        jiraBaseUrl="https://jira.example.com"
        onOpenIssue={vi.fn()}
        storyPointsFieldKey="customfield_10016"
        sprintFieldKey="customfield_10020"
        epicLinkFieldKey="customfield_10014"
        epicStories={epicStories as never}
      />,
      { wrapper },
    );

    // Stories heading must be visible
    expect(screen.getByText(/Stories/)).toBeInTheDocument();
  });

  it('EPIC-03-B: renders story key, summary, and status badge for each story', async () => {
    const { IssueDetailContent } = await import('./IssueDetailContent');
    const epicIssue = makeEpicIssue();
    const epicStories = [
      makeStory('PROJ-5', 'Story One', 'In Progress'),
      makeStory('PROJ-6', 'Story Two', 'Done'),
    ];

    render(
      <IssueDetailContent
        issue={epicIssue as never}
        issueKey="PROJ-42"
        jiraBaseUrl="https://jira.example.com"
        onOpenIssue={vi.fn()}
        storyPointsFieldKey="customfield_10016"
        sprintFieldKey="customfield_10020"
        epicLinkFieldKey="customfield_10014"
        epicStories={epicStories as never}
      />,
      { wrapper },
    );

    // First story
    expect(screen.getByText('PROJ-5')).toBeInTheDocument();
    expect(screen.getByText('Story One')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();

    // Second story
    expect(screen.getByText('PROJ-6')).toBeInTheDocument();
    expect(screen.getByText('Story Two')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('EPIC-03-C: clicking a story row calls onOpenIssue with the story key', async () => {
    const { IssueDetailContent } = await import('./IssueDetailContent');
    const onOpenIssue = vi.fn();
    const epicIssue = makeEpicIssue();
    const epicStories = [makeStory('PROJ-5', 'Story One', 'To Do')];

    render(
      <IssueDetailContent
        issue={epicIssue as never}
        issueKey="PROJ-42"
        jiraBaseUrl="https://jira.example.com"
        onOpenIssue={onOpenIssue}
        storyPointsFieldKey="customfield_10016"
        sprintFieldKey="customfield_10020"
        epicLinkFieldKey="customfield_10014"
        epicStories={epicStories as never}
      />,
      { wrapper },
    );

    const storyButton = screen.getByText('Story One').closest('button') as HTMLButtonElement;
    fireEvent.click(storyButton);
    expect(onOpenIssue).toHaveBeenCalledWith('PROJ-5');
  });

  it('EPIC-03-D: non-epic issue does NOT render a Stories section', async () => {
    const { IssueDetailContent } = await import('./IssueDetailContent');
    const storyIssue = {
      id: 'PROJ-7',
      key: 'PROJ-7',
      fields: {
        summary: 'A regular story',
        description: null,
        status: { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
        issuetype: { name: 'Story', subtask: false },
        priority: { name: 'Low' },
        assignee: null,
        reporter: { displayName: 'Admin', avatarUrls: { '48x48': '' } },
        subtasks: [],
        issuelinks: [],
        comment: { comments: [] },
        labels: [],
        fixVersions: [],
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-03-01T00:00:00.000Z',
        duedate: null,
        customfield_10016: null,
        customfield_10014: 'PROJ-42',
        customfield_10015: null,
        customfield_10020: [],
      },
    };

    render(
      <IssueDetailContent
        issue={storyIssue as never}
        issueKey="PROJ-7"
        jiraBaseUrl="https://jira.example.com"
        onOpenIssue={vi.fn()}
        storyPointsFieldKey="customfield_10016"
        sprintFieldKey="customfield_10020"
        epicLinkFieldKey="customfield_10014"
      />,
      { wrapper },
    );

    // Stories section must NOT appear for non-epic issues
    expect(screen.queryByText(/^Stories/)).toBeNull();
  });

  it('EPIC-03-E: shows story count in Stories heading when stories are present', async () => {
    const { IssueDetailContent } = await import('./IssueDetailContent');
    const epicIssue = makeEpicIssue();
    const epicStories = [
      makeStory('PROJ-5', 'Story One', 'Done'),
      makeStory('PROJ-6', 'Story Two', 'In Progress'),
    ];

    render(
      <IssueDetailContent
        issue={epicIssue as never}
        issueKey="PROJ-42"
        jiraBaseUrl="https://jira.example.com"
        onOpenIssue={vi.fn()}
        storyPointsFieldKey="customfield_10016"
        sprintFieldKey="customfield_10020"
        epicLinkFieldKey="customfield_10014"
        epicStories={epicStories as never}
      />,
      { wrapper },
    );

    // Heading shows "Stories (2)"
    expect(screen.getByText('Stories (2)')).toBeInTheDocument();
  });
});
