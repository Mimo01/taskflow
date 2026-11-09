/**
 * Standup Notes rows highlight the issue open in the peek sidebar (quick 261109-kt6),
 * like every other list (useIsPeeked + PEEKED_ROW_CLASS).
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import { usePeekStore } from '@/stores/peek.store';
import IssueActivityGroup from './IssueActivityGroup';
import TodayInProgressSection from './TodayInProgressSection';
import TodayUpNextSection from './TodayUpNextSection';

vi.mock('@/components/ui/cached-avatar', () => ({ CachedAvatar: () => null }));

function makeIssue(key: string, statusCategoryKey: 'indeterminate' | 'new'): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary of ${key}`,
      status: { id: '1', name: 'Status', statusCategory: { key: statusCategoryKey } },
      assignee: { displayName: 'Test User' },
      issuetype: { name: 'Story', subtask: false },
      subtasks: [],
      timetracking: {},
    },
  } as unknown as JiraIssue;
}

/** The row element carrying data-peeked for the issue whose key button reads `key`. */
function rowFor(key: string): HTMLElement | null {
  return screen.getByRole('button', { name: key }).closest('div');
}

afterEach(() => {
  act(() => usePeekStore.getState().setPeekIssueKey(null));
});

const sectionProps = {
  mrsByStory: new Map(),
  storyPointsFieldKey: 'customfield_10016',
  isLoading: false,
  isError: false,
  error: null,
  onRetry: () => {},
  onIssueClick: () => {},
  onMRClick: () => {},
};

describe('Standup Notes peek highlight', () => {
  it('Yesterday activity header (story + sub-task) marks only the peeked issue', () => {
    render(
      <IssueActivityGroup
        issueKey="PROJ-1"
        summary="Story"
        subItems={[]}
        subTaskGroups={[{ issueKey: 'PROJ-2', summary: 'Sub', subItems: [] }]}
      />,
    );
    act(() => usePeekStore.getState().setPeekIssueKey('PROJ-2'));
    expect(rowFor('PROJ-2')).toHaveAttribute('data-peeked', 'true');
    expect(rowFor('PROJ-1')).not.toHaveAttribute('data-peeked');
    // focus-within tint must not compete with the peek tint on the peeked row
    expect(rowFor('PROJ-2')?.className).not.toContain('focus-within:bg-muted');
  });

  it('Today In Progress row marks the peeked issue', () => {
    render(
      <TodayInProgressSection
        {...sectionProps}
        rows={[
          { issue: makeIssue('PROJ-3', 'indeterminate'), subtasks: [] },
          { issue: makeIssue('PROJ-4', 'indeterminate'), subtasks: [] },
        ]}
      />,
    );
    act(() => usePeekStore.getState().setPeekIssueKey('PROJ-3'));
    expect(rowFor('PROJ-3')).toHaveAttribute('data-peeked', 'true');
    expect(rowFor('PROJ-4')).not.toHaveAttribute('data-peeked');
  });

  it('Today Up Next row marks the peeked issue', () => {
    render(
      <TodayUpNextSection
        {...sectionProps}
        rows={[
          { issue: makeIssue('PROJ-5', 'new'), subtasks: [] },
          { issue: makeIssue('PROJ-6', 'new'), subtasks: [] },
        ]}
      />,
    );
    act(() => usePeekStore.getState().setPeekIssueKey('PROJ-6'));
    expect(rowFor('PROJ-6')).toHaveAttribute('data-peeked', 'true');
    expect(rowFor('PROJ-5')).not.toHaveAttribute('data-peeked');
  });
});
