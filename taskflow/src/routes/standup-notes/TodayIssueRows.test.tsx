/**
 * Story vs subtask right-cluster tests for the Standup Today sections.
 * Story rows get a longer time bar (grows leftward by the subtask indent);
 * subtask rows render no story-points slot.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import type { SprintRow } from './filterSprintItems';
import TodayInProgressSection from './TodayInProgressSection';
import TodayUpNextSection from './TodayUpNextSection';

function makeIssue(key: string, isSubtask: boolean, sp?: number): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary of ${key}`,
      status: { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
      assignee: { displayName: 'Test User' },
      issuetype: { name: isSubtask ? 'Sub-task' : 'Story', subtask: isSubtask },
      subtasks: [],
      customfield_10016: sp,
      timetracking: {},
    },
  } as unknown as JiraIssue;
}

const sub = makeIssue('PROJ-2', true);
const parentRow: SprintRow = {
  issue: makeIssue('PROJ-1', false, 3),
  subtasks: [sub],
  timeSubtasks: [sub],
};
const standaloneRow: SprintRow = { issue: makeIssue('PROJ-3', true), subtasks: [] };

function props(rows: SprintRow[]) {
  return {
    rows,
    mrsByStory: new Map(),
    storyPointsFieldKey: 'customfield_10016',
    isLoading: false,
    isError: false,
    error: null,
    onRetry: vi.fn(),
    onIssueClick: vi.fn(),
    onMRClick: vi.fn(),
  };
}

describe.each([
  ['TodayInProgressSection', TodayInProgressSection],
  ['TodayUpNextSection', TodayUpNextSection],
])('%s story vs subtask right cluster', (_name, Section) => {
  it('story bar is w-32, indented subtask bar is w-24', () => {
    render(<Section {...props([parentRow])} />);
    const bars = screen.getAllByTestId('standup-time-bar');
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveClass('w-32', '@max-[30rem]:hidden');
    expect(bars[1]).toHaveClass('w-24', '@max-[30rem]:hidden');
    expect(bars[1]).not.toHaveClass('w-32');
  });

  it('only the story renders an SP slot', () => {
    const { container } = render(<Section {...props([parentRow])} />);
    expect(screen.getAllByTestId('standup-sp-slot')).toHaveLength(1);
    expect(container.querySelector('.pl-6 [data-testid="standup-sp-slot"]')).toBeNull();
  });

  it('a standalone (non-indented) row gets the story-width bar', () => {
    render(<Section {...props([standaloneRow])} />);
    expect(screen.getByTestId('standup-time-bar')).toHaveClass('w-32');
  });
});
